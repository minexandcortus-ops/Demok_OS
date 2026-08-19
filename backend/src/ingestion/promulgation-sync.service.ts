import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Law, LawStatus, NavetteStatus } from '../laws/law.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as AdmZip from 'adm-zip';
import { NotificationService } from '../notifications/notification.service';

/**
 * Service dédié à la vérification des promulgations et des navettes sénatoriales
 * qui ne sont pas détectables par les scrutins publics.
 */
@Injectable()
export class PromulgationSyncService {
    private readonly logger = new Logger(PromulgationSyncService.name);
    private readonly DOSSIER_ZIP_URL = 'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip';
    private readonly HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/zip, application/json, text/plain, */*'
    };

    constructor(
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        private readonly httpService: HttpService,
        private readonly notificationService: NotificationService,
    ) { }

    async syncPromulgations(): Promise<{ updated: number, errors: number }> {
        this.logger.log('📜 Vérification des promulgations et des navettes sénatoriales...');

        // Lois potentiellement promulguées ou en navette
        const candidates = await this.lawRepository.createQueryBuilder('law')
            .where('law.status IN (:...statuses)', { statuses: [LawStatus.VOTED_AN, LawStatus.AT_SENATE] })
            .orWhere('(law.status = :pendingStatus AND law.agendaDate < :today)', { pendingStatus: LawStatus.PENDING, today: new Date() })
            .getMany();

        if (candidates.length === 0) {
            this.logger.log('✅ Aucune loi candidate pour la vérification des promulgations.');
            return { updated: 0, errors: 0 };
        }

        this.logger.log(`🔍 ${candidates.length} loi(s) à analyser pour la promulgation...`);

        let updated = 0;
        let errors = 0;

        try {
            const response = await firstValueFrom(
                this.httpService.get(this.DOSSIER_ZIP_URL, {
                    responseType: 'arraybuffer',
                    headers: this.HEADERS,
                    timeout: 60000
                })
            );

            const zip = new AdmZip(Buffer.from(response.data));
            const zipEntries = zip.getEntries();
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
                        // Ignore
                    }
                }
            }

            for (const law of candidates) {
                try {
                    const dossierUid = law.externalId.replace('AN_', '');
                    const dossierData = dossiersMap.get(dossierUid);

                    if (dossierData) {
                        const hasChanged = await this.processDossier(law, dossierData);
                        if (hasChanged) {
                            updated++;
                        }
                    }
                } catch (err) {
                    this.logger.error(`❌ Erreur sur la loi ${law.externalId}: ${err.message}`);
                    errors++;
                }
            }
        } catch (error) {
            this.logger.error(`❌ Impossible de traiter le ZIP des promulgations : ${error.message}`);
            return { updated: 0, errors: 1 };
        }

        this.logger.log(`✅ Vérification terminée : ${updated} loi(s) mise(s) à jour, ${errors} erreur(s).`);
        return { updated, errors };
    }

    private async processDossier(law: Law, dossierData: any): Promise<boolean> {
        let isModified = false;

        // 1. Détecter la promulgation dans les actes législatifs
        let promulgationDate: Date | null = null;
        const extractPromulgation = (node: any) => {
            if (!node) return;
            if (Array.isArray(node)) {
                node.forEach(extractPromulgation);
            } else if (typeof node === 'object') {
                if (node.codeActe === 'PROM-PUB' && node.dateActe) {
                    promulgationDate = new Date(node.dateActe);
                }
                for (const key of Object.keys(node)) {
                    extractPromulgation(node[key]);
                }
            }
        };

        extractPromulgation(dossierData.actesLegislatifs);

        if (promulgationDate && !law.datePromulgation) {
            law.datePromulgation = promulgationDate;
            law.status = LawStatus.VALIDATED;
            law.navetteStatus = NavetteStatus.PROMULGUEE;
            law.isOnAgenda = false;
            isModified = true;
            this.logger.log(`🎉 [${law.externalId}] Loi promulguée le ${promulgationDate.toISOString().split('T')[0]} !`);
            
            // Queue notification if it's a recent change (last 10 days)
            if (new Date().getTime() - promulgationDate.getTime() < 10 * 24 * 60 * 60 * 1000) {
                await this.notificationService.queueMorningDigest(law.id);
            }
        }

        // 2. Détecter les navettes au Sénat
        if (law.status !== LawStatus.VALIDATED && law.status !== LawStatus.REJECTED) {
            // Check dossier title or state for senat status
            const etat = dossierData.procedureParlementaire?.titre?.toLowerCase() || '';
            const libelle = dossierData.etat?.toLowerCase() || '';
            
            let newNavette = law.navetteStatus;
            
            if (etat.includes('sénat') || libelle.includes('sénat')) {
                if (etat.includes('deuxième') || libelle.includes('deuxième')) {
                    newNavette = NavetteStatus.DEUXIEME_LECTURE_SENAT;
                } else {
                    newNavette = NavetteStatus.PREMIERE_LECTURE_SENAT;
                }
            } else if (etat.includes('mixte paritaire') || libelle.includes('mixte paritaire')) {
                newNavette = NavetteStatus.COMMISSION_MIXTE_PARITAIRE;
            }

            if (newNavette !== law.navetteStatus && 
                (newNavette === NavetteStatus.PREMIERE_LECTURE_SENAT || 
                 newNavette === NavetteStatus.DEUXIEME_LECTURE_SENAT || 
                 newNavette === NavetteStatus.COMMISSION_MIXTE_PARITAIRE)) {
                
                law.navetteStatus = newNavette;
                law.status = LawStatus.AT_SENATE;
                law.isOnAgenda = false;
                isModified = true;
                this.logger.log(`🏛️ [${law.externalId}] Passage au Sénat détecté : ${newNavette}`);
            }
        }

        // 3. Détecter les textes adoptés sans scrutin (procédure simplifiée)
        // If law is pending and vote date passed, but no scrutin was found
        if (law.status === LawStatus.PENDING && !law.deputyVoteResult && law.agendaDate && new Date(law.agendaDate) < new Date()) {
            const libelle = dossierData.etat?.toLowerCase() || '';
            if (libelle.includes('adopté') || libelle.includes('promulguée')) {
                // Créer un faux résultat "Adopté"
                law.deputyVoteResult = {
                    pour: 0,
                    contre: 0,
                    abstention: 0,
                    nonVotants: 0,
                    total: 0,
                    adopted: true,
                    isSimplified: true,
                    dateScrutin: law.agendaDate.toISOString()
                };
                law.status = libelle.includes('promulguée') ? LawStatus.VALIDATED : LawStatus.VOTED_AN;
                law.voteDate = law.agendaDate;
                law.isOnAgenda = false;
                isModified = true;
                this.logger.log(`⚠️ [${law.externalId}] Adoption sans scrutin public détectée (procédure simplifiée).`);
                
                // Since this was likely missed before, let's trigger notification if recent
                if (new Date().getTime() - law.agendaDate.getTime() < 10 * 24 * 60 * 60 * 1000) {
                    await this.notificationService.queueMorningDigest(law.id);
                }
            }
        }

        if (isModified) {
            await this.lawRepository.save(law);
        }

        return isModified;
    }
}
