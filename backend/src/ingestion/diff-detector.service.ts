import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Law } from '../laws/law.entity';

export interface LawChange {
    hasContentChanged: boolean;
    oldHash: string;
    newHash: string;
    changedFields: string[];
}

@Injectable()
export class DiffDetectorService {
    /**
     * Calcule le hash SHA-256 d'un contenu
     */
    computeHash(content: string): string {
        if (!content) return '';
        return createHash('sha256')
            .update(content)
            .digest('hex');
    }

    /**
     * Détecte les changements entre une loi existante et de nouvelles données
     */
    async detectChanges(existingLaw: Law, newData: any): Promise<LawChange> {
        const oldHash = existingLaw.contentHash || '';
        const newHash = this.computeHash(newData.content || '');

        const hasContentChanged = oldHash !== newHash && oldHash !== '';
        const changedFields: string[] = [];

        // Vérifier les champs modifiés
        if (existingLaw.titleOfficial !== newData.titleOfficial) {
            changedFields.push('titleOfficial');
        }
        if (this.computeHash(existingLaw.titleOfficial || '') !== this.computeHash(newData.content || '')) {
            changedFields.push('content');
        }
        if (existingLaw.navetteStatus !== newData.navetteStatus) {
            changedFields.push('navetteStatus');
        }

        return {
            hasContentChanged,
            oldHash,
            newHash,
            changedFields,
        };
    }
}
