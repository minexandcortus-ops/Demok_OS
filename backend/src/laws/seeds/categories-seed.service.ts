import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../category.entity';

interface CategorySeed {
    name: string;
    slug: string;
    color: string;
    icon: string;
    keywords: string;
}

@Injectable()
export class CategoriesSeedService implements OnModuleInit {
    private readonly logger = new Logger(CategoriesSeedService.name);

    private readonly categories: CategorySeed[] = [
        {
            name: 'Finances',
            slug: 'finances',
            color: '#FFD700',
            icon: '💰',
            keywords: 'loi de finances,projet de loi de finances,loi de finances rectificative,budget,budgétaire,fiscalité,fiscal,impôt,impôts,impôt sur le revenu,taxe,taxes,TVA,dette publique,déficit,finances publiques,prélèvements obligatoires,trésor,crédit d\'impôt,niche fiscale,cour des comptes,dépense publique',
        },
        {
            name: 'Social & Santé',
            slug: 'social_sante',
            color: '#FF6B6B',
            icon: '🏥',
            keywords: 'sécurité sociale,financement de la sécurité sociale,santé,santé publique,hôpital,hôpitaux,assurance maladie,médecin,médecins,soins,soins palliatifs,patients,médicament,médicaments,handicap,dépendance,autonomie,allocations,CAF,CPAM,solidarité,EHPAD,maladie',
        },
        {
            name: 'Travail',
            slug: 'travail',
            color: '#4ECDC4',
            icon: '💼',
            keywords: 'code du travail,emploi,chômage,assurance chômage,formation professionnelle,apprentissage,dialogue social,syndicats,syndical,salaire,salaires,salariés,SMIC,contrat de travail,fonction publique,fonctionnaires,congés,retraite,retraites,réforme des retraites,licenciement,CDI,CDD,télétravail,travailleurs',
        },
        {
            name: 'Éducation',
            slug: 'education',
            color: '#95E1D3',
            icon: '📚',
            keywords: 'éducation,éducation nationale,enseignement,enseignement supérieur,école,écoles,collège,lycée,université,universités,recherche,étudiants,élèves,professeurs,enseignants,baccalauréat,diplôme,scolaire,campus',
        },
        {
            name: 'Justice',
            slug: 'justice',
            color: '#8B4513',
            icon: '⚖️',
            keywords: 'justice,justice pénale,droit pénal,code pénal,droit civil,code civil,tribunal,tribunaux,juge,juges,magistrats,procédure pénale,procédure judiciaire,prison,prisons,détenus,pénitentiaire,peine,peines,condamnation,avocat,avocats,procès,libertés publiques',
        },
        {
            name: 'Sécurité',
            slug: 'securite',
            color: '#1A535C',
            icon: '🚨',
            keywords: 'sécurité intérieure,police,policiers,gendarmerie,gendarmes,forces de l\'ordre,défense nationale,défense,armée,armées,militaire,militaires,programmation militaire,terrorisme,terroriste,cybersécurité,renseignement,criminalité,délinquance,narcotrafic,stupéfiants,vidéoprotection,surveillance',
        },
        {
            name: 'Écologie',
            slug: 'ecologie',
            color: '#2ECC71',
            icon: '🌱',
            keywords: 'écologie,écologique,transition écologique,transition énergétique,climat,climatique,biodiversité,énergie,énergies renouvelables,nucléaire,éolien,photovoltaïque,pollution,déchets,eau,qualité de l\'air,environnement,environnemental,carbone,émissions,développement durable,protection animale,bien-être animal',
        },
        {
            name: 'Aménagement',
            slug: 'amenagement',
            color: '#9B59B6',
            icon: '🏗️',
            keywords: 'urbanisme,logement,logements,logement social,construction,bâtiment,transports,transport,mobilité,mobilités,infrastructures,routes,routier,ferroviaire,SNCF,aménagement du territoire,ruralité,rural,montagne,littoral,ville,villes,métropole,métropoles',
        },
        {
            name: 'Agriculture',
            slug: 'agriculture',
            color: '#F39C12',
            icon: '🌾',
            keywords: 'agriculture,agricole,agricoles,agriculteurs,agriculteur,élevage,éleveurs,pêche,pêcheurs,aquaculture,alimentation,alimentaire,filières agricoles,PAC,politique agricole commune,forêt,forêts,viticulture,exploitation agricole,céréales,pesticides',
        },
        {
            name: 'Culture',
            slug: 'culture',
            color: '#E91E63',
            icon: '🎭',
            keywords: 'culture,culturel,culturelle,patrimoine,arts,création artistique,artistes,médias,audiovisuel,presse,journalistes,cinéma,musées,musée,sport,sportifs,jeux olympiques,spectacle,spectacles,théâtre,musique,livre,lecture,bibliothèques',
        },
        {
            name: 'International',
            slug: 'international',
            color: '#3498DB',
            icon: '🌍',
            keywords: 'relations internationales,affaires étrangères,Union européenne,européen,européenne,Europe,diplomatie,diplomatique,coopération internationale,francophonie,traité,traités,accord international,convention internationale,ratification,UE,ONU,OTAN',
        },
        {
            name: 'Économie & entreprises',
            slug: 'economie',
            color: '#F97316',
            icon: '🏭',
            keywords: 'économie,économique,vie économique,simplification de la vie économique,entreprise,entreprises,PME,TPE,start-up,industrie,industriel,commerce,commerçants,artisanat,artisans,consommation,consommateurs,concurrence,pouvoir d\'achat,banque,banques,assurance,assurances,croissance,attractivité,souveraineté économique',
        },
        {
            name: 'Société & vie quotidienne',
            slug: 'societe_vie',
            color: '#EC4899',
            icon: '🏠',
            keywords: 'famille,familles,enfance,enfants,parents,mariage,divorce,fin de vie,aide à mourir,soins palliatifs,bioéthique,PMA,adoption,égalité femmes-hommes,égalité entre les femmes et les hommes,violences conjugales,violences faites aux femmes,discriminations,laïcité,associations,vie associative,jeunesse,animaux de compagnie',
        },
        {
            name: 'Numérique',
            slug: 'numerique',
            color: '#06B6D4',
            icon: '💻',
            keywords: 'numérique,numériques,internet,plateformes,plateformes en ligne,réseaux sociaux,intelligence artificielle,données personnelles,RGPD,protection des données,cloud,télécommunications,fibre,5G,espace numérique,contenus en ligne,cyberharcèlement,écrans',
        },
        {
            name: 'Immigration & nationalité',
            slug: 'immigration',
            color: '#8B5CF6',
            icon: '🛂',
            keywords: 'immigration,immigrés,étrangers,étranger,asile,droit d\'asile,demandeurs d\'asile,titre de séjour,titres de séjour,séjour des étrangers,nationalité,naturalisation,intégration,expulsion,éloignement,OQTF,regroupement familial,frontières,contrôle aux frontières,migrants,migratoire',
        },
        {
            name: 'Institutions',
            slug: 'institutions',
            color: '#34495E',
            icon: '🏛️',
            keywords: 'constitution,constitutionnel,constitutionnelle,révision constitutionnelle,pouvoirs publics,collectivités territoriales,collectivités,décentralisation,élections,électoral,scrutin,vie démocratique,Sénat,Assemblée nationale,Parlement,parlementaire,députés,député,sénateurs,gouvernement,République,référendum,communes,maires,départements,régions',
        },
    ];

    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
    ) { }

    async onModuleInit() {
        await this.seedCategories();
    }

    private async seedCategories() {
        const existing = await this.categoryRepository.find();
        const bySlug = new Map(existing.map((c) => [c.slug, c]));
        let created = 0;
        let updated = 0;

        for (const categoryData of this.categories) {
            const current = bySlug.get(categoryData.slug);
            if (!current) {
                await this.categoryRepository.save(this.categoryRepository.create(categoryData));
                created++;
            } else if (current.keywords !== categoryData.keywords) {
                // Les mots-clés sont gérés dans le code : on les resynchronise (nom, couleur et icône conservés)
                await this.categoryRepository.update(current.id, { keywords: categoryData.keywords });
                updated++;
            }
        }

        if (created || updated) {
            this.logger.log(`✅ Catégories : ${created} créée(s), ${updated} mot(s)-clé(s) mis à jour`);
        } else {
            this.logger.log('Categories already seeded');
        }
    }

    /** Exposé pour les tests. */
    get seedData(): ReadonlyArray<CategorySeed> {
        return this.categories;
    }
}
