import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate, CandidateStatus } from './candidate.entity';
import axios from 'axios';

@Injectable()
export class CandidatesSyncService {
    private readonly logger = new Logger(CandidatesSyncService.name);
    private readonly GITHUB_API_URL = 'https://api.github.com/repos/maximerat/politchique/contents/content/candidats';
    private readonly SITE_BASE_URL = 'https://www.candidatspresidentielles2027.fr';

    /**
     * Exclusions historiques (auparavant supprimées à chaque synchronisation).
     * Elles sont désormais créées avec le statut MASQUE, modifiable depuis l'admin.
     */
    static readonly LEGACY_HIDDEN_NAMES = ['jordan bardella'];

    constructor(
        @InjectRepository(Candidate)
        private readonly candidateRepository: Repository<Candidate>,
    ) {}

    /**
     * Synchronise la liste des candidats depuis https://www.candidatspresidentielles2027.fr
     * Met à jour les photos et crée les fiches des nouveaux candidats.
     */
    async syncCandidates(): Promise<{ updated: number; created: number; total: number; message: string }> {
        this.logger.log('🚀 Démarrage de la synchronisation des candidats 2027...');
        let updatedCount = 0;
        let createdCount = 0;

        try {
            // 1. Récupérer les candidats actuels en base
            const existingCandidates = await this.candidateRepository.find();

            // 3. Récupérer les fiches de candidats depuis l'API GitHub de politchique
            const response = await axios.get(this.GITHUB_API_URL, {
                headers: {
                    'User-Agent': 'DemokApp/1.0',
                    'Accept': 'application/vnd.github.v3+json',
                },
                timeout: 15000,
            });

            const files = response.data;
            if (!Array.isArray(files)) {
                throw new Error('Réponse GitHub invalide (pas un tableau de fichiers)');
            }

            for (const file of files) {
                if (!file.name.endsWith('.md') || !file.download_url) continue;

                try {
                    const fileRes = await axios.get(file.download_url, {
                        headers: { 'User-Agent': 'DemokApp/1.0' },
                        timeout: 10000,
                    });

                    const rawContent = typeof fileRes.data === 'string' ? fileRes.data : JSON.stringify(fileRes.data);
                    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                    if (!fmMatch) continue;

                    const fm = fmMatch[1];
                    const body = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();

                    const getVal = (key: string): string | null => {
                        const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
                        return m ? m[1].trim() : null;
                    };

                    const rawTitle = getVal('title') || '';
                    const name = rawTitle.replace(/\s*\([^)]*\)$/, '').trim();
                    const party = getVal('party') || '';
                    const photo = getVal('photo');
                    const photoSource = getVal('photoSource');
                    const description = getVal('description') || '';

                    if (!name) {
                        continue;
                    }

                    // Ignorer les profils qui précisent explicitement ne pas être candidats pour 2027
                    const isNotCandidate = /n'est pas candidat|pas candidate|n'est plus candidat|a renonc[ée]/i.test(body);
                    if (isNotCandidate) {
                        this.logger.log(`⏩ Profil ignoré (non candidat déclaré pour 2027) : ${name}`);
                        continue;
                    }

                    let photoUrl: string | null = null;
                    if (photo && photo.startsWith('/photos/')) {
                        const filename = photo.replace('/photos/', '');
                        photoUrl = `https://raw.githubusercontent.com/maximerat/politchique/main/public/photos/${filename}`;
                    } else if (photo && photo.startsWith('/')) {
                        const filename = photo.replace('/', '');
                        photoUrl = `https://raw.githubusercontent.com/maximerat/politchique/main/public/${filename}`;
                    } else if (photoSource && (photoSource.startsWith('http://') || photoSource.startsWith('https://'))) {
                        photoUrl = photoSource;
                    }

                    // Recherche du candidat dans la base
                    const candidateMatch = existingCandidates.find(c => 
                        this.normalize(c.name) === this.normalize(name)
                    );

                    if (candidateMatch) {
                        // Mise à jour de la photo si nécessaire
                        const shouldUpdatePhoto = photoUrl && (!candidateMatch.photoUrl || candidateMatch.photoUrl !== photoUrl);
                        if (shouldUpdatePhoto) {
                            await this.candidateRepository.update(candidateMatch.id, { photoUrl });
                            candidateMatch.photoUrl = photoUrl;
                            updatedCount++;
                            this.logger.log(`📸 Photo mise à jour pour : ${name}`);
                        }
                    } else {
                        // Création de la nouvelle fiche candidat
                        const isRoboticDescription = description && (description.startsWith('Fiche de constat') || description.startsWith('Synthèse neutre'));
                        const cleanDescription = (description && !isRoboticDescription)
                            ? description
                            : `${name} est candidat(e) à l'élection présidentielle de 2027.`;
                        const newCandidate = this.candidateRepository.create({
                            name,
                            party,
                            photoUrl,
                            description: cleanDescription,
                            programUrl: `${this.SITE_BASE_URL}/candidats/${file.name.replace('.md', '')}`,
                            displayOrder: 0,
                            status: this.isLegacyHidden(name) ? CandidateStatus.MASQUE : CandidateStatus.DECLARE,
                        });
                        await this.candidateRepository.save(newCandidate);
                        existingCandidates.push(newCandidate);
                        createdCount++;
                        this.logger.log(`✨ Nouveau candidat ajouté : ${name} (${party})`);
                    }
                } catch (fileErr) {
                    this.logger.error(`Erreur lors du traitement du fichier ${file.name}: ${fileErr.message}`);
                }
            }

            const total = await this.candidateRepository.count();
            this.logger.log(`✅ Synchronisation terminée : ${createdCount} créés, ${updatedCount} photos mises à jour, total ${total}`);
            return {
                updated: updatedCount,
                created: createdCount,
                total,
                message: `Synchronisation réussie : ${createdCount} nouveau(x) candidat(s), ${updatedCount} photo(s) actualisée(s).`,
            };
        } catch (error) {
            this.logger.error('❌ Erreur lors de la synchronisation des candidats', error.stack);
            throw error;
        }
    }

    isLegacyHidden(name: string): boolean {
        const norm = this.normalize(name);
        return CandidatesSyncService.LEGACY_HIDDEN_NAMES.includes(norm);
    }

    private normalize(str: string): string {
        return (str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
}
