import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deputy } from '../votes/deputy.entity';
import axios from 'axios';
import * as fs from 'fs';
import { join } from 'path';
import { Mistral } from '@mistralai/mistralai';
import * as AdmZip from 'adm-zip';

@Injectable()
export class DeputySyncService {
    private readonly logger = new Logger(DeputySyncService.name);

    constructor(
        @InjectRepository(Deputy)
        private readonly deputyRepository: Repository<Deputy>,
    ) {}

    async syncDeputiesFromNosDeputes() {
        this.logger.log('🔄 Début de la synchronisation des députés depuis CLAIR.vote...');
        
        let activeAnRefs = new Set<string>();
        try {
            this.logger.log('📥 Lecture de la liste officielle des députés actifs depuis le fichier local (AN)...');
            const localZipPath = join(process.cwd(), 'AMO10_deputes.zip');
            if (!fs.existsSync(localZipPath)) {
                throw new Error('Fichier AMO10_deputes.zip introuvable localement.');
            }
            const zip = new AdmZip(localZipPath);
            const zipEntries = zip.getEntries();
            
            for (const entry of zipEntries) {
                // On s'intéresse uniquement aux fichiers d'acteurs
                if (entry.entryName.includes('acteur') && !entry.entryName.includes('mandat') && entry.entryName.endsWith('.json')) {
                    const acteurJson = JSON.parse(entry.getData().toString('utf8'));
                    const uid = acteurJson.acteur?.uid?.['#text'];
                    if (uid) {
                        activeAnRefs.add(uid);
                    }
                }
            }
            this.logger.log(`✅ ${activeAnRefs.size} députés actifs identifiés dans l'hémicycle (Source officielle).`);
        } catch (err) {
            this.logger.error(`❌ Erreur lors de la récupération des actifs AN : ${err.message}`);
        }

        try {
            let updatedCount = 0;
            let deactivatedCount = 0;
            const newActeurRefs = new Set<string>();
            let page = 1;
            let hasNext = true;

            while (hasNext) {
                const url = `https://clair-production.up.railway.app/api/v1/deputes?limit=200&page=${page}`;
                const response = await axios.get(url, { headers: { 'User-Agent': 'DemokApp/1.0' } });
                const json = response.data;
                
                if (!json.data || json.data.length === 0) break;

                for (const item of json.data) {
                    if (item.actif === false) continue;

                    const photoUrlMatches = item.photoUrl?.split('/').pop()?.replace('.jpg', '');
                    if (!photoUrlMatches) continue;

                    const anActeurRef = `PA${photoUrlMatches}`;
                    const prenom = item.prenom;
                    const nom = item.nom;
                    const fullName = `${prenom} ${nom}`;

                    let deputy = await this.deputyRepository.findOne({ where: { anActeurRef } });
                    
                    if (!deputy) {
                        deputy = this.deputyRepository.create({
                            anActeurRef: anActeurRef,
                            externalId: anActeurRef,
                            fullName: fullName,
                        });
                    }

                    deputy.fullName = fullName;
                    deputy.lastName = nom;
                    deputy.party = item.groupe?.nomComplet || item.groupe?.nom || 'Non inscrit';
                    
                    // Statistiques
                    deputy.presenceWeeks = item.stats?.presence || 0;
                    deputy.votesCount = item.votesCount || 0;
                    
                    const numDeptmt = item.circonscription?.departement || '';
                    const numCirco = item.circonscription?.numero || '';
                    deputy.department = `(${numDeptmt}) - ${numCirco}ème circonscription`;
                    deputy.constituencyCode = `${numDeptmt}-${numCirco}`;
                    
                    deputy.photoUrl = `/api/deputies/photo/${photoUrlMatches}.jpg`;
                    
                    const sexeS = item.sexe === 'H' || item.sexe === 'M' ? '' : 'e';
                    const elS = item.sexe === 'H' || item.sexe === 'M' ? 'Il' : 'Elle';
                    const partiClean = deputy.party === 'Non inscrit' ? 'les Non inscrits' : `le parti ${deputy.party}`;
                    
                    const fallbackBio = `${prenom} ${nom} est un${sexeS} député${sexeS} pour ${partiClean}. ${elS} a été élu${sexeS} dans la ${numCirco}ème circonscription du département (${numDeptmt}).`;
                    
                    const rawBio = item.resumeIA || item.parcoursIA || fallbackBio;

                    // Si on a Mistral configuré et qu'on veut rafraîchir ou raccourcir la bio (optionnel)
                    if (process.env.MISTRAL_API_KEY && (!deputy.bio || deputy.bio.length > 250)) {
                        try {
                            const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
                            const chatResponse = await mistral.chat.complete({
                                model: 'mistral-small-latest',
                                messages: [{
                                    role: 'user', 
                                    content: `Résume la biographie suivante en une ou deux phrases courtes et accrocheuses (maximum 200 caractères), adaptées pour une application mobile citoyenne. Ne mets pas de gras ni d'introduction, donne juste le texte:\n\n${rawBio}` 
                                }],
                            });
                            const shortBio = chatResponse.choices?.[0]?.message?.content;
                            if (typeof shortBio === 'string') {
                                deputy.bio = shortBio.trim();
                            } else {
                                deputy.bio = rawBio;
                            }
                        } catch (err) {
                            this.logger.warn(`Erreur Mistral pour ${fullName}: ${err.message}`);
                            deputy.bio = rawBio;
                        }
                    } else if (!deputy.bio) {
                        deputy.bio = rawBio;
                    }

                    // Pause de 1.5s pour éviter le Rate Limit de Mistral
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Si on a réussi à parser l'AN, on utilise cette source stricte, sinon on met true par défaut.
                    if (activeAnRefs.size > 0) {
                        deputy.isActive = activeAnRefs.has(anActeurRef);
                    } else {
                        deputy.isActive = true;
                    }
                    
                    newActeurRefs.add(anActeurRef);
                    await this.deputyRepository.save(deputy);
                    updatedCount++;
                }

                hasNext = json.meta?.hasNext || false;
                page++;
            }

            // 3. Désactiver les anciens
            const allExistingDeputies = await this.deputyRepository.find();
            for (const deputy of allExistingDeputies) {
                if (deputy.anActeurRef && !newActeurRefs.has(deputy.anActeurRef)) {
                    deputy.isActive = false;
                    deputy.department = null;
                    await this.deputyRepository.save(deputy);
                    deactivatedCount++;
                }
            }

            // 4. Nettoyage physique du dossier si des photos y restent
            try {
                const photosDir = join(process.cwd(), 'public', 'photos');
                if (fs.existsSync(photosDir)) {
                    fs.rmSync(photosDir, { recursive: true, force: true });
                }
            } catch (e) {
                this.logger.warn('Erreur lors du nettoyage du dossier photos local: ' + e.message);
            }

            this.logger.log(`✅ Synchronisation terminée. ${updatedCount} députés actifs mis à jour/créés depuis CLAIR. ${deactivatedCount} anciens députés désactivés.`);
        } catch (error) {
            this.logger.error(`❌ Erreur lors de la synchronisation depuis CLAIR : ${error.message}`);
        }
    }
}
