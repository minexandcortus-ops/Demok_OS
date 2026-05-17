import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Law, LawStatus } from '../laws/law.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as AdmZip from 'adm-zip';
import { LawScraperService } from './law-scraper.service';

/**
 * Service chargé de télécharger le "dossier législatif" (dossier.json) depuis l'OpenData
 * de l'Assemblée Nationale, afin d'extraire l'URL du texte de loi le plus récent.
 */
@Injectable()
export class DocumentIngestionService {
    private readonly logger = new Logger(DocumentIngestionService.name);
    private readonly DOSSIER_ZIP_URL = 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip';
    private readonly DOSSIER_SITE_BASE = 'https://www.assemblee-nationale.fr/dyn/17/textes';
    private readonly HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/zip, application/json, text/plain, */*'
    };

    constructor(
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        private readonly httpService: HttpService,
        private readonly lawScraperService: LawScraperService,
    ) { }

    async updateLatestTexts() {
        this.logger.log('📄 Démarrage de la mise à jour des derniers textes de loi via le ZIP global...');

        const laws = await this.lawRepository.find({
            where: [
                { isOnAgenda: true },
                { status: LawStatus.PENDING },
                { status: LawStatus.VOTED_AN },
                { status: LawStatus.VALIDATED }
            ]
        });

        if (laws.length === 0) {
            this.logger.log('Aucune loi pertinente à actualiser.');
            return { updated: 0, errors: 0 };
        }

        let updated = 0;
        let errors = 0;

        try {
            this.logger.log(`📥 Téléchargement du ZIP des dossiers législatifs : ${this.DOSSIER_ZIP_URL}`);
            const response = await firstValueFrom(
                this.httpService.get(this.DOSSIER_ZIP_URL, {
                    responseType: 'arraybuffer',
                    headers: this.HEADERS,
                    timeout: 60000 // 60s timeout for a ~5MB zip
                })
            );

            this.logger.log('📦 Extraction du ZIP en mémoire...');
            const zip = new AdmZip(Buffer.from(response.data));
            const zipEntries = zip.getEntries();
            this.logger.log(`🔍 ${zipEntries.length} fichiers JSON trouvés dans le ZIP.`);

            // Créer une map UID -> JSON content (uniquement les dossiers, pas l'index)
            const dossiersMap = new Map<string, any>();
            for (const entry of zipEntries) {
                if (entry.entryName.endsWith('.json')) {
                    try {
                        const content = zip.readAsText(entry);
                        const data = JSON.parse(content);
                        const uid = data.dossierParlementaire?.uid;
                        if (uid) {
                            dossiersMap.set(uid, data.dossierParlementaire);
                        }
                    } catch (e) {
                        // Ignorer les json corrompus ou hors structure
                    }
                }
            }

            for (const law of laws) {
                try {
                    const hasChanged = await this.extractLatestTextFromMap(law, dossiersMap);
                    if (hasChanged) updated++;
                } catch (error) {
                    this.logger.warn(`⚠️ Erreur d'ingestion texte pour ${law.externalId} : ${error.message}`);
                    errors++;
                }
            }

        } catch (error) {
            this.logger.error(`❌ Impossible de télécharger ou parser le ZIP global : ${error.message}`);
            return { updated: 0, errors: 1 };
        }

        this.logger.log(`✅ Mise à jour textes terminée : ${updated} loi(s) actualisée(s), ${errors} erreur(s)`);
        return { updated, errors };
    }

    /**
     * Pour une loi donnée, cherche son JSON dans la Map et extrait la ref la plus récente.
     * @returns true si la loi a été modifiée en base
     */
    async extractLatestTextFromMap(law: Law, dossiersMap: Map<string, any>): Promise<boolean> {
        // law.externalId est typiquement de la forme "AN_DLR5L17N53315"
        // L'UID du JSON est "DLR5L17N53315"
        const dossierUid = law.externalId.replace('AN_', '');
        const dossierData = dossiersMap.get(dossierUid);

        if (!dossierData || !dossierData.actesLegislatifs) return false;

        const data = dossierData.actesLegislatifs;
        const textsWithDates: { ref: string; type: string; date: string }[] = [];

        // Fonction récursive pour chercher les textes
        const extractTexts = (node: any) => {
            if (!node) return;
            if (Array.isArray(node)) {
                node.forEach(extractTexts);
            } else if (typeof node === 'object') {
                if (node.texteAdopte) {
                    textsWithDates.push({ ref: node.texteAdopte, type: 'Texte adopté', date: node.dateActe || '' });
                }
                if (node.texteAssocie) {
                    textsWithDates.push({ ref: node.texteAssocie, type: 'Proposition initiale', date: node.dateActe || '' });
                }
                for (const key of Object.keys(node)) {
                    extractTexts(node[key]);
                }
            }
        };

        extractTexts(data);

        if (textsWithDates.length === 0) return false;

        // Trier par date décroissante pour prendre le plus récent
        textsWithDates.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            return dateB - dateA;
        });

        const latest = textsWithDates[0];

        // La ref ressemble souvent à "PRJLANR5L17B2413"
        // Le site dyn assembée nécessite un format spécifique : l17b2413
        const docId = latest.ref.match(/L17B(\d+)/i);
        if (!docId) return false;

        const docNum = `l17b${docId[1]}`;

        // Toujours utiliser le suffixe _proposition-loi sans .pdf.
        // C'est le seul format confirmé sur le site de l'AN pour les textes associés et adoptés.
        // ex: https://www.assemblee-nationale.fr/dyn/17/textes/l17b2413_proposition-loi
        // (Cette page HTML affiche toujours le texte définitif, y compris si adopté)
        const generatedUrl = `${this.DOSSIER_SITE_BASE}/${docNum}_proposition-loi`;

        // Si l'URL n'a pas changé, on ne sauvegarde pas
        if (law.latestTextUrl === generatedUrl && law.rawText) return false;

        law.latestTextUrl = generatedUrl;
        law.latestTextType = latest.type;

        // Extraire le texte brut
        const text = await this.lawScraperService.extractTextFromUrl(generatedUrl);
        if (text) {
            law.rawText = text;
        }

        await this.lawRepository.save(law);
        this.logger.log(`📥 [${law.externalId}] Nouveau texte trouvé : ${latest.type} (${generatedUrl})`);

        return true;
    }
}
