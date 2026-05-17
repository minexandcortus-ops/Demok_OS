import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Law } from '../laws/law.entity';
import { Amendement, AmendementStatut } from '../laws/amendement.entity';
import * as he from 'he';

@Injectable()
export class AmendementIngestionService {
    private readonly logger = new Logger(AmendementIngestionService.name);

    private readonly CSV_BASE_URL =
        'https://data.assemblee-nationale.fr/static/openData/repository/17/dossiers_legislatifs_opendata';
    private readonly HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    };

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectRepository(Amendement)
        private readonly amendementRepository: Repository<Amendement>,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
    ) { }

    /** Extrait l'ID numérique AN: "AN_DLR5L17N52985" → "52985" */
    extractDossierId(externalId: string): string | null {
        const match = externalId.match(/N(\d+)$/);
        return match ? match[1] : null;
    }

    /**
     * Télécharge le CSV ciblé pour une loi et upsert ses amendements.
     * Déclenche ensuite l'enrichissement XML+Mistral en fire-and-forget.
     */
    async ingestAmendements(law: Law): Promise<{ inserted: number; updated: number; skipped: number }> {
        const dossierId = this.extractDossierId(law.externalId);
        if (!dossierId) {
            this.logger.warn(`⚠️ ID numérique introuvable pour ${law.externalId}`);
            return { inserted: 0, updated: 0, skipped: 0 };
        }

        const csvUrl = `${this.CSV_BASE_URL}/${dossierId}/libre_office.csv`;
        this.logger.log(`📥 Amendements CSV pour ${law.externalId} (id=${dossierId})...`);

        let csvText: string;
        try {
            const response = await firstValueFrom(
                this.httpService.get(csvUrl, { timeout: 30000, responseType: 'text', headers: this.HEADERS }),
            );
            csvText = response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                this.logger.log(`ℹ️ Aucun CSV pour ${law.externalId} (404).`);
            } else {
                this.logger.error(`❌ Erreur CSV ${law.externalId}: ${error.message}`);
            }
            return { inserted: 0, updated: 0, skipped: 0 };
        }

        const rows = this.parseCsv(csvText);
        this.logger.log(`📊 ${rows.length} amendement(s) parsés.`);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        const toEnrich: Amendement[] = [];

        for (const row of rows) {
            try {
                const xmlUrl = this.extractXmlUrl(row['URL Amendement format XML']);
                const externalId = this.extractAmendementId(row['URL Amendement format XML']);
                if (!externalId) { skipped++; continue; }

                const statut = this.parseStatut(row['Sort de l\'amendement']);
                const auteur = row['Auteur'] || 'Auteur inconnu';
                const numero = row['Numéro de l\'amendement'] || 'N/A';
                const texte = row['Désignation de l\'article'] || null;
                const sort = row['Sort de l\'amendement'] || null;

                const existing = await this.amendementRepository.findOne({ where: { externalId } });

                if (existing) {
                    let changed = false;
                    if (existing.statut !== statut || existing.sort !== sort) {
                        existing.statut = statut;
                        existing.sort = sort;
                        changed = true;
                    }
                    if (xmlUrl && !existing.xmlUrl) {
                        existing.xmlUrl = xmlUrl;
                        changed = true;
                    }
                    if (changed) {
                        await this.amendementRepository.save(existing);
                        updated++;
                    } else { skipped++; }

                    if (this.needsResume(existing.statut) && !existing.resume) {
                        toEnrich.push(existing);
                    } else if (xmlUrl && (!existing.texte || existing.texte.length < 150)) {
                        // Ajouter systématiquement pour récupérer le texte complet si manquant ou trop court (ex: "Après l'article X")
                        toEnrich.push(existing);
                    }
                } else {
                    const amendement = this.amendementRepository.create({
                        externalId, law, numero, auteur, texte, statut, sort,
                        xmlUrl: xmlUrl ?? undefined,
                    });
                    const saved = await this.amendementRepository.save(amendement);
                    inserted++;
                    // On pousse TOUS les nouveaux amendements qui ont un XML pour extraire leur texte complet
                    if (xmlUrl) toEnrich.push(saved);
                }
            } catch (e) {
                this.logger.error(`❌ Erreur upsert: ${e.message}`);
                skipped++;
            }
        }

        this.logger.log(`✅ ${law.externalId} : ${inserted} insérés, ${updated} mis à jour, ${skipped} ignorés.`);

        if (toEnrich.length > 0) {
            this.logger.log(`🤖 ${toEnrich.length} amendement(s) à enrichir via Mistral...`);
            this.enrichWithMistral(toEnrich).catch(e =>
                this.logger.error(`❌ Enrichissement Mistral : ${e.message}`)
            );
        }

        return { inserted, updated, skipped };
    }

    private needsResume(statut: AmendementStatut | string): boolean {
        return statut === AmendementStatut.ADOPTE || statut === AmendementStatut.REJETE;
    }

    /**
     * Pour chaque amendement avec XML :
     * 1. Fetch le XML AN → extrait dispositif + exposé sommaire pour le texte détaillé (s'il n'existe pas déjà).
     * 2. Si statut ADOPTE/REJETE : Appelle Mistral → 1 phrase neutre et factuelle (s'il n'y a pas déjà de résumé).
     */
    private async enrichWithMistral(amendements: Amendement[]): Promise<void> {
        const mistralApiKey = this.configService.get<string>('MISTRAL_API_KEY');
        const mistralModel = this.configService.get<string>('MISTRAL_MODEL', 'mistral-small-latest');

        if (!mistralApiKey) {
            this.logger.warn('⚠️ MISTRAL_API_KEY non configurée, enrichissement ignoré.');
            return;
        }

        for (const amendement of amendements) {
            try {
                if (!amendement.xmlUrl) continue;

                await new Promise(r => setTimeout(r, 800)); // rate limit
                const xmlText = await this.fetchXml(amendement.xmlUrl);
                if (!xmlText) continue;

                const dispositif = this.extractXmlField(xmlText, 'dispositif');
                const expose = this.extractXmlField(xmlText, 'exposeSommaire');
                const cartouche = this.extractXmlField(xmlText, 'cartoucheInformatif');
                
                let rawText = `${dispositif}\n\n${expose}`.trim();
                if (!rawText && cartouche) {
                    rawText = `[${cartouche}]`;
                }
                
                // On met à jour le champ "texte" avec le vrai contenu de l'amendement
                // s'il était encore sur un texte court comme "Article XX" ou "Après l'article XX"
                let needSave = false;
                if (rawText && rawText.length > 20 && amendement.texte !== rawText) {
                    amendement.texte = rawText;
                    needSave = true;
                    this.logger.log(`📄 Texte XML extrait pour ${amendement.externalId}`);
                }

                if (rawText && rawText.length > 20 && this.needsResume(amendement.statut) && !amendement.resume) {
                    if (!mistralApiKey) {
                        this.logger.warn(`⚠️ Pas de clé Mistral, résumé ignoré pour ${amendement.externalId}`);
                    } else {
                        const resume = await this.callMistral(rawText, mistralApiKey, mistralModel);
                        if (resume) {
                            amendement.resume = resume;
                            needSave = true;
                            this.logger.log(`✅ Résumé généré pour ${amendement.externalId} : "${resume.substring(0, 80)}..."`);
                        }
                    }
                }

                if (needSave) {
                    await this.amendementRepository.save(amendement);
                }

            } catch (e) {
                this.logger.warn(`⚠️ Enrichissement ${amendement.externalId} : ${e.message}`);
            }
        }
    }

    private async fetchXml(url: string): Promise<string | null> {
        try {
            const resp = await firstValueFrom(
                this.httpService.get(url, { timeout: 15000, responseType: 'text', headers: this.HEADERS })
            );
            return resp.data;
        } catch {
            return null;
        }
    }

    private extractXmlField(xml: string, tag: string): string {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = xml.match(regex);
        if (!match) return '';
        
        const rawHtml = match[1];
        return he.decode(he.decode(rawHtml))
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);
    }

    private async callMistral(rawText: string, apiKey: string, model: string): Promise<string | null> {
        try {
            const prompt = `Voici le texte d'un amendement parlementaire français :\n\n${rawText}\n\nEn une seule phrase courte et factuelle (15 à 25 mots maximum), décris ce que propose cet amendement sur le plan légal, sans jugement de valeur ni positionnement politique. Ne commence pas par "Cet amendement". Réponds uniquement avec la phrase, sans guillemets.`;

            const resp = await firstValueFrom(
                this.httpService.post(
                    'https://api.mistral.ai/v1/chat/completions',
                    { model, max_tokens: 80, temperature: 0.2, messages: [{ role: 'user', content: prompt }] },
                    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
                )
            );
            return resp.data?.choices?.[0]?.message?.content?.trim() || null;
        } catch (e) {
            this.logger.error(`❌ Mistral : ${e.message}`);
            return null;
        }
    }

    async ingestAllOnAgendaLaws(): Promise<void> {
        const laws = await this.lawRepository.find({
            where: [
                { isOnAgenda: true },
                { status: 'PENDING' as any },
                { status: 'VOTED_AN' as any }
            ]
        });
        this.logger.log(`📋 Ingestion amendements pour ${laws.length} loi(s)...`);
        let total = 0;
        for (const law of laws) {
            const result = await this.ingestAmendements(law);
            total += result.inserted + result.updated;
            await new Promise(r => setTimeout(r, 1000));
        }
        this.logger.log(`🎉 Ingestion terminée : ${total} amendement(s) traités.`);
    }

    // ── Utilitaires ──────────────────────────────────────────────

    private extractXmlUrl(xmlUrlField: string): string | null {
        if (!xmlUrlField || !xmlUrlField.startsWith('http')) return null;
        return xmlUrlField.trim();
    }

    private extractAmendementId(xmlUrl: string): string | null {
        if (!xmlUrl) return null;
        const match = xmlUrl.match(/\/([A-Z0-9]+)\.xml$/);
        return match ? `AN_${match[1]}` : null;
    }

    private parseStatut(sort: string | null): AmendementStatut {
        if (!sort) return AmendementStatut.EN_DISCUSSION;
        const s = sort.toLowerCase();
        if (s.includes('adopt')) return AmendementStatut.ADOPTE;
        if (s.includes('rejet')) return AmendementStatut.REJETE;
        if (s.includes('retir')) return AmendementStatut.RETIRE;
        if (s.includes('tomb')) return AmendementStatut.TOMBE;
        if (s.includes('non défendu') || s.includes('non soutenu')) return AmendementStatut.NON_DEFENDU;
        return AmendementStatut.EN_DISCUSSION;
    }

    parseCsv(csvText: string): Record<string, string>[] {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = this.parseCsvLine(lines[0]);
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length < headers.length) continue;
            const row: Record<string, string> = {};
            for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j] ?? '';
            rows.push(row);
        }
        return rows;
    }

    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }
}
