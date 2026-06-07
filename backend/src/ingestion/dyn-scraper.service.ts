import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { VoteChoice } from '../votes/vote.types';

export interface ScrapedScrutinDetails {
    pour: number;
    contre: number;
    abstention: number;
    total: number;
    adopted: boolean;
    dateScrutin: string;
    dossierSlug?: string;
    groupVotes: Array<{
        groupName: string;
        groupOrganId: string;
        votes: Array<{
            deputyName: string;
            deputyAnRef: string;
            choice: VoteChoice;
        }>;
    }>;
}

@Injectable()
export class DynScraperService {
    private readonly logger = new Logger(DynScraperService.name);

    constructor(private readonly httpService: HttpService) {}

    /**
     * Scrape la liste des derniers scrutins (ex: pour pallier le délai de l'OpenData)
     */
    async scrapeRecentScrutinsList(): Promise<{ id: string, title: string }[]> {
        const url = 'https://www.assemblee-nationale.fr/dyn/17/scrutins';
        this.logger.log(`🔍 Récupération de la liste globale des scrutins : ${url}`);
        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 10000
                })
            );
            const $ = cheerio.load(response.data);
            const list: { id: string, title: string }[] = [];
            $('a[href^="/dyn/17/scrutins/"]').each((_, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                if (title.length > 20 && !title.includes("Analyse complète du scrutin")) {
                    const id = href.split('/').pop();
                    if (id) {
                        list.push({ id, title });
                    }
                }
            });
            this.logger.log(`🎯 ${list.length} scrutins récents trouvés sur la page globale.`);
            return list;
        } catch (error) {
            this.logger.error(`❌ Impossible de récupérer la liste des scrutins : ${error.message}`);
            return [];
        }
    }

    /**
     * Scrape l'ID du scrutin public depuis la page du dossier législatif de la 17e législature.
     * @param dossierSlug Le slug ou chemin relatif du dossier (ex: "montagne_vivante_souveraine_17e")
     */
    async scrapeScrutinIdFromDossier(dossierSlug: string): Promise<string | null> {
        const url = dossierSlug.startsWith('http') 
            ? dossierSlug 
            : `https://www.assemblee-nationale.fr/dyn/17/dossiers/${dossierSlug}`;
        
        this.logger.log(`🔍 Vérification du scrutin sur le dossier dynamic : ${url}`);
        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 10000
                })
            );
            const $ = cheerio.load(response.data);
            
            // Cherche tous les liens pointant vers un scrutin de la 17e législature
            let scrutinId: string | null = null;
            $('a[href^="/dyn/17/scrutins/"]').each((_, element) => {
                const href = $(element).attr('href');
                if (href) {
                    const id = href.split('/').pop();
                    if (id && id.trim()) {
                        scrutinId = id.trim();
                        return false; // Break loop
                    }
                }
            });

            // Si non trouvé, on cherche dans les blocs AJAX (data-content)
            if (!scrutinId) {
                const embedUrls: string[] = [];
                $('[data-content]').each((_, element) => {
                    const dataContent = $(element).attr('data-content');
                    if (dataContent && dataContent.includes('/scrutins')) {
                        embedUrls.push(dataContent);
                    }
                });

                for (const embedUrl of embedUrls) {
                    const fullEmbedUrl = embedUrl.startsWith('http') ? embedUrl : `https://www.assemblee-nationale.fr${embedUrl}`;
                    this.logger.log(`🔍 Chargement du fragment AJAX : ${fullEmbedUrl}`);
                    try {
                        const embedResponse = await firstValueFrom(
                            this.httpService.get(fullEmbedUrl, {
                                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                                timeout: 10000
                            })
                        );
                        const $embed = cheerio.load(embedResponse.data);
                        $embed('a[href^="/dyn/17/scrutins/"]').each((_, element) => {
                            const href = $embed(element).attr('href');
                            if (href) {
                                const id = href.split('/').pop();
                                if (id && id.trim()) {
                                    scrutinId = id.trim();
                                    return false; // Break loop
                                }
                            }
                        });
                    } catch (e) {
                        this.logger.warn(`⚠️ Échec du chargement du fragment AJAX: ${e.message}`);
                    }
                    if (scrutinId) break;
                }
            }

            if (scrutinId) {
                this.logger.log(`🎯 Scrutin public détecté sur le dossier ! ID: ${scrutinId}`);
            } else {
                this.logger.debug(`ℹ️ Aucun scrutin public trouvé sur la page du dossier.`);
            }
            return scrutinId;
        } catch (error) {
            this.logger.error(`❌ Impossible de charger la page du dossier ${url}: ${error.message}`);
            return null;
        }
    }

    /**
     * Scrape les résultats globaux et la liste nominative des votes par député sur la page d'un scrutin.
     * @param scrutinId L'identifiant unique du scrutin (ex: "6645")
     */
    async scrapeScrutinDetails(scrutinId: string): Promise<ScrapedScrutinDetails | null> {
        const url = `https://www.assemblee-nationale.fr/dyn/17/scrutins/${scrutinId}`;
        this.logger.log(`🌐 Scraping des détails du scrutin depuis l'HTML : ${url}`);
        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 15000
                })
            );
            const $ = cheerio.load(response.data);

            // 1. Extraire la date du scrutin (généralement dans le sous-titre ou un de ses textes)
            let dateScrutin = new Date().toISOString().split('T')[0];
            const pageText = $('body').text();
            const dateMatch = pageText.match(/séance du (\d+)\s+([a-zéû]+)\s+(\d{4})/i);
            if (dateMatch) {
                const day = parseInt(dateMatch[1], 10);
                const monthName = dateMatch[2].toLowerCase();
                const year = parseInt(dateMatch[3], 10);
                const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                const monthIndex = months.indexOf(monthName);
                if (monthIndex !== -1) {
                    const parsedDate = new Date(year, monthIndex, day);
                    dateScrutin = parsedDate.toISOString().split('T')[0];
                }
            }

            // 2. Extraire la synthèse globale des votes
            let pour = 0;
            let contre = 0;
            let abstention = 0;
            let total = 0;

            const textValues = {
                pour: ["Pour l'adoption :", "Pour :"],
                contre: ["Contre :"],
                abstention: ["Abstention :", "Abstentions :"],
                votants: ["Nombre de votants :", "Votants :"]
            };

            const findValueForLabels = (labels: string[]): number => {
                let value = 0;
                labels.forEach(label => {
                    $(`span:contains("${label}")`).each((_, element) => {
                        const bTag = $(element).find('b');
                        if (bTag.length > 0) {
                            const parsed = parseInt(bTag.text().trim(), 10);
                            if (!isNaN(parsed)) value = parsed;
                        } else {
                            const nextSpan = $(element).next('span');
                            if (nextSpan.length > 0) {
                                const valText = nextSpan.text().replace(/\s/g, '').replace(':', '');
                                const parsed = parseInt(valText, 10);
                                if (!isNaN(parsed)) {
                                    value = parsed;
                                }
                            }
                        }
                    });
                });
                return value;
            };

            pour = findValueForLabels(textValues.pour);
            contre = findValueForLabels(textValues.contre);
            abstention = findValueForLabels(textValues.abstention);
            total = findValueForLabels(textValues.votants) || (pour + contre + abstention);

            const adopted = pour > contre;

            // 3. Extraire les votes par groupe politique
            const groupVotes: ScrapedScrutinDetails['groupVotes'] = [];

            // Sélecteur : ul[id^="groupe"]
            $('ul[id^="groupe"]').each((_, groupContainer) => {
                const groupLi = $(groupContainer).children('li[data-organe-id]').first();
                if (groupLi.length === 0) return;

                const groupOrganId = groupLi.attr('data-organe-id') || '';
                const groupAnchor = groupLi.find('a.h5[href^="/dyn/org/"]').first();
                const groupName = groupAnchor.text().trim() || 'Inconnu';

                if (!groupOrganId || !groupName) return;

                const groupVoteEntries: Array<{ deputyName: string; deputyAnRef: string; choice: VoteChoice }> = [];

                // Parcourir chaque choix de vote sous le groupe
                // Chaque choix est dans un li.relative-flex._vertical
                groupLi.find('li.relative-flex._vertical').each((_, choiceLi) => {
                    const labelSpan = $(choiceLi).find('span.h6._colored-travaux').first();
                    const choiceText = labelSpan.text().trim().toLowerCase();
                    
                    let choice: VoteChoice | null = null;
                    if (choiceText.includes('pour')) {
                        choice = VoteChoice.FOR;
                    } else if (choiceText.includes('contre')) {
                        choice = VoteChoice.AGAINST;
                    } else if (choiceText.includes('abstention')) {
                        choice = VoteChoice.ABSTAIN;
                    }

                    if (!choice) return;

                    // Liste de députés votant pour ce choix
                    $(choiceLi).find('a.link._small[href^="/dyn/deputes/"]').each((_, depAnchor) => {
                        const href = $(depAnchor).attr('href') || '';
                        const deputyAnRef = href.split('/').pop() || '';
                        const deputyName = $(depAnchor).text().trim();

                        if (deputyAnRef && deputyName) {
                            groupVoteEntries.push({
                                deputyName,
                                deputyAnRef,
                                choice
                            });
                        }
                    });
                });

                if (groupVoteEntries.length > 0) {
                    groupVotes.push({
                        groupName,
                        groupOrganId,
                        votes: groupVoteEntries
                    });
                }
            });

            // 4. Extraire le slug du dossier
            let dossierSlug: string | undefined;
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('/dossiers/')) {
                    const parts = href.split('/dossiers/');
                    if (parts.length > 1) {
                        dossierSlug = parts[1].split('?')[0].replace('/', '');
                    }
                }
            });

            this.logger.log(`✅ Scrutin ${scrutinId} parsé avec succès. Adopté: ${adopted}. Votes individuels: ${groupVotes.reduce((sum, g) => sum + g.votes.length, 0)}. Dossier: ${dossierSlug}`);

            return {
                pour,
                contre,
                abstention,
                total,
                adopted,
                dateScrutin,
                dossierSlug,
                groupVotes
            };
        } catch (error) {
            this.logger.error(`❌ Impossible de parser le scrutin ${scrutinId}: ${error.message}`);
            return null;
        }
    }
}
