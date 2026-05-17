import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NormalizerService {
    private readonly logger = new Logger(NormalizerService.name);

    /**
     * Fusionne les lois provenant de l'AN et du Sénat
     * Détecte les lois en navette (même loi dans les 2 chambres)
     */
    merge(anLaws: any[], senatLaws: any[]): any[] {
        this.logger.log(`🔄 Normalisation de ${anLaws.length} lois AN + ${senatLaws.length} lois Sénat`);

        const mergedLaws: any[] = [];
        const processedIds = new Set<string>();

        // Ajouter toutes les lois de l'AN
        for (const anLaw of anLaws) {
            mergedLaws.push(anLaw);
            processedIds.add(anLaw.externalId);
        }

        // Ajouter les lois du Sénat (et détecter les doublons pour la navette)
        for (const senatLaw of senatLaws) {
            // Chercher si une loi similaire existe déjà (même titre)
            const existingLaw = mergedLaws.find(
                law => this.areSameLaw(law, senatLaw)
            );

            if (existingLaw) {
                // C'est la même loi en navette
                this.logger.log(`🔀 Navette détectée : ${senatLaw.titleOfficial}`);
                existingLaw.currentSource = 'BOTH';
                existingLaw.senatExternalId = senatLaw.externalId;
            } else {
                // Loi uniquement au Sénat
                mergedLaws.push(senatLaw);
                processedIds.add(senatLaw.externalId);
            }
        }

        this.logger.log(`✅ ${mergedLaws.length} lois après normalisation`);
        return mergedLaws;
    }

    /**
     * Détermine si deux lois sont identiques (même texte en navette)
     * TODO: Améliorer la détection avec numéro de dossier législatif
     */
    private areSameLaw(law1: any, law2: any): boolean {
        // Stratégie simple : comparaison de titre (à améliorer en Phase 3)
        const title1 = law1.titleOfficial.toLowerCase().trim();
        const title2 = law2.titleOfficial.toLowerCase().trim();

        // Enlever les préfixes "Projet de loi" / "Proposition de loi"
        const cleanTitle1 = title1.replace(/^(projet|proposition) de loi (relative? )?(à|au|aux|pour|sur) /, '');
        const cleanTitle2 = title2.replace(/^(projet|proposition) de loi (relative? )?(à|au|aux|pour|sur) /, '');

        return cleanTitle1 === cleanTitle2;
    }
}
