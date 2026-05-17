import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

export interface GovernmentMember {
    name: string;
    role: string;
    isPresident?: boolean;
    isPM?: boolean;
    isMinisterEtat?: boolean;
}

@Injectable()
export class GovernmentService implements OnModuleInit {
    private readonly logger = new Logger(GovernmentService.name);
    private cachedGovernment: GovernmentMember[] = [];
    private readonly API_BASE_URL = 'https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records';

    constructor(private readonly httpService: HttpService) {}

    async onModuleInit() {
        // Initial fetch when server starts (non-blocking)
        this.fetchGovernmentComposition().catch(e =>
            this.logger.warn(`Gouvernement fetch initial échoué: ${e.message}`)
        );
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleCron() {
        this.logger.log('🔄 Cron quotidien : mise à jour composition gouvernement...');
        await this.fetchGovernmentComposition();
    }

    async getGovernmentComposition(): Promise<GovernmentMember[]> {
        if (this.cachedGovernment.length === 0) {
            await this.fetchGovernmentComposition();
        }
        return this.cachedGovernment;
    }

    private async fetchGovernmentComposition() {
        this.logger.log('🌐 Récupération composition gouvernement depuis l\'API officielle service-public.gouv.fr...');

        try {
            // On lance les 3 requêtes en parallèle pour la performance
            const [presData, pmData, minData] = await Promise.all([
                this.fetchFromApi('where=nom like "Présidence de la République"&limit=1'),
                this.fetchFromApi('where=nom like "Premier ministre"&limit=1'),
                this.fetchFromApi('where=nom like "Ministère" AND type_organisme="Administration centrale (ou Ministère)"&limit=100')
            ]);

            const members: GovernmentMember[] = [];

            // 1. Traitement Président
            if (presData && presData.length > 0) {
                const pres = this.mapRecordToMember(presData[0], true);
                if (pres) {
                    pres.isPresident = true;
                    members.push(pres);
                }
            }

            // 2. Traitement Premier Ministre
            if (pmData && pmData.length > 0) {
                const pm = this.mapRecordToMember(pmData[0], true);
                if (pm) {
                    pm.isPM = true;
                    // On s'assure que le rôle est bien "Premier ministre" même si l'org a un nom plus long
                    pm.role = "Premier ministre"; 
                    members.push(pm);
                }
            }

            // 3. Traitement Ministères
            if (minData && minData.length > 0) {
                minData.forEach(record => {
                    const minister = this.mapRecordToMember(record, false);
                    if (minister) {
                        // Le rôle est le nom du ministère (ex: "Ministère des Transports")
                        members.push(minister);
                    }
                });
            }

            if (members.length > 0) {
                // Tri optionnel : Président en premier, PM en second, puis les autres
                this.cachedGovernment = members.sort((a, b) => {
                    if (a.isPresident) return -1;
                    if (b.isPresident) return 1;
                    if (a.isPM) return -1;
                    if (b.isPM) return 1;
                    return a.role.localeCompare(b.role);
                });
                this.logger.log(`✅ Composition gouvernement mise à jour (filtre strict) : ${members.length} membres.`);
            } else {
                this.logger.warn('⚠️ Aucun membre trouvé via l\'API (filtre strict), conservation du cache existant.');
                if (this.cachedGovernment.length === 0) {
                    this.cachedGovernment = this.getFallbackGovernment();
                }
            }

        } catch (error) {
            this.logger.error(`❌ Erreur récupération gouvernement via API: ${error.message}`);
            if (this.cachedGovernment.length === 0) {
                this.logger.warn('Utilisation des données fallback.');
                this.cachedGovernment = this.getFallbackGovernment();
            }
        }
    }

    private async fetchFromApi(query: string): Promise<any[]> {
        const url = `${this.API_BASE_URL}?${query}`;
        const response = await firstValueFrom(
            this.httpService.get(url, {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Demok-App/1.0',
                }
            })
        );
        return response.data.results || [];
    }

    private mapRecordToMember(record: any, forceInclude: boolean = false): GovernmentMember | null {
        if (!record.affectation_personne) return null;

        try {
            const aff = JSON.parse(record.affectation_personne);
            if (!aff || aff.length === 0) return null;

            // On prend le premier responsable listé (généralement le ministre)
            const p = aff[0].personne;
            const functionName = aff[0].fonction || '';
            const functionLower = functionName.toLowerCase();

            // Filtrage strict : seulement les ministres (sauf si forceInclude pour Président/PM)
            if (!forceInclude) {
                const isMinister = functionLower.includes('ministre') || functionLower.includes('garde des sceaux');
                const isForbidden = ['adjoint', 'directeur', 'chef', 'secrétaire général', 'conseiller', 'chargé de mission', 'expert'].some(k => functionLower.includes(k));
                
                if (!isMinister || isForbidden) {
                    return null;
                }
            }
            
            // Formatage du nom : Prénom NOM (standard français pour l'annuaire)
            // On le transforme en "Prénom Nom"
            const firstName = p.prenom || '';
            const lastName = (p.nom || '').charAt(0).toUpperCase() + (p.nom || '').slice(1).toLowerCase();

            return {
                name: `${firstName} ${lastName}`,
                role: record.nom, // Le nom de l'organisation est souvent le meilleur rôle (ex: Ministère de la Culture)
                isMinisterEtat: functionLower.includes("ministre d'état") || functionLower.includes("ministre d’état")
            };
        } catch (e) {
            this.logger.warn(`Erreur parsing affectation pour ${record.nom}: ${e.message}`);
            return null;
        }
    }

    private getFallbackGovernment(): GovernmentMember[] {
        // Données Backup (Janvier 2025 - Gouvernement Bayrou)
        return [
            { name: 'Emmanuel Macron', role: 'Président de la République', isPresident: true },
            { name: 'François Bayrou', role: 'Premier Ministre', isPM: true },
            { name: 'Élisabeth Borne', role: "Ministre d'État, chargée de l'Éducation nationale" },
            { name: 'Gérald Darmanin', role: "Ministre d'État, Garde des Sceaux, Ministre de la Justice", isMinisterEtat: true },
            { name: 'Jean-Noël Barrot', role: "Ministre de l'Europe et des Affaires étrangères" },
            { name: 'Sébastien Lecornu', role: 'Ministre des Armées' },
            { name: 'Bruno Retailleau', role: "Ministre de l'Intérieur" },
            { name: 'Éric Lombard', role: "Ministre de l'Économie, des Finances et de l'Industrie" },
            { name: 'Amélie de Montchalin', role: "Ministre de la Transformation et de la Fonction publiques" },
            { name: 'Catherine Vautrin', role: 'Ministre du Travail, de la Santé, des Solidarités et des Familles' },
            { name: 'Rachida Dati', role: 'Ministre de la Culture' },
            { name: 'Annie Genevard', role: "Ministre de l'Agriculture" },
        ];
    }
}
