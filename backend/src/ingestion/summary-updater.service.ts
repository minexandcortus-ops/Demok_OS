import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Law } from '../laws/law.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SummaryUpdaterService {
    private readonly logger = new Logger(SummaryUpdaterService.name);

    constructor(
        @InjectRepository(Law)
        private lawRepository: Repository<Law>,
        private configService: ConfigService,
    ) { }

    /**
     * Régénère le résumé d'une loi via Mistral AI
     * PHASE 3 : MISTRAL AI ACTIVÉ + OPTIMISATION (seuil 10%)
     */
    async updateSummary(law: Law, oldContent?: string): Promise<void> {
        this.logger.log(`🤖 Régénération résumé IA pour : ${law.titleOfficial}`);

        // Optimisation : Calculer le % de changement
        if (oldContent) {
            const newContent = `${law.titleOfficial} ${law.titleVulgarized || ''}`;
            const changePercentage = this.calculateChangePercentage(oldContent, newContent);

            if (changePercentage < 10) {
                this.logger.log(`⏭️ Changement mineur (${changePercentage.toFixed(1)}%), résumé conservé`);
                return; // Pas besoin de régénérer
            }

            this.logger.log(`📊 Changement significatif (${changePercentage.toFixed(1)}%), régénération IA...`);
        }

        // Résumé par défaut (fallback)
        const defaultSummary: any = {
            sections: {},
            pro: [
                'Mise \u00e0 jour du contenu l\u00e9gislatif',
                'Am\u00e9lioration des dispositions',
            ],
            con: [
                'N\u00e9cessite une nouvelle analyse',
                'Impact \u00e0 \u00e9valuer',
            ],
        };

        // PHASE 3 : Code réel avec Mistral AI
        const mistralApiKey = this.configService.get<string>('MISTRAL_API_KEY');
        const mistralModel = this.configService.get<string>('MISTRAL_MODEL', 'mistral-small-latest');

        if (!mistralApiKey) {
            this.logger.warn('⚠️ MISTRAL_API_KEY non configurée, résumé mock utilisé');
            defaultSummary.sections['R\u00e9sum\u00e9'] = `Cette loi a \u00e9t\u00e9 mise \u00e0 jour le ${new Date().toLocaleDateString('fr-FR')}. Contenu principal : ${law.titleOfficial}.`;
            law.summary = defaultSummary;
            await this.lawRepository.save(law);
            return;
        }

        try {
            this.logger.log(`🔄 Appel Mistral AI (modèle: ${mistralModel}) pour titre et résumé...`);

            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${mistralApiKey}`,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    model: mistralModel,
                    messages: [
                        {
                            role: 'system',
                            content: `Tu es un expert législatif. Ta tâche est de vulgariser des textes de loi pour le grand public.
                            Réponds UNIQUEMENT avec un objet JSON valide suivant cette structure :
                            {
                                "titre": "Un titre court et percutant (max 10-15 mots)",
                                "resume": "Un résumé clair et accessible en 3-4 phrases",
                                "arguments_pour": ["Argument 1", "Argument 2", "..."],
                                "arguments_contre": ["Argument 1", "Argument 2", "..."]
                            }
                            Sois objectif et équilibré. Base-toi STRICTEMENT sur le texte fourni pour extraire les arguments réels en faveur et en défaveur de la proposition, de manière factuelle et neutre. Ne devine pas d'arguments non mentionnés ou implicites.`,
                        },
                        {
                            role: 'user',
                            content: `Analyse ce texte :\nTitre officiel : ${law.titleOfficial}\nContenu brut : ${law.rawText ? law.rawText.substring(0, 4000) : (law.titleVulgarized || law.titleOfficial)}`,
                        },
                    ],
                    response_format: { type: "json_object" }, // Nouveau paramètre Mistral si supporté, sinon le prompt system suffit souvent
                    max_tokens: 600,
                }),
            });

            if (!response.ok) {
                throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parsing de la réponse JSON
            let aiResult;
            try {
                aiResult = JSON.parse(content);
            } catch (e) {
                // Fallback si l'IA renvoie du texte brut malgré la consigne
                this.logger.warn('⚠️ Mistral a renvoyé du texte brut, tentative de récupération...');
                aiResult = {
                    titre: null,
                    resume: content,
                    arguments_pour: [],
                    arguments_contre: []
                };
            }

            this.logger.log(`✅ Résumé IA généré (${aiResult.resume?.length || 0} chars, ${aiResult.arguments_pour?.length || 0} pour, ${aiResult.arguments_contre?.length || 0} contre)`);

            // Mettre à jour avec le résumé IA
            if (aiResult.resume) {
                // Sanitize whitespace but KEEP newlines for formatting
                defaultSummary.sections['R\u00e9sum\u00e9'] = aiResult.resume.replace(/[ \t]+/g, ' ').trim();

                // Ajouter les arguments Pour
                if (aiResult.arguments_pour && Array.isArray(aiResult.arguments_pour) && aiResult.arguments_pour.length > 0) {
                    defaultSummary.sections['Arguments Pour'] = aiResult.arguments_pour.map(p => `\u2022 ${p.trim()}`).join('\n');
                }
                // Ajouter les arguments Contre
                if (aiResult.arguments_contre && Array.isArray(aiResult.arguments_contre) && aiResult.arguments_contre.length > 0) {
                    defaultSummary.sections['Arguments Contre'] = aiResult.arguments_contre.map(p => `\u2022 ${p.trim()}`).join('\n');
                }
            } else {
                // Fallback si l'IA n'a pas renvoyé de résumé
                defaultSummary.sections['R\u00e9sum\u00e9'] = `Cette loi a \u00e9t\u00e9 mise \u00e0 jour le ${new Date().toLocaleDateString('fr-FR')}. Contenu principal : ${law.titleOfficial}.`;
            }

            // Mettre à jour le titre vulgarisé si fourni et pertinent
            if (aiResult.titre && aiResult.titre.length > 5) {
                const cleanTitre = aiResult.titre.replace(/\s+/g, ' ').trim();
                law.titleVulgarized = cleanTitre;
                this.logger.log(`✅ Titre vulgarisé mis à jour : "${cleanTitre}"`);
            }

        } catch (error) {
            this.logger.error(`❌ Erreur Mistral AI: ${error.message}`);
            this.logger.log('📦 Utilisation du résumé par défaut (fallback)');
            defaultSummary.sections['R\u00e9sum\u00e9'] = `Cette loi a \u00e9t\u00e9 mise \u00e0 jour le ${new Date().toLocaleDateString('fr-FR')}. Contenu principal : ${law.titleOfficial}.`;
        }

        // Sauvegarder le nouveau résumé
        law.summary = defaultSummary;
        await this.lawRepository.save(law);

        this.logger.log(`✅ Résumé mis à jour pour : ${law.titleOfficial}`);
    }

    /**
     * Calcule le pourcentage de changement entre deux contenus
     * Utilise la distance de Levenshtein simplifiée
     */
    private calculateChangePercentage(oldContent: string, newContent: string): number {
        if (!oldContent || !newContent) return 100;
        if (oldContent === newContent) return 0;

        // Méthode simple : comparer caractère par caractère
        const maxLength = Math.max(oldContent.length, newContent.length);
        let differences = 0;

        for (let i = 0; i < maxLength; i++) {
            if (oldContent[i] !== newContent[i]) {
                differences++;
            }
        }

        return (differences / maxLength) * 100;
    }

    /**
     * Met à jour UNIQUEMENT les lois qui n'ont pas encore de résumé IA
     * Optimisé pour le cron daily afin d'éviter les coûts Mistral inutiles
     */
    async updateRecentSummaries(): Promise<{ processed: number; skipped: number }> {
        this.logger.log('🔍 Recherche des lois sans résumé IA...');

        // Lois à l'agenda qui n'ont pas encore de résumé IA complet
        // Utiliser IsNull() pour générer un vrai WHERE IS NULL en SQL
        const lawsNeedingSummary = await this.lawRepository.find({
            where: [
                { isOnAgenda: true, summary: IsNull() },
                { isOnAgenda: true, titleVulgarized: IsNull() },
            ],
        });

        this.logger.log(`📊 ${lawsNeedingSummary.length} lois sans résumé trouvées`);

        let processed = 0;
        let skipped = 0;

        for (const law of lawsNeedingSummary) {
            try {
                // Vérifier si la loi a déjà un résumé valide
                if (law.titleVulgarized && law.summary) {
                    skipped++;
                    continue;
                }

                await this.updateSummary(law);
                processed++;
                this.logger.log(`✅ [${processed}/${lawsNeedingSummary.length}] ${law.titleOfficial?.substring(0, 50)}...`);

                // Rate limiting: attendre 1 seconde entre chaque appel API
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                this.logger.error(`❌ Erreur sur ${law.externalId}: ${error.message}`);
                skipped++;
            }
        }

        this.logger.log(`✅ Traitement terminé : ${processed} lois traitées, ${skipped} ignorées`);
        return { processed, skipped };
    }

    /**
     * 🧹 Sanitisation nocturne : Nettoie les données corrompues dans la base.
     * Ex: titleVulgarized qui contient un slug URL avec underscores_comme_ceci
     * Appelé automatiquement par le cron daily avant les autres étapes.
     */
    async sanitizeBadData(): Promise<{ fixed: number }> {
        this.logger.log('🧹 Sanitisation des données corrompues...');
        let fixed = 0;

        const allLaws = await this.lawRepository.find();

        for (const law of allLaws) {
            let dirty = false;

            // Règle 1 : titleVulgarized contient des underscores sans espaces → c'est un slug, pas un titre
            if (law.titleVulgarized && law.titleVulgarized.includes('_') && !law.titleVulgarized.includes(' ')) {
                this.logger.warn(`⚠️ Slug détecté dans titleVulgarized, nettoyage : ${law.externalId} => "${law.titleVulgarized}"`);
                law.titleVulgarized = null;
                dirty = true;
            }

            if (dirty) {
                await this.lawRepository.save(law);
                fixed++;
            }
        }

        this.logger.log(`🧹 Sanitisation terminée : ${fixed} loi(s) corrigée(s).`);
        return { fixed };
    }
}
