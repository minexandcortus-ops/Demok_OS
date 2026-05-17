import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as AdmZip from 'adm-zip';
import { Law, LawStatus, NavetteStatus } from '../laws/law.entity';
import { Deputy } from '../votes/deputy.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { VoteChoice } from '../votes/vote.types';
import { AmendementIngestionService } from './amendement-ingestion.service';
import { CompteRenduScrapingService } from './compte-rendu-scraping.service';

@Injectable()
export class DeputyVoteIngestionService {
    private readonly logger = new Logger(DeputyVoteIngestionService.name);

    // URL du ZIP des scrutins AN (Législature 17)
    private readonly SCRUTINS_ZIP_URL =
        'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip';

    // URL du ZIP des dossiers AN (pour les slugs de scraping)
    private readonly DOSSIERS_ZIP_URL =
        'http://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip';

    // Cache du ZIP (1h)
    private scrutinsCache: { data: any[]; timestamp: number } | null = null;
    private dossiersCache: { data: Map<string, string>; timestamp: number } | null = null;
    private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

    constructor(
        private readonly httpService: HttpService,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        @InjectRepository(Deputy)
        private readonly deputyRepository: Repository<Deputy>,
        @InjectRepository(OfficialVote)
        private readonly officialVoteRepository: Repository<OfficialVote>,
        private readonly amendementIngestionService: AmendementIngestionService,
        private readonly crScrapingService: CompteRenduScrapingService,
    ) { }

    /**
     * Point d'entrée principal : résout les lois dont la date est passée via l'Open Data (ZIP).
     * @param force Si true, re-synchronise même les lois ayant déjà un résultat.
     */
    async syncDeputyVotes(force: boolean = false): Promise<{ resolved: number; skipped: number; errors: number }> {
        this.logger.log(`🗳️ Synchronisation des votes des députés (Source: Open Data AN, Force: ${force})...`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const query = this.lawRepository.createQueryBuilder('law');
        
        if (force) {
            query.where('law.status IN (:...votedStatuses)', { 
                votedStatuses: [LawStatus.VOTED_AN, LawStatus.REJECTED] 
            }).orWhere('(law.status = :pendingStatus AND law.agendaDate < :today)', {
                pendingStatus: LawStatus.PENDING,
                today
            }).orWhere('(law.status = :pendingStatus AND law.agendaDate IS NULL)', {
                pendingStatus: LawStatus.PENDING
            });
        } else {
            query.where('(law.status = :pendingStatus AND law.agendaDate < :today)')
                .orWhere('(law.status = :pendingStatus AND law.agendaDate IS NULL)')
                .orWhere('(law.status IN (:...votedStatuses) AND law.deputyVoteResult IS NULL)')
                .setParameters({
                    pendingStatus: LawStatus.PENDING,
                    today,
                    votedStatuses: [LawStatus.VOTED_AN, LawStatus.REJECTED]
                });
        }

        const allLaws = await query.getMany();

        if (allLaws.length === 0) {
            this.logger.log('✅ Aucune loi à mettre à jour.');
            return { resolved: 0, skipped: 0, errors: 0 };
        }

        this.logger.log(`📋 ${allLaws.length} loi(s) à vérifier.`);

        const scrutins = await this.fetchScrutins();
        const dossiersMap = await this.fetchDossiers();
        this.logger.log(`📊 ${scrutins.length} scrutins et ${dossiersMap.size} dossiers disponibles.`);

        let resolved = 0;
        let skipped = 0;
        let errors = 0;

        for (const law of allLaws) {
            try {
                const hasDate = law.agendaDate != null;
                const agendaDate = hasDate ? new Date(law.agendaDate) : null;
                const daysSince = hasDate
                    ? Math.floor((today.getTime() - agendaDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 999;

                const scrutin = scrutins.length > 0 ? this.findMatchingScrutin(law, scrutins) : null;

                if (scrutin) {
                    this.logger.log(`✅ Scrutin officiel trouvé pour "${law.titleOfficial.substring(0, 50)}..."`);
                    await this.processScrutin(law, scrutin);
                    
                    this.amendementIngestionService.ingestAmendements(law).catch(e =>
                        this.logger.warn(`⚠️ Re-sync amendements après vote officiel : ${e.message}`)
                    );
                    resolved++;
                } else {
                    let scrapedFound = false;
                    if (law.agendaDate) {
                        this.logger.log(`🔍 Aucun scrutin public pour "${law.externalId}". Tentative de scraping des CR du ${law.agendaDate}...`);
                        const scraped = await this.crScrapingService.scrapeResultsFromDay(new Date(law.agendaDate), law);
                        if (scraped) {
                            this.logger.log(`🗳️ Résultats trouvés via scraping CR : ${scraped.pour}/${scraped.contre}`);
                            await this.applyScrapedResult(law, scraped);
                            resolved++;
                            scrapedFound = true;
                        }
                    }

                    if (!scrapedFound) {
                        const statusLabel = daysSince > 30 ? 'très ancienne' : `${daysSince}j`;
                        this.logger.log(`⏳ Discussion toujours en cours pour "${law.externalId}" (${statusLabel}), en attente de scrutin.`);
                        skipped++;
                    }
                }
            } catch (error) {
                this.logger.error(`❌ Erreur sur loi ${law.externalId}: ${error.message}`);
                errors++;
            }
        }

        await this.transitionUpcomingToPending();

        this.logger.log(`🎉 Sync terminées : ${resolved} résolues, ${skipped} en attente, ${errors} erreurs`);
        return { resolved, skipped, errors };
    }

    private async transitionUpcomingToPending(): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const result = await this.lawRepository
            .createQueryBuilder()
            .update(Law)
            .set({ status: LawStatus.PENDING })
            .where('status = :status', { status: LawStatus.UPCOMING })
            .andWhere('agendaDate < :today', { today })
            .execute();

        if (result.affected && result.affected > 0) {
            this.logger.log(`🔄 ${result.affected} loi(s) passées de UPCOMING → PENDING`);
        }
    }

    private async fetchScrutins(): Promise<any[]> {
        if (this.scrutinsCache && (Date.now() - this.scrutinsCache.timestamp) < this.CACHE_TTL_MS) {
            return this.scrutinsCache.data;
        }

        try {
            this.logger.log('🌐 Téléchargement de l\'Open Data (ZIP des scrutins)...');
            const response = await firstValueFrom(
                this.httpService.get(this.SCRUTINS_ZIP_URL, {
                    timeout: 120000,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Démok/1.0)' },
                })
            );

            const scrutins = this.parseScrutinsZip(response.data);
            this.scrutinsCache = { data: scrutins, timestamp: Date.now() };
            return scrutins;
        } catch (error) {
            this.logger.error(`❌ Erreur téléchargement scrutins: ${error.message}`);
            return [];
        }
    }

    private async fetchDossiers(): Promise<Map<string, string>> {
        if (this.dossiersCache && (Date.now() - this.dossiersCache.timestamp) < this.CACHE_TTL_MS) {
            return this.dossiersCache.data;
        }

        try {
            this.logger.log('🌐 Téléchargement des Dossiers (ZIP)...');
            const response = await firstValueFrom(
                this.httpService.get(this.DOSSIERS_ZIP_URL, {
                    timeout: 120000,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Démok/1.0)' },
                })
            );

            const map = new Map<string, string>();
            const zip = new AdmZip(response.data);
            const entries = zip.getEntries();

            for (const entry of entries) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(zip.readAsText(entry));
                    const dossier = data.dossierLegislatif || data;
                    if (dossier?.uid) {
                        const slug = dossier.titre?.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(); 
                        map.set(dossier.uid, slug);
                    }
                } catch { }
            }

            this.dossiersCache = { data: map, timestamp: Date.now() };
            return map;
        } catch (error) {
            this.logger.error(`❌ Erreur téléchargement dossiers: ${error.message}`);
            return new Map();
        }
    }

    private parseScrutinsZip(buffer: Buffer): any[] {
        try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            const scrutins: any[] = [];

            for (const entry of entries) {
                if (entry.isDirectory || !entry.entryName.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(zip.readAsText(entry));
                    const scrutin = data.scrutin || data;
                    if (scrutin?.uid) {
                        scrutins.push(scrutin);
                    }
                } catch { }
            }
            return scrutins;
        } catch (error) {
            this.logger.error(`Erreur parsing ZIP scrutins: ${error.message}`);
            return [];
        }
    }

    private findMatchingScrutin(law: Law, scrutins: any[]): any | null {
        const lawExternalId = (law.externalId || '').replace(/^AN_/, '');
        const lawTitleNorm = this.normalizeTitle(law.titleOfficial || '');
        const docNumbers = law.documentNumbers || [];
        
        // Normalisation robuste : on compare sans préfixe AN_, sans séparateurs
        const normalizeDossierRef = (ref: string | undefined): string => {
            if (!ref) return '';
            return String(ref).replace(/^AN_/, '').toUpperCase();
        };
        const normLawId = normalizeDossierRef(law.externalId);
        
        const candidates = scrutins.filter(s => {
            // 1. Match par DossierRef
            const rawRef = s.dossierRef 
                || s.dossierParlementaireRef 
                || s.textesAssocies?.texteLegislatif?.dossierRef
                || s.miseEnExamen?.dossierRef
                || s.objet?.dossierRef;
            const normRef = normalizeDossierRef(rawRef);
            if (normRef && normRef === normLawId) return true;

            // 2. Match par Numéro de Document (SI DISPONIBLE)
            // On cherche si l'un des numéros de doc de la loi (ex: 2413) est dans le titre ou les refs du scrutin
            if (docNumbers.length > 0) {
                const sTitre = (s.titre || s.libelle || '').toLowerCase();
                const sRef = (s.objet?.reference || s.miseEnExamen?.reference || '').toLowerCase();
                const hasDocMatch = docNumbers.some(num => 
                    (sTitre.includes(`n° ${num}`) || sTitre.includes(`n°${num}`) || sTitre.includes(` ${num}`)) ||
                    (sRef.includes(num.toLowerCase()))
                );
                if (hasDocMatch) {
                    this.logger.debug(`🎯 Match trouvé par numéro de document (${docNumbers.join(', ')}) pour scrutin ${s.uid}`);
                    return true;
                }
            }

            return false;
        });

        if (candidates.length === 0) {
            // 3. Match par Titre (Similitude)
            const candidatesByTitle = scrutins.filter(s => {
                const scrutinTitle = this.normalizeTitle(s.titre || s.libelle || '');
                return scrutinTitle.length > 20 && this.similarity(lawTitleNorm, scrutinTitle) > 0.75;
            });
            candidates.push(...candidatesByTitle);
        }

        if (candidates.length === 0) {
            this.logger.debug(`🔍 Aucun scrutin trouvé pour ${law.externalId} / DocNum: ${docNumbers.join(', ')}`);
            return null;
        }

        const getScore = (s: any) => {
            const titre = (s.titre || s.libelle || '').toLowerCase();
            let score = 0;
            // Éliminer les scrutins sur des amendements précis (trop granulaires)
            if (titre.match(/article \d+/) || titre.includes('alinéa') || titre.includes('paragraphe')) return -100;
            if (titre.includes('amendement') && !titre.includes('ensemble')) return -100;
            
            // Prioriser les votes sur l'ENSEMBLE
            if (titre.includes('motion de rejet') || titre.includes('motion de renvoi')) return -50;
            if (titre.includes('ensemble')) score += 60;
            if (titre.includes('article unique')) score += 55;
            if (titre.includes('solennel')) score += 40;
            if (titre.includes('commission mixte paritaire') || titre.includes('cmp')) score += 30;
            if (titre.includes('adoption définitive') || titre.includes('lecture définitive')) score += 25;
            if (titre.includes('première lecture') || titre.includes('nouvelle lecture')) score += 10;
            
            // Bonus de proximité de date
            if (law.agendaDate) {
                const sDate = new Date(s.dateScrutin);
                const aDate = new Date(law.agendaDate);
                const diffDays = Math.abs(aDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24);
                if (diffDays <= 1) score += 20;
                else if (diffDays > 5) score -= 40;
            }
            return score;
        };

        const sorted = candidates
            .map(s => ({ scrutin: s, score: getScore(s) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        if (sorted.length > 0) {
            this.logger.log(`✅ Scrutin matché pour ${law.externalId} : ${sorted[0].scrutin.uid} (Score: ${sorted[0].score})`);
            return sorted[0].scrutin;
        }

        return null;
    }

    private async processScrutin(law: Law, scrutin: any): Promise<void> {
        const scrutinId = scrutin.uid || scrutin.numero;
        const dateScrutin = scrutin.dateScrutin || new Date().toISOString().split('T')[0];
        const synthese = scrutin.syntheseVote || scrutin.synthese || scrutin;
        const decompte = synthese.decompte || scrutin.decompte || {};

        const pour = parseInt(decompte.pour || synthese.nombrePour || synthese.pour || '0', 10);
        const contre = parseInt(decompte.contre || synthese.nombreContre || synthese.contre || '0', 10);
        const abstention = parseInt(decompte.abstentions || synthese.nombreAbstentions || synthese.abstentions || '0', 10);
        const nonVotants = parseInt(decompte.nonVotants || synthese.nombreNonVotants || synthese.nonVotants || '0', 10);
        const total = pour + contre + abstention;
        const adopted = (synthese.resultat === 'adopté' || scrutin.annonce === "l'Assemblée nationale a adopté" || pour > contre);

        law.deputyVoteResult = { pour, contre, abstention, nonVotants, total, adopted, scrutinId, dateScrutin };
        law.status = this.determineNewStatus(law, scrutin, adopted);
        law.isOnAgenda = false;
        law.voteDate = new Date(dateScrutin);

        await this.lawRepository.save(law);
        await this.storeIndividualVotes(law, scrutin, scrutinId, dateScrutin);
    }

    private determineNewStatus(law: Law, scrutin: any, adopted: boolean): LawStatus {
        if (law.datePromulgation) return LawStatus.VALIDATED;
        const navetteStatus = law.navetteStatus;
        if (navetteStatus === NavetteStatus.PREMIERE_LECTURE_SENAT ||
            navetteStatus === NavetteStatus.DEUXIEME_LECTURE_SENAT ||
            navetteStatus === NavetteStatus.COMMISSION_MIXTE_PARITAIRE) {
            return LawStatus.AT_SENATE;
        }
        return adopted ? LawStatus.VOTED_AN : LawStatus.REJECTED;
    }

    private async storeIndividualVotes(law: Law, scrutin: any, scrutinId: string, dateScrutin: string): Promise<void> {
        const groupes = scrutin.groupes?.groupe;
        if (!groupes) return;
        const groupesList = Array.isArray(groupes) ? groupes : [groupes];

        for (const groupe of groupesList) {
            const groupeLibelle = groupe.organeRef || groupe.libelle || 'Inconnu';
            await this.processVoteGroup(law, groupe.vote?.decompteVoix?.pour?.votant, VoteChoice.FOR, groupeLibelle, scrutinId, dateScrutin);
            await this.processVoteGroup(law, groupe.vote?.decompteVoix?.contre?.votant, VoteChoice.AGAINST, groupeLibelle, scrutinId, dateScrutin);
            await this.processVoteGroup(law, groupe.vote?.decompteVoix?.abstentions?.votant, VoteChoice.ABSTAIN, groupeLibelle, scrutinId, dateScrutin);
        }
    }

    private async processVoteGroup(law: Law, votants: any, choice: VoteChoice, groupeLibelle: string, scrutinId: string, dateScrutin: string): Promise<void> {
        if (!votants) return;
        const votantsList = Array.isArray(votants) ? votants : [votants];

        for (const votant of votantsList) {
            const acteurRef = votant.acteurRef || votant.uid;
            if (!acteurRef) continue;

            try {
                let deputy = await this.deputyRepository.findOne({ where: { anActeurRef: acteurRef } });
                if (!deputy) {
                    deputy = this.deputyRepository.create({
                        externalId: acteurRef,
                        anActeurRef: acteurRef,
                        fullName: votant.nom || acteurRef,
                        groupePolitique: groupeLibelle,
                    });
                    await this.deputyRepository.save(deputy);
                }

                const existingVote = await this.officialVoteRepository.findOne({
                    where: { deputy: { id: deputy.id }, law: { id: law.id } },
                });

                if (!existingVote) {
                    const officialVote = this.officialVoteRepository.create({
                        deputy, law, choice, voteDate: new Date(dateScrutin), scrutinId,
                    });
                    await this.officialVoteRepository.save(officialVote);
                }
            } catch { }
        }
    }

    private async applyScrapedResult(law: Law, result: any): Promise<void> {
        // Cas 4 : Vote reporté à une séance ultérieure
        if (result.voteDeferred) {
            this.logger.log(`📅 Loi ${law.externalId} : vote reporté à une date ultérieure.`);
            law.status = LawStatus.PENDING;
            law.isOnAgenda = false; // Sortie de l'ordre du jour immédiat
            // Si une nouvelle date a été détectée dans le CR, on la met à jour
            if (result.nextSessionDate) {
                law.agendaDate = new Date(result.nextSessionDate);
                this.logger.log(`📅 Nouvelle date détectée : ${result.nextSessionDate}`);
            }
            // On stocke l'info de report dans la fiche détail
            law.votePostponedInfo = result.deferredReason || 'Vote reporté à une prochaine séance';
            await this.lawRepository.save(law);
            return;
        }

        // Cas 4b : Discussion en cours (loi identifiée dans la séance mais pas de vote final)
        if (result.inDiscussion) {
            this.logger.log(`ℹ️ Loi ${law.externalId} toujours en discussion (détecté via CR).`);
            law.status = LawStatus.PENDING;
            law.isOnAgenda = true;
            await this.lawRepository.save(law);
            return;
        }

        const isMainLevee = result.isMainLevee || false;
        const isSimplified = result.isSimplified || false;

        law.deputyVoteResult = {
            pour: result.pour,
            contre: result.contre,
            abstention: result.abstention || 0,
            nonVotants: 0,
            total: result.total,
            adopted: result.adopted,
            // Cas 3 : vote à main levée → pas de décompte numérique officiel
            voteType: isMainLevee ? 'main_levee' : (isSimplified ? 'article_unique' : 'scrutin_public'),
            isSimplified,
            isMainLevee,
            dateScrutin: result.dateScrutin,
            scrutinId: isMainLevee ? 'main_levee_' + Date.now() 
                      : isSimplified ? 'simplified_' + Date.now() 
                      : 'scraped_' + Date.now(),
        };
        law.status = result.adopted ? LawStatus.VOTED_AN : LawStatus.REJECTED;
        law.isOnAgenda = false;
        law.voteDate = new Date(result.dateScrutin);
        await this.lawRepository.save(law);
        this.logger.log(`✅ Résultats scrapés appliqués pour ${law.externalId} (type: ${law.deputyVoteResult.voteType})`);
    }

    private normalizeTitle(title: string): string {
        return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    private similarity(a: string, b: string): number {
        const wordsA = new Set(a.split(' ').filter(w => w.length > 4));
        const wordsB = new Set(b.split(' ').filter(w => w.length > 4));
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        let common = 0;
        wordsA.forEach(w => { if (wordsB.has(w)) common++; });
        return common / Math.max(wordsA.size, wordsB.size);
    }
}
