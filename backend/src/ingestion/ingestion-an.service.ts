import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as AdmZip from 'adm-zip';

@Injectable()
export class IngestionANService {
    private readonly logger = new Logger(IngestionANService.name);

    // Cache en mémoire pour le ZIP (24h)
    private zipCache: { data: any[], timestamp: number } | null = null;
    private amendementsZipCache: { data: any[], timestamp: number } | null = null;
    private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

    constructor(private httpService: HttpService) { }

    /**
     * Récupère les lois en cours depuis l'API AN
     * PHASE 3 : API RÉELLE ACTIVÉE + CACHE 24H
     */
    async fetchCurrentLaws(): Promise<any[]> {
        this.logger.log('📥 Récupération lois depuis Assemblée Nationale (API RÉELLE)');

        // Vérifier le cache en mémoire
        if (this.zipCache && (Date.now() - this.zipCache.timestamp) < this.CACHE_TTL_MS) {
            const cacheAge = Math.floor((Date.now() - this.zipCache.timestamp) / 1000 / 60);
            this.logger.log(`💾 Utilisation du cache ZIP (âge: ${cacheAge} minutes)`);
            return this.zipCache.data;
        }

        try {
            this.logger.log('🌐 Téléchargement du fichier ZIP...');

            const response = await firstValueFrom(
                this.httpService.get(
                    'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip',
                    {
                        timeout: 60000,
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    }
                )
            );

            const laws = await this.importFromZipBuffer(response.data);

            // Mettre en cache
            this.zipCache = { data: laws, timestamp: Date.now() };

            return laws;
        } catch (error) {
            this.logger.error(`Erreur récupération AN: ${error.message}`);
            return [];
        }
    }

    /**
     * Télécharge le ZIP principal des dossiers législatifs
     * Méthode publique pour utilisation par d'autres services
     */
    async downloadDossiersZip(): Promise<Buffer> {
        this.logger.log('📥 Téléchargement du ZIP Dossiers Législatifs...');

        const response = await firstValueFrom(
            this.httpService.get(
                'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip',
                {
                    timeout: 60000,
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            )
        );

        return response.data;
    }

    /**
     * Traite un fichier ZIP et extrait les lois
     */
    async importFromZipBuffer(buffer: Buffer): Promise<any[]> {
        try {
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();
            const laws: any[] = [];

            for (const entry of zipEntries) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;

                try {
                    const jsonText = zip.readAsText(entry);
                    const data = JSON.parse(jsonText);
                    const dossier = data.dossierParlementaire || data.dossier || data;
                    if (!dossier) continue;

                    const processedLaw = this.processDossier(dossier);
                    if (processedLaw) laws.push(processedLaw);
                } catch (err) {
                    // Ignorer les erreurs de parsing individuelles
                }
            }
            // Trier par date la plus récente en premier
            laws.sort((a, b) => {
                if (!a.voteDate && !b.voteDate) return 0;
                if (!a.voteDate) return 1;
                if (!b.voteDate) return -1;
                return new Date(b.voteDate).getTime() - new Date(a.voteDate).getTime();
            });

            this.logger.log(`📊 ${laws.length} lois extraites, triées par date`);
            return laws;
        } catch (error) {
            this.logger.error(`Erreur lecture ZIP: ${error.message}`);
            return [];
        }
    }

    /**
     * Importe spécifiquement une liste de dossiers par leur ID (uid)
     */
    async importSpecificLaws(dossierIds: string[]): Promise<any[]> {
        this.logger.log(`🎯 Import ciblé de ${dossierIds.length} dossiers...`);

        // 1. S'assurer d'avoir le ZIP (cache ou DL)
        let buffer: Buffer;
        if (this.zipCache && (Date.now() - this.zipCache.timestamp) < this.CACHE_TTL_MS) {
            // Attention: le cache ne stocke que les lois parsées, pas le buffer brut
            // Il faudrait cacher le buffer, ou re-télécharger si on veut parser à nouveau
            // Pour simplifier ici, on re-télécharge si on n'a pas le buffer brut qque part
            // Ou alors on filtre les lois déjà en cache ?
            // Si le cache `data` contient TOUTES les lois du ZIP, on peut filtrer dedans.
            // Mais `fetchCurrentLaws` renvoie tout.

            const existing = this.zipCache.data.filter(l => dossierIds.includes(l.externalId) || dossierIds.includes(l.externalId.replace('AN_', '')));
            if (existing.length === dossierIds.length) {
                return existing;
            }
            // Si on ne trouve pas tout, on re-télécharge (peut-être une maj du ZIP)
        }

        try {
            // Téléchargement (optimisation possible : mettre en cache le buffer aussi)
            const response = await firstValueFrom(
                this.httpService.get(
                    'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip',
                    {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    }
                )
            );
            buffer = response.data;

            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();
            const foundLaws: any[] = [];
            const targetIds = new Set(dossierIds.map(id => id.replace('AN_', ''))); // Normaliser

            for (const entry of zipEntries) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;

                // Optimisation: vérifier si le nom du fichier contient l'ID ?
                // Les noms de fichiers sont souvent l'UID, ex: "DOSS...json" ?
                // Vérifions un dossier : "json/dossierParlementaire/DLR5L15N37637.json"
                // Donc OUI, on peut filtrer par nom de fichier !

                const fileName = entry.entryName.split('/').pop()?.replace('.json', '') || '';
                if (!targetIds.has(fileName)) continue;

                try {
                    const jsonText = zip.readAsText(entry);
                    const data = JSON.parse(jsonText);
                    const dossier = data.dossierParlementaire || data.dossier || data;

                    if (!dossier || !targetIds.has(dossier.uid)) continue;

                    // Logique d'extraction (copiée/adaptée de importFromZipBuffer pour refactoriser idéalement)
                    // Pour l'instant je duplique pour éviter de casser l'existant, mais je pourrais extraire une méthode `parseDossier`

                    const processedLaw = this.processDossier(dossier);
                    if (processedLaw) {
                        foundLaws.push(processedLaw);
                    }

                } catch (e) { }
            }

            this.logger.log(`✅ ${foundLaws.length} / ${dossierIds.length} dossiers spécifiques trouvés et importés.`);
            return foundLaws;

        } catch (error) {
            this.logger.error(`Erreur import ciblé: ${error.message}`);
            return [];
        }
    }

    private processDossier(dossier: any): any | null {
        try {
            const titre = dossier.titreDossier?.titre || dossier.titre || 'Titre inconnu';
            const procedure = dossier.procedureParlementaire?.libelle || '';
            const navetteStatus = this.extractNavetteStatus(dossier);
            const timeline = this.extractFullTimeline(dossier);
            const status = this.determineLawStatus(dossier, timeline);
            let titreCourt = dossier.titreDossier?.titreChemin || dossier.titreChemin || titre;

            if (titreCourt && (
                titreCourt.match(/^[A-Z0-9]{10,}$/i) ||
                titreCourt.startsWith('DLR') ||
                titreCourt.startsWith('AN_') ||
                (titreCourt.includes('_') && !titreCourt.includes(' ')) // slug URL
            )) {
                titreCourt = titre;
            }

            return {
                externalId: `AN_${dossier.uid}`,
                titleOfficial: titre,
                titleVulgarized: titreCourt !== titre ? titreCourt : null,
                content: titre,
                currentSource: 'AN',
                navetteStatus: navetteStatus,
                navetteCount: this.countNavettes(dossier),
                officialUrl: `https://www.assemblee-nationale.fr/dyn/17/dossiers/${dossier.uid}`,
                status: status,
                region: 'FRANCE',
                procedure: procedure,
                voteDate: status === 'PENDING' ? null : timeline.lastDate,
                dateDepot: timeline.dateDepot,
                datePromulgation: timeline.datePromulgation,
                procedureAcceleree: timeline.procedureAcceleree,
                documentNumbers: timeline.documentNumbers,
            };
        } catch { return null; }
    }

    private extractNavetteStatus(dossier: any): string {
        return this.mapNavetteStatus(dossier.procedureParlementaire?.libelle || '');
    }

    /**
     * Compter le nombre de navettes (lectures) entre chambres
     * Basé sur les nœuds racine (AN1, SN1, CMP, etc.)
     */
    private countNavettes(dossier: any): number {
        try {
            const actes = dossier.actesLegislatifs?.acteLegislatif;
            if (!actes) return 0;

            const actesList = Array.isArray(actes) ? actes : [actes];
            let count = 0;
            const validCodes = ['AN', 'SN', 'CMP', 'ANNLEC', 'SNNLEC', 'ANLDEF', 'CC', 'PROM'];

            for (const acte of actesList) {
                const code = acte.codeActe || '';
                // Compte si le code commence par un des préfixes valides (ex: AN1, SN2)
                if (validCodes.some(prefix => code.startsWith(prefix))) {
                    count++;
                }
            }
            return count;
        } catch {
            return 0;
        }
    }

    /**
     * Déterminer le statut global de la loi
     */
    private determineLawStatus(dossier: any, timeline: any): 'VOTED_AN' | 'PENDING' | 'VALIDATED' | 'REJECTED' {
        // 1. Promulgation
        if (timeline.datePromulgation) {
            return 'VALIDATED';
        }

        const etat = (dossier.etat || '').toLowerCase();
        // 2. Etats explicites
        if (etat.includes('promulguée')) return 'VALIDATED';
        if (etat.includes('rejeté')) return 'REJECTED';
        if (etat.includes('adopté') || etat.includes('terminé')) return 'VOTED_AN';

        // 3. Vérifier la dernière décision connue
        const actes = dossier.actesLegislatifs?.acteLegislatif;
        if (actes) {
            const actesList = Array.isArray(actes) ? actes : [actes];

            // Chercher récursivement le dernier acte de décision
            let lastDecision = '';

            const traverse = (obj: any) => {
                if (obj.statutConclusion?.libelle) {
                    lastDecision = obj.statutConclusion.libelle.toLowerCase();
                }
                if (obj.actesLegislatifs?.acteLegislatif) {
                    const subs = Array.isArray(obj.actesLegislatifs.acteLegislatif)
                        ? obj.actesLegislatifs.acteLegislatif
                        : [obj.actesLegislatifs.acteLegislatif];
                    subs.forEach(traverse);
                }
            };
            actesList.forEach(traverse);

            if (lastDecision === 'adoptée') return 'VOTED_AN'; // Potentiellement en attente de promulgation
            if (lastDecision === 'rejetée') return 'REJECTED';
        }

        return 'PENDING';
    }

    /**
     * Extraire la timeline complète (dates, accélérée, promulgation)
     */
    private extractFullTimeline(dossier: any): {
        dateDepot: string | null,
        lastDate: string | null,
        datePromulgation: string | null,
        procedureAcceleree: boolean,
        documentNumbers: string[]
    } {
        let dateDepot = null;
        let lastDate = null;
        let datePromulgation = null;
        let procedureAcceleree = false;
        this.logger.log(`🐞 Processing dossier for ${dossier.titre?.substring(0, 50)}... Keys: ${Object.keys(dossier).join(', ')}`);
        const documentNumbers = new Set<string>();

        try {
            const jsonStr = JSON.stringify(dossier);
            
            // 1. Recherche par champ JSON : numeroDocument ou uid complet
            // Dans la Législature 17, les IDs sont souvent de type PNR5L17N2413. On veut garder la fin (2413) ou l'ID complet.
            const jsonMatches = jsonStr.match(/"(numeroDocument|texteLegislatifRef|uid|reference)"\s*:\s*"([A-Z0-9]+)"/g);
            if (jsonMatches) {
                jsonMatches.forEach(m => {
                    const val = m.match(/: ?"([A-Z0-9]+)"/);
                    if (val && val[1]) {
                        documentNumbers.add(val[1]);
                        // Si c'est un UID long (ex: PNR5L17N2413), on extrait aussi la partie numérique finale
                        const numOnly = val[1].match(/\d+$/);
                        if (numOnly) documentNumbers.add(numOnly[0]);
                    }
                });
            }

            // 2. Recherche par pattern textuel (n° 1234)
            const textMatches = jsonStr.match(/n[°\s]+(\d+)/gi);
            if (textMatches) {
                textMatches.forEach(m => {
                    const num = m.match(/\d+/);
                    if (num) documentNumbers.add(num[0]);
                });
            }

            // 3. Exploration structurelle pour ne rien rater
            const traverse = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                
                // Extraction directe des champs clés
                if (obj.numeroDocument) documentNumbers.add(String(obj.numeroDocument));
                if (obj.uid && typeof obj.uid === 'string') {
                    documentNumbers.add(obj.uid);
                    const numOnly = obj.uid.match(/\d+$/);
                    if (numOnly) documentNumbers.add(numOnly[0]);
                }

                const code = obj.codeActe || '';
                const date = obj.dateActe;
                if (code.endsWith('-DEPOT') && date && !dateDepot) dateDepot = date;
                if (date && (!lastDate || date > lastDate)) lastDate = date;
                if (code === 'PROM-PUB' && date) datePromulgation = date;
                if (code && String(code).includes('PROCACC')) procedureAcceleree = true;
                
                for (const key in obj) {
                    const child = obj[key];
                    if (child && typeof child === 'object') {
                        if (Array.isArray(child)) child.forEach(traverse);
                        else traverse(child);
                    }
                }
            };
            traverse(dossier);
        } catch (e) {
            this.logger.error(`❌ Erreur extraction docNumbers: ${e.message}`);
        }

        const finalNumbers = Array.from(documentNumbers).filter(n => n.length > 1);
        if (finalNumbers.length > 0) {
            this.logger.debug(`📄 Documents trouvés pour ${dossier.uid || 'dossier'}: ${finalNumbers.join(', ')}`);
        }

        return { 
            dateDepot, 
            lastDate, 
            datePromulgation, 
            procedureAcceleree, 
            documentNumbers: finalNumbers 
        };
    }

    /**
     * Mapper le statut API vers notre enum interne
     */
    private mapNavetteStatus(apiStatus: string): string {
        const mapping: Record<string, string> = {
            'première lecture': 'premiere_lecture_an',
            'deuxième lecture': 'deuxieme_lecture_an',
            'lecture définitive': 'lecture_definitive_an',
        };
        return mapping[apiStatus] || 'premiere_lecture_an';
    }

    // ========== AMENDEMENTS ==========

    /**
     * Récupère les amendements depuis l'API AN
     */
    async fetchAmendements(): Promise<any[]> {
        this.logger.log('📥 Récupération amendements depuis Assemblée Nationale');

        // Vérifier le cache
        if (this.amendementsZipCache && (Date.now() - this.amendementsZipCache.timestamp) < this.CACHE_TTL_MS) {
            const cacheAge = Math.floor((Date.now() - this.amendementsZipCache.timestamp) / 1000 / 60);
            this.logger.log(`💾 Utilisation du cache amendements (âge: ${cacheAge} minutes)`);
            return this.amendementsZipCache.data;
        }

        try {
            this.logger.log('🌐 Téléchargement du ZIP amendements...');

            const response = await firstValueFrom(
                this.httpService.get(
                    'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/amendements_legis/Amendements.json.zip',
                    {
                        timeout: 120000,
                        responseType: 'arraybuffer',
                    }
                )
            );

            const amendements = this.parseAmendementsZip(response.data);

            // Mettre en cache
            this.amendementsZipCache = { data: amendements, timestamp: Date.now() };
            this.logger.log(`✅ ${amendements.length} amendements extraits`);

            return amendements;
        } catch (error) {
            this.logger.error(`Erreur récupération amendements AN: ${error.message}`);
            return [];
        }
    }

    /**
     * Parse le ZIP des amendements AN
     */
    parseAmendementsZip(buffer: Buffer): any[] {
        try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            const amendements: any[] = [];

            // Filtre : ne garder que les amendements de moins de 6 mois
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            for (const entry of entries) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;

                try {
                    const jsonText = zip.readAsText(entry);
                    const data = JSON.parse(jsonText);

                    // Le JSON peut contenir un ou plusieurs amendements
                    const amendement = data.amendement || data;
                    if (!amendement || !amendement.uid) continue;

                    // Extraire les informations de l'amendement
                    const corps = amendement.corps || {};
                    const identification = amendement.identification || {};
                    const signataires = amendement.signataires || {};
                    const cycleDeVie = amendement.cycleDeVie || {};

                    // Référence au dossier législatif parent
                    const dossierRef = identification.dossierParlementaireRef ||
                        amendement.dossierParlementaireRef ||
                        null;

                    const numero = identification.numero || amendement.numero || 'N/A';
                    const auteur = signataires.auteur?.acteurRef ||
                        signataires.auteur?.texte ||
                        'Auteur inconnu';

                    // Texte de l'amendement (exposé sommaire ou dispositif)
                    const texte = corps.contenuAuteur?.exposeSommaire ||
                        corps.contenuAuteur?.dispositif ||
                        null;

                    // Statut et sort
                    const sort = cycleDeVie.sort || cycleDeVie.etatDesTraitements?.etat?.libelle || null;
                    const statut = this.parseAmendementStatut(sort);

                    // Date de dépôt
                    const dateDepot = cycleDeVie.dateCreation ||
                        cycleDeVie.dateDepot ||
                        null;

                    // Filtrer : ignorer les amendements de plus de 6 mois
                    if (!dateDepot || new Date(dateDepot) < sixMonthsAgo) continue;

                    amendements.push({
                        externalId: `AN_${amendement.uid}`,
                        numero,
                        auteur,
                        texte,
                        statut,
                        dateDepot,
                        sort: sort || null,
                        dossierRef: dossierRef ? `AN_${dossierRef}` : null,
                    });
                } catch (err) {
                    // Ignorer les erreurs de parsing individuelles
                }
            }

            return amendements;
        } catch (error) {
            this.logger.error(`Erreur lecture ZIP amendements: ${error.message}`);
            return [];
        }
    }

    /**
     * Mapper le sort de l'amendement vers notre enum
     */
    private parseAmendementStatut(sort: string | null): string {
        if (!sort) return 'EN_DISCUSSION';
        const s = sort.toLowerCase();
        if (s.includes('adopt')) return 'ADOPTE';
        if (s.includes('rejet')) return 'REJETE';
        if (s.includes('retir')) return 'RETIRE';
        if (s.includes('tomb')) return 'TOMBE';
        if (s.includes('non défendu') || s.includes('non soutenu')) return 'NON_DEFENDU';
        return 'EN_DISCUSSION';
    }
}
