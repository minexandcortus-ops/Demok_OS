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
            this.logger.log(`🔄 Appel Mistral AI (modèle: ${mistralModel}) pour titre et résumé (Classique + Mode Rue)...`);

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
                            content: `Tu es un expert législatif et vulgarisateur pour l'application citoyenne Démok.
Ta tâche est d'analyser un texte de loi et de produire DEUX versions de vulgarisation :
1) Une version "classique" : neutre, claire, factuelle et accessible au grand public (style institutionnel vulgarisé).
2) Une version "rue" : en langage urbain / argot des cités moderne, débridé, dynamique et percutant, tout en restant 100% fidèle au fond de la loi, impartial et sans inventer de fausses informations.

Pour la version "rue" :
- Titre : percutant, drôle avec des expressions de rue (ex: "Tickets Resto : la fin des galères pour grailler ?").
- Résumé : 3-4 phrases en langage parlé urbain naturel, vivant et percutant. DIVERSIFIE impérativement les accroches et débuts de résumé pour éviter toute répétition : alterne entre des tournures variées (ex: "Pour la faire courte...", "Ce que ça raconte...", "Ce que ça dit en vrai...", "Le topo ici c'est que...", "En gros...", "Si on résume le bail...", "Concrètement...", "L'idée derrière ce texte...", etc.). N'utilise PAS toujours la même intro !
- Arguments pour ("Les bails bien") : 2-3 arguments factuels formulés en langage de rue / familier.
- Arguments contre ("Les bails qui coincent") : 2-3 arguments factuels formulés en langage de rue / familier.

Réponds UNIQUEMENT avec un objet JSON valide suivant scrupuleusement cette structure :
{
    "classique": {
        "titre": "Un titre vulgarisé clair et percutant (max 10-15 mots)",
        "resume": "Un résumé clair et accessible en 3-4 phrases",
        "arguments_pour": ["Argument 1", "Argument 2"],
        "arguments_contre": ["Argument 1", "Argument 2"]
    },
    "rue": {
        "titre": "Un titre en langage de rue percutant",
        "resume": "Le résumé en langage rue / argot accessible et vivant",
        "arguments_pour": ["Argument 1 rue", "Argument 2 rue"],
        "arguments_contre": ["Argument 1 rue", "Argument 2 rue"]
    }
}
Sois parfaitement objectif et équilibré sur le fond juridique dans les deux versions.`,
                        },
                        {
                            role: 'user',
                            content: `Analyse ce texte :\nTitre officiel : ${law.titleOfficial}\nContenu brut : ${law.rawText ? law.rawText.substring(0, 4000) : (law.titleVulgarized || law.titleOfficial)}`,
                        },
                    ],
                    response_format: { type: "json_object" },
                    max_tokens: 1200,
                }),
            });

            if (!response.ok) {
                throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parsing de la réponse JSON
            let aiResult: any;
            try {
                aiResult = JSON.parse(content);
            } catch (e) {
                this.logger.warn('⚠️ Mistral a renvoyé du texte brut, tentative de récupération...');
                aiResult = {
                    classique: {
                        titre: null,
                        resume: content,
                        arguments_pour: [],
                        arguments_contre: []
                    }
                };
            }

            const classique = aiResult.classique || {
                titre: aiResult.titre,
                resume: aiResult.resume,
                arguments_pour: aiResult.arguments_pour,
                arguments_contre: aiResult.arguments_contre,
            };

            const rue = aiResult.rue;

            this.logger.log(`✅ Résumé IA Classique généré (${classique?.resume?.length || 0} chars)`);

            // Mettre à jour avec le résumé Classique
            if (classique?.resume) {
                defaultSummary.sections['Résumé'] = classique.resume.replace(/[ \t]+/g, ' ').trim();

                if (classique.arguments_pour && Array.isArray(classique.arguments_pour) && classique.arguments_pour.length > 0) {
                    defaultSummary.sections['Arguments Pour'] = classique.arguments_pour.map((p: string) => `• ${p.trim()}`).join('\n');
                }
                if (classique.arguments_contre && Array.isArray(classique.arguments_contre) && classique.arguments_contre.length > 0) {
                    defaultSummary.sections['Arguments Contre'] = classique.arguments_contre.map((p: string) => `• ${p.trim()}`).join('\n');
                }
            } else {
                defaultSummary.sections['Résumé'] = `Cette loi a été mise à jour le ${new Date().toLocaleDateString('fr-FR')}. Contenu principal : ${law.titleOfficial}.`;
            }

            // Mettre à jour le titre vulgarisé si fourni
            if (classique?.titre && classique.titre.length > 5) {
                const cleanTitre = classique.titre.replace(/\s+/g, ' ').trim();
                law.titleVulgarized = cleanTitre;
                this.logger.log(`✅ Titre vulgarisé mis à jour : "${cleanTitre}"`);
            }

            // Mettre à jour avec le Mode Rue si fourni
            if (rue && rue.resume) {
                const streetSummary: any = {
                    titleVulgarized: rue.titre ? rue.titre.replace(/\s+/g, ' ').trim() : undefined,
                    sections: {},
                    pro: rue.arguments_pour || [],
                    con: rue.arguments_contre || [],
                };
                streetSummary.sections['Résumé'] = rue.resume.replace(/[ \t]+/g, ' ').trim();
                if (rue.arguments_pour && Array.isArray(rue.arguments_pour) && rue.arguments_pour.length > 0) {
                    streetSummary.sections['Arguments Pour'] = rue.arguments_pour.map((p: string) => `• ${p.trim()}`).join('\n');
                }
                if (rue.arguments_contre && Array.isArray(rue.arguments_contre) && rue.arguments_contre.length > 0) {
                    streetSummary.sections['Arguments Contre'] = rue.arguments_contre.map((p: string) => `• ${p.trim()}`).join('\n');
                }
                law.summaryStreet = streetSummary;
                this.logger.log(`✅ Mode Rue généré (${streetSummary.sections['Résumé'].length} chars)`);
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

    /**
     * Met à jour les résumés Mode Rue pour les lois à l'ordre du jour
     */
    async updateStreetSummariesForAgenda(): Promise<{ processed: number; skipped: number; total: number }> {
        this.logger.log('🔍 Recherche des lois à l\'agenda sans Mode Rue...');
        const laws = await this.lawRepository.find({
            where: { isOnAgenda: true },
        });

        let processed = 0;
        let skipped = 0;

        for (const law of laws) {
            try {
                if (law.summaryStreet && law.summaryStreet.sections && Object.keys(law.summaryStreet.sections).length > 0) {
                    skipped++;
                    continue;
                }
                await this.updateSummary(law);
                processed++;
                this.logger.log(`✅ [${processed}/${laws.length}] Mode Rue généré pour : ${law.titleOfficial?.substring(0, 50)}...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                this.logger.error(`❌ Erreur Mode Rue sur ${law.externalId}: ${error.message}`);
                skipped++;
            }
        }

        this.logger.log(`✅ Génération Mode Rue terminée : ${processed} traitées, ${skipped} ignorées`);
        return { processed, skipped, total: laws.length };
    }

    /**
     * Diversifie les intros du Mode Rue ("En gros", "Pour la faire courte", etc.)
     */
    async diversifyStreetIntros(): Promise<{ modified: number; total: number }> {
        this.logger.log('🎨 Diversification des accroches Mode Rue...');
        const laws = await this.lawRepository.find();

        const variations = [
            'En gros,',
            'Pour la faire courte,',
            'Ce que ça dit en clair,',
            'Si on résume l\'affaire,',
            'Concrètement,',
            'Le topo ici :',
            'Pour résumer le bail,',
            'Version express :',
        ];

        let modified = 0;
        let countWithStreet = 0;

        for (let i = 0; i < laws.length; i++) {
            const law = laws[i];
            const resume = law.summaryStreet?.sections?.['Résumé'];
            if (!resume) continue;
            countWithStreet++;

            const match = resume.match(/^En gros,?\s*/i);
            if (match) {
                const pick = variations[modified % variations.length];
                const restOfResume = resume.slice(match[0].length).trim();
                const firstChar = restOfResume.charAt(0).toLowerCase();
                const remainder = restOfResume.slice(1);

                law.summaryStreet.sections['Résumé'] = `${pick} ${firstChar}${remainder}`;
                await this.lawRepository.save(law);
                modified++;
            }
        }

        this.logger.log(`✅ Diversification terminée : ${modified} lois diversifiées sur ${countWithStreet}.`);
        return { modified, total: countWithStreet };
    }
}
