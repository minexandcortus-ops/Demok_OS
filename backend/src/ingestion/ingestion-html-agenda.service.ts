import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Law, LawStatus } from '../laws/law.entity';
import { IngestionANService } from './ingestion-an.service';
import { SummaryUpdaterService } from './summary-updater.service';
import { AmendementIngestionService } from './amendement-ingestion.service';

const FRENCH_MONTHS: Record<string, string> = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
};

interface AgendaEntry {
    title: string;
    date: string; // ISO "YYYY-MM-DD"
    externalId: string; // "DLR5L17N53456"
}

@Injectable()
export class IngestionHtmlAgendaService {
    private readonly logger = new Logger(IngestionHtmlAgendaService.name);
    /** Cache du buffer brut du ZIP pour éviter 2 téléchargements par sync */
    private _zipBufferCache: { buffer: Buffer; timestamp: number } | null = null;
    private readonly ZIP_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

    constructor(
        private readonly httpService: HttpService,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        private readonly ingestionANService: IngestionANService,
        private readonly summaryUpdaterService: SummaryUpdaterService,
        private readonly amendementIngestionService: AmendementIngestionService,
    ) { }

    /**
     * Scrape l'ordre du jour de l'Assemblée Nationale directement depuis le site officiel.
     * URL source : https://www.assemblee-nationale.fr/dyn/seance-publique/textes-inscrits-ordre-du-jour
     * 
     * La page HTML contient des blocs <span class="h3">Lundi 30 mars 2026</span>
     * suivis de <a class="link" href="/dyn/17/dossiers/DLR..."> avec le titre de la loi.
     */
    private async scrapeAgendaFromAN(): Promise<AgendaEntry[]> {
        const url = 'https://www.assemblee-nationale.fr/dyn/seance-publique/textes-inscrits-ordre-du-jour';
        this.logger.log(`🌐 Scraping de l'ordre du jour officiel AN : ${url}`);

        const response = await firstValueFrom(
            this.httpService.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9',
                },
            })
        );

        const html: string = response.data;
        return this.parseAgendaHtml(html);
    }

    /**
     * Parse le HTML de la page d'ordre du jour.
     * Extrait les dates et les lois en associant chaque loi à la date la plus récente trouvée.
     */
    parseAgendaHtml(html: string): AgendaEntry[] {
        const entries: AgendaEntry[] = [];

        // Regex 1 : trouver les blocs de dates
        // Matches: <span class="h3">Lundi 30 mars 2026</span>
        const dateBlockRegex = /<span class="h3">([^<]+\d{4})<\/span>([\s\S]*?)(?=<span class="h3">|<\/ul>\s*<\/li>\s*<\/ul>|$)/g;
        let dateMatch: RegExpExecArray | null;

        while ((dateMatch = dateBlockRegex.exec(html)) !== null) {
            const rawDate = dateMatch[1].trim();
            const blockHtml = dateMatch[2];

            // Convertir "Lundi 30 mars 2026" → "2026-03-30"
            const isoDate = this.parseFrenchDate(rawDate);
            if (!isoDate) {
                this.logger.warn(`⚠️ Date non parseable : "${rawDate}"`);
                continue;
            }

            // Régex 2 : trouver TOUS les liens /dyn/17/dossiers/** dans ce bloc
            // Matches: DLR → externalId direct. Slug → sera résolu via ZIP.
            const lawLinkRegex = /<a class="link" href="\/dyn\/17\/dossiers\/([^"]+)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/g;
            let lawMatch: RegExpExecArray | null;

            while ((lawMatch = lawLinkRegex.exec(blockHtml)) !== null) {
                const ref = lawMatch[1].trim(); // DLR5L17N53456 ou accelerer_prevention_...
                // Ignorer les mouvements de censure et autres non-lois
                if (ref.includes('motion_censure') || ref.includes('budget')) continue;

                // nettoyer les HTML entities et espaces multiples
                const title = lawMatch[2]
                    .replace(/&#039;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (ref && title) {
                    entries.push({ title, date: isoDate, externalId: ref });
                    this.logger.debug(`  📌 [${isoDate}] ${ref} — ${title.substring(0, 60)}...`);
                }
            }
        }

        return entries;
    }

    /**
     * Convertit une date française en ISO.
     * Ex: "Lundi 30 mars 2026" → "2026-03-30"
     * Ex: "Vendredi 1er mai 2026" → "2026-05-01"
     */
    parseFrenchDate(raw: string): string | null {
        // Capturer : (1er ou numérique) + (mois) + (année)
        const match = raw.match(/(\d+er?|\d+)\s+(\S+)\s+(\d{4})/i);
        if (!match) return null;

        // Normaliser le jour : "1er" → 1, "30" → 30
        const dayNum = parseInt(match[1].replace(/er$/, ''), 10);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return null;
        const day = String(dayNum).padStart(2, '0');

        const monthRaw = match[2].toLowerCase();
        const monthNorm = monthRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const year = match[3];

        const monthNum = FRENCH_MONTHS[monthRaw] || FRENCH_MONTHS[monthNorm];
        if (!monthNum) return null;

        return `${year}-${monthNum}-${day}`;
    }

    /**
     * Retourne le buffer ZIP des dossiers législatifs, avec cache 12h.
     * Évite de re-télécharger 50MB à chaque sync.
     */
    private async getZipBuffer(): Promise<Buffer> {
        if (this._zipBufferCache && (Date.now() - this._zipBufferCache.timestamp) < this.ZIP_CACHE_TTL_MS) {
            this.logger.debug('💾 ZIP buffer servi depuis le cache local.');
            return this._zipBufferCache.buffer;
        }
        const buffer = await this.ingestionANService.downloadDossiersZip();
        this._zipBufferCache = { buffer, timestamp: Date.now() };
        return buffer;
    }

    async syncFromHtml(): Promise<any> {
        this.logger.log('🌐 Synchronisation depuis l\'ordre du jour officiel de l\'AN...');

        try {
            // Étape 1 : Scraper la page AN pour obtenir les lois à l'agenda
            const scrapedLaws = await this.scrapeAgendaFromAN();
            this.logger.log(`🔍 ${scrapedLaws.length} loi(s) scrapée(s) depuis l'ordre du jour AN.`);

            if (scrapedLaws.length === 0) {
                this.logger.warn('⚠️ Aucune loi trouvée sur la page AN. Vérifier la structure HTML.');
                return { total: 0, matched: 0, imported: 0, updated: 0 };
            }

            // Étape 2 : Réinitialiser les statuts agenda pour les lois FUTURES non présentes dans l'agenda actuel.
            // IMPORTANT: On NE touche PAS aux agendaDate passées (< aujourd'hui) pour que
            // syncDeputyVotes puisse encore trouver ces lois et récupérer leurs résultats de vote.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            await this.lawRepository.createQueryBuilder()
                .update(Law)
                .set({ isOnAgenda: false, agendaDate: null })
                .where('status NOT IN (:...statuses)', { statuses: [LawStatus.VOTED_AN, LawStatus.VALIDATED, LawStatus.REJECTED] })
                .andWhere('(agendaDate IS NULL OR agendaDate >= :today)', { today })
                .execute();

            // Étape 2b : Charger le ZIP (avec cache) pour résoudre les slugs (ex: accelerer_...)
            this.logger.log('📦 Chargement du ZIP pour résolution des slugs...');
            const AdmZip = require('adm-zip');
            const zipBuffer = await this.getZipBuffer();
            const zip = new AdmZip(zipBuffer);

            // Construire un index slug → uid depuis le ZIP
            const slugToUid = new Map<string, string>();
            for (const entry of zip.getEntries()) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(zip.readAsText(entry));
                    const dossier = data.dossierParlementaire || data;
                    const uid = dossier.uid;
                    const chemin = dossier.titreDossier?.titreChemin || dossier.titreChemin;
                    if (uid && chemin) {
                        slugToUid.set(chemin.toLowerCase(), uid);
                    }
                } catch { /* skip bad json */ }
            }
            this.logger.log(`🗺️ ${slugToUid.size} slugs indexés depuis le ZIP.`);

            // Étape 3 : Pour chaque loi scrapée, trouver ou importer en DB
            let importedCount = 0;
            let updatedCount = 0;

            for (const scraped of scrapedLaws) {
                // Résoudre le ref : DLR direct ou slug → uid via l'index ZIP
                let resolvedId = scraped.externalId;
                if (!resolvedId.startsWith('DLR')) {
                    // Essayer d'abord sans _17e (suffixe ajouté par AN)
                    const cleanSlug = resolvedId.replace(/_17e$/, '').toLowerCase();
                    const uid = slugToUid.get(cleanSlug) || slugToUid.get(resolvedId.toLowerCase());
                    if (uid) {
                        this.logger.debug(`🔗 Slug résolu: ${resolvedId} → ${uid}`);
                        resolvedId = uid;
                    } else {
                        this.logger.warn(`⚠️ Slug non résolu : "${resolvedId}" — "${scraped.title.substring(0, 60)}"`);
                        continue;
                    }
                }

                // Chercher EN DB par externalId (avec et sans préfixe AN_)
                let laws = await this.lawRepository.find({
                    where: [
                        { externalId: `AN_${resolvedId}` },
                        { externalId: resolvedId },
                    ],
                });

                // Si elle n'existe pas encore → l'importer depuis le ZIP
                if (laws.length === 0) {
                    this.logger.log(`📦 Importation de ${resolvedId}...`);
                    const imported = await this.ingestionANService.importSpecificLaws([resolvedId]);
                    if (imported.length > 0) {
                        const saved = await this.lawRepository.save(imported[0]);
                        laws = [saved];
                        importedCount++;
                        this.logger.log(`✅ Importée : ${resolvedId} — "${scraped.title.substring(0, 60)}"`);

                        // 🤖 Résumé IA immédiat
                        try {
                            await this.summaryUpdaterService.updateSummary(saved);
                            this.logger.log(`🤖 Résumé IA généré pour : "${saved.titleOfficial?.substring(0, 50)}"`);
                        } catch (e) {
                            this.logger.warn(`⚠️ Résumé IA échoué pour ${resolvedId} (sera retenté cette nuit) : ${e.message}`);
                        }

                        // 📋 Amendements : ingestion CSV immédiate (trigger 1)
                        try {
                            const amd = await this.amendementIngestionService.ingestAmendements(saved);
                            this.logger.log(`📋 Amendements importés pour ${resolvedId} : ${amd.inserted} insérés, ${amd.updated} mis à jour.`);
                        } catch (e) {
                            this.logger.warn(`⚠️ Amendements échoués pour ${resolvedId} (sera retenté cette nuit) : ${e.message}`);
                        }
                    } else {
                        this.logger.warn(`⚠️ Impossible d'importer ${resolvedId} — "${scraped.title.substring(0, 60)}"`);
                        continue;
                    }
                }

                // Marquer toutes les versions trouvées comme étant à l'ordre du jour
                for (const law of laws) {
                    const newDate = new Date(scraped.date);
                    const isFuture = newDate > today;

                    law.isOnAgenda = true;
                    law.agendaDate = newDate;

                    if (isFuture) {
                         // Si la date est future, elle repasse en UPCOMING pour revenir en haut du fil "À venir"
                         if (law.status !== LawStatus.UPCOMING) {
                             this.logger.log(`🔄 Reprogrammation : "${law.titleOfficial?.substring(0, 40)}..." -> UPCOMING (prévue le ${scraped.date})`);
                             law.status = LawStatus.UPCOMING;
                             law.voteDate = null;
                             law.deputyVoteResult = null;
                         }
                    } else if (newDate.getTime() === today.getTime()) {
                         // Si c'est aujourd'hui, on s'assure qu'elle est en PENDING (En discussion)
                         if (law.status === LawStatus.UPCOMING) {
                             law.status = LawStatus.PENDING;
                         }
                    }

                    await this.lawRepository.save(law);
                    updatedCount++;
                }
            }

            this.logger.log(`🎉 Sync terminée : ${updatedCount} loi(s) à l'agenda, ${importedCount} importée(s).`);

            return {
                total: scrapedLaws.length,
                matched: scrapedLaws.length,
                imported: importedCount,
                updated: updatedCount,
                laws: scrapedLaws.map(l => ({ date: l.date, id: l.externalId, title: l.title.substring(0, 70) })),
            };

        } catch (error) {
            this.logger.error(`❌ Erreur lors de la synchronisation: ${error.message}`);
            return { error: error.message };
        }
    }

}
