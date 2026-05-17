import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ScrapedVoteResult {
    pour: number;
    contre: number;
    abstention: number;
    total: number;
    adopted: boolean;
    dateScrutin: string;
    sourceUrl: string;
    /** Cas 4 : loi identifiée dans la séance mais pas de vote final (discussion en cours) */
    inDiscussion?: boolean;
    /** Cas 2 : vote sans chiffres officiels (article unique adopté tacitement) */
    isSimplified?: boolean;
    /** Cas 3 : vote à main levée (adopté, mais sans décompte numérique publié) */
    isMainLevee?: boolean;
    /** Cas 4 bis : vote explicitément reporté */
    voteDeferred?: boolean;
    /** Raison du report (extraite du CR) */
    deferredReason?: string;
    /** Prochaine date de séance si mentionnée */
    nextSessionDate?: string;
}

@Injectable()
export class CompteRenduScrapingService {
    private readonly logger = new Logger(CompteRenduScrapingService.name);

    constructor(private readonly httpService: HttpService) {}

    /**
     * Tente de récupérer les résultats globaux d'un vote sur les fichiers OpenData JSON du jour.
     * @param date Date du débat (agendaDate)
     * @param law Objet Law complet pour matching précis (titre, IDs, numéros de doc)
     */
    async scrapeResultsFromDay(date: Date, law: any): Promise<ScrapedVoteResult | null> {
        // 1. On récupère d'abord les IDs des séances du jour via la liste
        const sittings = await this.fetchSittingsForDay(date);
        this.logger.debug(`📜 ${sittings.length} séance(s) trouvée(s) pour le ${date.toISOString().split('T')[0]}`);

        let bestResult: ScrapedVoteResult | null = null;

        for (const sittingId of sittings) {
            const url = `https://www.assemblee-nationale.fr/dyn/opendata/${sittingId}.json`;
            try {
                const response = await firstValueFrom(
                    this.httpService.get(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 10000
                    })
                );
                
                const result = this.parseOpenDataJson(response.data, law, url, date);
                if (result) {
                    this.logger.log(`🔍 Résultat trouvé dans ${sittingId} (Adopté: ${result.adopted}, InDiscussion: ${result.inDiscussion})`);
                    
                    // Priorité 1 : Un vrai vote (Adoption ou Rejet)
                    if (!result.inDiscussion) {
                        this.logger.log(`✅ Résultat DÉFINITIF trouvé dans ${sittingId}.`);
                        bestResult = result;
                        // On continue quand même de boucler pour voir s'il y a un résultat plus récent/final 
                        // (ex: adopté en 1ère lecture dans l'après-midi, puis un autre dépôt le soir)
                        // Mais généralement, on peut s'arrêter si on veut, ici on finit de scanner pour être sûr.
                    }
                    
                    // Priorité 2 : Discussion en cours (si on n'a rien de mieux)
                    if (result.inDiscussion && (!bestResult || bestResult.inDiscussion)) {
                        bestResult = result;
                    }
                }
            } catch (error) {
                this.logger.warn(`⚠️ Erreur chargement OpenData ${sittingId} : ${error.message}`);
            }
        }

        return bestResult;
    }

    private async fetchSittingsForDay(date: Date): Promise<string[]> {
        // === STRATÉGIE 1 : API JSON de l'AN ===
        // L'AN propose une API de recherche des comptes rendus :
        // https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/seance/?from=DATE&to=DATE (retourne HTML)
        // Mais une API JSON plus fiable existe dans leurs données OpenData.
        // On utilise une estimation par calibrage : on sait que la 187e séance = 31 mars 2026
        // et qu'il y a ~3-4 séances par semaine en moyenne.

        // Ancrage calibré : session 179 ≈ 26 mars 2026, session 187 ≈ 31 mars 2026
        // On choisit l'ancre la plus proche de la date cible
        const ANCHOR_DATE = new Date('2026-03-26');
        const ANCHOR_SESSION = 179;
        const AVG_SESSIONS_PER_DAY = 1.3;

        const diffDays = Math.round((date.getTime() - ANCHOR_DATE.getTime()) / (1000 * 60 * 60 * 24));
        const estimatedSession = Math.round(ANCHOR_SESSION + diffDays * AVG_SESSIONS_PER_DAY);
        
        // On teste 17 IDs (±8) pour couvrir les variations du calendrier parlementaire
        const yearInId = date >= new Date('2025-10-01') ? '2026' : date.getFullYear().toString();

        const idsToProbe: string[] = [];
        for (let offset = -8; offset <= 8; offset++) {
            const n = estimatedSession + offset;
            if (n > 0) {
                idsToProbe.push(`CRSANR5L17S${yearInId}O1N${n}`);
            }
        }

        this.logger.debug(`🎯 Estimation séance ~${estimatedSession} pour le ${date.toISOString().split('T')[0]}. Sondage de ${idsToProbe.length} IDs.`);

        // On charge les JSONs en parallèle et garde seulement ceux ayant la bonne date
        const dateStrPlain = date.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
        const matchingIds: string[] = [];

        await Promise.allSettled(idsToProbe.map(async (sittingId) => {
            const url = `https://www.assemblee-nationale.fr/dyn/opendata/${sittingId}.json`;
            try {
                const response = await firstValueFrom(
                    this.httpService.get(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 8000
                    })
                );
                const json = response.data;
                // L'AN OpenData a parfois une structure plate : json.metadonnees.dateSeance
                const sessionDate = json?.metadonnees?.dateSeance || 
                                    json?.compteRendu?.metadonnees?.dateSeance ||
                                    json?.date;
                
                // Le format est souvent 20260331150000000 (YYYYMMDD...)
                if (sessionDate && String(sessionDate).startsWith(dateStrPlain)) {
                    this.logger.debug(`✅ Séance ${sittingId} confirmée pour le ${date.toISOString().split('T')[0]}`);
                    matchingIds.push(sittingId);
                }
            } catch {
                // Séance n'existe pas à cet ID, on ignore
            }
        }));

        this.logger.debug(`📍 IDs de séances identifiés : ${matchingIds.join(', ')}`);
        return matchingIds;
    }


    private getFrenchMonth(date: Date): string {
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return months[date.getMonth()];
    }

    private isMatchingTitle(law: any, candidateTitle: string, isExactCode: boolean = false): boolean {
        if (!law || !candidateTitle) return false;

        const lawTitle = law.titleOfficial || "";
        const lawNorm = this.normalize(lawTitle);
        const candNorm = this.normalize(candidateTitle);

        // 1. Identity Match (Document Number) - Priorité absolue
        const docNumbers = law.documentNumbers || law.document_numbers || [];
        if (docNumbers.length > 0) {
            const textDocNumbers = this.extractDocumentNumbers(candidateTitle);
            const match = docNumbers.find(n => textDocNumbers.includes(String(n)));
            if (match) {
                this.logger.debug(`🎯 Match IDENTITAIRE (n° doc) : n° ${match} trouvé dans "${candidateTitle.substring(0, 50)}..."`);
                return true;
            }
        }

        // 1b. Identity Match (Dossier ID / External ID)
        if (law.externalId && candidateTitle.includes(law.externalId)) {
            this.logger.debug(`🎯 Match IDENTITAIRE (Dossier ID) : ${law.externalId} trouvé.`);
            return true;
        }

        // 2. Exact or significant substring match
        // On évite les substrings trop courts qui matchent des mots communs (ex: "si", "la")
        if (candNorm.length > 5 && (candNorm.includes(lawNorm) || lawNorm.includes(candNorm))) return true;
        if (candNorm === lawNorm) return true;

        // 3. Keyword Intersection - Seulement si le segment ressemble à un titre (ou si on a un code précis)
        const isTitleLike = isExactCode ||
                           candidateTitle === candidateTitle.toUpperCase() || 
                           candidateTitle.length < 250 ||
                           candidateTitle.split(' ').length < 30;

        if (!isTitleLike) return false;

        const lawWords = lawNorm.split(' ').filter(w => w.length > 3);
        const candWords = candNorm.split(' ').filter(w => w.length > 3);
        if (lawWords.length === 0 || candWords.length === 0) return false;

        // On cherche des mots longs/rares
        const rareWords = lawWords.filter(w => w.length >= 6); 
        const intersection = rareWords.filter(w => candWords.includes(w));
        
        // Seuil de mots rares augmenté si la loi est courte
        // On demande au moins 2 mots rares (6+ lettres) OU 1 mot très long (10+ lettres)
        const longWordsMatch = intersection.filter(w => w.length >= 10).length;
        const threshold = (rareWords.length <= 4) ? 2 : 3;
        
        if (intersection.length >= threshold || longWordsMatch >= 1) {
            // Vérification de sécurité : ratio plus souple si c'est un code de titre exact
            let matchInLaw = 0;
            lawWords.forEach(w => { if (candWords.includes(w)) matchInLaw++; });
            const ratio = matchInLaw / lawWords.length;
            const requiredRatio = isExactCode ? 0.3 : 0.5;
            
            if (ratio >= requiredRatio) {
                this.logger.debug(`🎯 Match par MOTS-CLÉS (${intersection.join(', ')}) ratio ${Math.round(ratio*100)}% : "${candidateTitle.substring(0, 40)}..."`);
                return true;
            }
        }

        return false;
    }

    private extractDocumentNumbers(text: string): string[] {
        // Cherche "n° 2510", "n°2510", "numéro 2510"
        const regex = /(?:n°|numéro)\s*(\d+)/gi;
        const matches = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    }

    private parseOpenDataJson(json: any, law: any, url: string, date: Date): ScrapedVoteResult | null {
        if (!json) return null;

        // L'AN OpenData peut avoir une structure plate ou un wrapper "compteRendu"
        const data = json.compteRendu || json;
        const contenu = data.contenu || data.contents || data.contenus;
        
        if (!contenu) {
            this.logger.debug(`⚠️ Aucun contenu trouvé dans le JSON ${url}. Clefs dispos: ${Object.keys(data).join(', ')}`);
            return null;
        }

        const lawTitle = law.titleOfficial || "";
        let currentLawFound = false;

        const flatItems = this.flattenContenus(contenu);
        this.logger.debug(`📄 ${flatItems.length} segments extraits du JSON.`);

        let lawIdentifiedInSession = false; // Pour savoir si on a vu la loi DU TOUT

        for (let i = 0; i < flatItems.length; i++) {
            const item = flatItems[i];
            const text = item.texte || "";
            const code = item.code_grammaire || "";

            // 0. Tracking global : si on voit le titre de notre loi n'importe où
            if (this.isMatchingTitle(law, text)) {
                lawIdentifiedInSession = true;
            }

            // 1. Détecter si on est dans la section de notre loi (Titre officiel 1_10 ou Titre discussion)
            const isTitleCode = code.includes('1_10') || code.includes('TITRE_TEXTE_DISCUSSION');
            
            if (isTitleCode) {
                if (this.isMatchingTitle(law, text, true)) { // Pass true to bypass length/format checks for exact codes
                    currentLawFound = true;
                    this.logger.debug(`🎯 Section de loi identifiée (${code}) à i=${i} : ${text.substring(0, 80)}...`);
                }
            } else if (!currentLawFound && this.isMatchingTitle(law, text)) {
                currentLawFound = true;
                this.logger.debug(`🎯 Section de loi identifiée par texte à i=${i} : ${text.substring(0, 80)}...`);
            }

            // 1b. Cas du vote SANS scrutin public (procédure simplifiée / article unique)
            if (currentLawFound) {
                const lowerText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                // --- CAS 4 : Vote REPORTÉ / RÉSERVÉ (le vote n'a pas eu lieu) ---
                // On cherche des mentions de renvoi ou d'interruption.
                // Note: On évite les faux positifs des transitions de séances (ex: 'La suite de la discussion... après-midi')
                // en cherchant des patterns plus spécifiques au report de VOTE.
                const isDeferredMention = 
                    (lowerText.includes('la suite de la discussion est renvoyee') ||
                     lowerText.includes('le vote est reserve') ||
                     lowerText.includes('examen sera poursuivi') ||
                     lowerText.includes('la discussion est reserved') ||
                     (lowerText.includes('article 88') && lowerText.includes('repousses'))) &&
                    !lowerText.match(/prochaine seance,? a quinze heures/); // Cas 4b: transition simple

                if (isDeferredMention) {
                    const isArt88 = lowerText.includes('article 88');
                    this.logger.log(`📅 Vote REPORTÉ/REPOUSSÉ détecté pour "${law.titleOfficial?.substring(0, 40)}"`);
                    return {
                        pour: 0, contre: 0, abstention: 0, total: 0,
                        adopted: false,
                        voteDeferred: true,
                        deferredReason: isArt88 
                            ? 'Amendements repoussés en commission (Art. 88) ; le texte n\'est pas venu en séance.'
                            : 'La discussion a été interrompue ; le vote n\'a pas encore eu lieu.',
                        dateScrutin: date.toISOString().split('T')[0],
                        sourceUrl: url
                    };
                }

                // --- CAS 3 : Vote À MAIN LEVÉE (adopté sans décompte numérique officiel) ---
                const isMainLeveeMention = 
                    lowerText.match(/^\(adopte\.?\)$/) ||
                    lowerText.includes('adopte a l\'unanimite') ||
                    lowerText.includes('adopte sans vote contraire') ||
                    (lowerText.includes('(adopte)') && !lowerText.match(/\d+/) && !lowerText.includes('amendement'));

                if (isMainLeveeMention) {
                    this.logger.log(`🙋 Vote à MAIN LEVÉE détecté pour "${law.titleOfficial?.substring(0, 40)}"`);
                    return {
                        pour: 0, contre: 0, abstention: 0, total: 0,
                        adopted: true,
                        isMainLevee: true,
                        dateScrutin: date.toISOString().split('T')[0],
                        sourceUrl: url
                    };
                }

                // --- CAS 2 : Article Unique adopté ---
                // Regex robuste pour: "L'article unique[, amende,] est adopte [ainsi que l'ensemble...]"
                const normalizedContent = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                // On gère les apostrophes ' et ’ dans le texte original (avant normalisation NFD qui peut les séparer)
                const matchesArticleUnique = normalizedContent.match(/l[’']?article unique[, ]+(amende,? )?est adopte/i) ||
                                           normalizedContent.match(/l article unique[, ]+(amende,? )?est adopte/i);
                
                const hasEnsembleMention = normalizedContent.includes('ensemble de la proposition') || 
                                         normalizedContent.includes('ensemble du projet');

                const isAdoptedMention = normalizedContent.includes('(le projet de loi est adopte)') || 
                                       normalizedContent.includes('(la proposition de loi est adoptee)') ||
                                       normalizedContent.includes("l'assemblee nationale a adopte") ||
                                       normalizedContent.includes("l’assemblee nationale a adopte") ||
                                       normalizedContent.includes("article 106");
                
                if (currentLawFound) {
                    this.logger.debug(`🔎 Segment dans la section de la loi : "${text.substring(0, 100)}..."`);
                }

                if (isAdoptedMention || (matchesArticleUnique && hasEnsembleMention)) {
                    this.logger.log(`✨ Résultat trouvé : ADOPTÉ (Article Unique ou Ensemble)`);
                    return {
                        pour: 0, contre: 0, abstention: 0, total: 0,
                        adopted: true,
                        isSimplified: true,
                        dateScrutin: date.toISOString().split('T')[0],
                        sourceUrl: url
                    };
                }

                const isRejectedMention = lowerText.includes("(l'assemblee nationale n'a pas adopte)") ||
                                          lowerText.includes("motion de rejet prealable est adoptee") ||
                                          (lowerText.includes("projet de loi") && lowerText.includes("est rejete"));
                if (isRejectedMention) {
                    return {
                        pour: 0, contre: 0, abstention: 0, total: 0,
                        adopted: false,
                        isSimplified: true,
                        dateScrutin: date.toISOString().split('T')[0],
                        sourceUrl: url
                    };
                }
            }

            // 2. Si on est après le titre, chercher le bloc de vote final
            if (currentLawFound && code.includes('VOTE_ENS_P') && code.includes('2_40')) {
                this.logger.debug(`📊 BLOC DE VOTE IDENTIFIÉ : ${text.substring(0, 50)}...`);
                const result = this.extractNumericResults(text);
                
                if (result) {
                    const adopted = text.toLowerCase().includes('adopte');
                    return {
                        ...result,
                        adopted: adopted || result.pour > result.contre,
                        dateScrutin: date.toISOString().split('T')[0],
                        sourceUrl: url
                    };
                }
            }

            // 3. Cas spécial : Vote d'ensemble générique
            if (!currentLawFound && code.includes('VOTE_ENS_P') && code.includes('2_40')) {
                if (text.toLowerCase().includes("l'ensemble de la proposition de loi") || 
                    text.toLowerCase().includes("l'ensemble du projet de loi")) {
                    this.logger.debug(`📊 Tentative de matching sur vote d'ensemble générique.`);
                    const result = this.extractNumericResults(text);
                    if (result) {
                        return {
                            ...result,
                            adopted: text.toLowerCase().includes('adopte') || result.pour > result.contre,
                            dateScrutin: date.toISOString().split('T')[0],
                            sourceUrl: url
                        };
                    }
                }
            }

            // On ne réinitialise plus agressivement currentLawFound pour éviter de rater le vote 
            // après des sous-titres (1_10) ou des discussions longues.
            // Le startIndex + 500 et le ResultRank gèrent déjà la pertinence.
        }

        // 4. Fallback agressif : Un seul vote d'ensemble dans la séance
        // On ne l'autorise QUE si la loi a été au moins identifiée dans cette séance
        const ensembleVotes = flatItems.filter(item => 
            (item.code_grammaire || "").includes('VOTE_ENS_P') && 
            (item.code_grammaire || "").includes('2_40')
        );

        if (lawIdentifiedInSession && !currentLawFound && ensembleVotes.length === 1) {
            const item = ensembleVotes[0];
            const textMatch = item.texte || "";
            this.logger.debug(`🤔 Un seul vote d'ensemble détecté dans la séance. Tentative de matching indirect...`);
            
            const result = this.extractNumericResults(textMatch);
            if (result) {
                return {
                    ...result,
                    adopted: textMatch.toLowerCase().includes('adopte') || result.pour > result.contre,
                    dateScrutin: date.toISOString().split('T')[0],
                    sourceUrl: url
                };
            }
        }

        // Si on a identifié la loi dans la séance (même via une simple mention) mais qu'on n'a pas trouvé de vote final
        if (lawIdentifiedInSession) {
            this.logger.log(`📢 Loi "${law.titleOfficial?.substring(0, 30)}..." identifiée dans la séance, mais aucun vote final détecté.`);
            return {
                pour: 0, contre: 0, abstention: 0, total: 0,
                adopted: false,
                dateScrutin: date.toISOString().split('T')[0],
                sourceUrl: url,
                inDiscussion: true
            };
        }

        return null;
    }

    private flattenContenus(obj: any): any[] {
        let items: any[] = [];
        if (!obj) return items;

        const extractText = (val: any): string => {
            if (typeof val === 'string') return val;
            if (Array.isArray(val)) return val.map(extractText).join(' ');
            if (val && typeof val === 'object') {
                // Si l'objet a une propriété '#text', on la prend d'abord
                if (val['#text']) return String(val['#text']);
                // Sinon on parcourt toutes ses valeurs récursivement
                return Object.values(val).map(v => extractText(v)).join(' ');
            }
            return '';
        };

        const process = (item: any) => {
            if (Array.isArray(item)) {
                item.forEach(process);
            } else if (item && typeof item === 'object') {
                if (item.texte) {
                    const textContent = extractText(item.texte);
                    if (textContent.trim()) {
                        const attributes = item['@attributes'] || {};
                        items.push({
                            texte: textContent,
                            code_grammaire: attributes.code_grammaire || item.code_grammaire || ""
                        });
                    }
                }
                // Récursivité pour les sous-structures
                Object.entries(item).forEach(([key, value]) => {
                    if (key !== 'texte') process(value);
                });
            }
        };

        process(obj);
        return items;
    }

    private extractNumericResults(text: string): { pour: number; contre: number; abstention: number; total: number } | null {
        const pourMatch = text.match(/Pour l’adoption[^\d]*(\d+)/i);
        const contreMatch = text.match(/Contre[^\d]*(\d+)/i);
        const abstentionMatch = text.match(/Abstention[^\d]*(\d+)/i);
        const totalMatch = text.match(/Nombre de votants[^\d]*(\d+)/i);

        if (pourMatch) {
            return {
                pour: parseInt(pourMatch[1], 10),
                contre: contreMatch ? parseInt(contreMatch[1], 10) : 0,
                abstention: abstentionMatch ? parseInt(abstentionMatch[1], 10) : 0,
                total: totalMatch ? parseInt(totalMatch[1], 10) : parseInt(pourMatch[1], 10)
            };
        }
        return null;
    }

    private formatDateTitle(date: Date): string {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        
        const d = days[date.getDay()];
        const j = date.getDate();
        const m = months[date.getMonth()];
        
        return `${d} ${j} ${m}`;
    }

    private normalize(text: string): string {
        if (!text) return "";
        let norm = text.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        norm = norm.replace(/\bitalie(nne|ns|n)?\b/g, 'italie');
        norm = norm.replace(/\bfrancai(se|s)?\b/g, 'france');
        norm = norm.replace(/\badopte(e|s|es)?\b/g, 'adopte');

        return norm;
    }
}
