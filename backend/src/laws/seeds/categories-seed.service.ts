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
            keywords: 'budget,état,fiscalité,impôts,taxes,dette,publique,finances,publiques,loi,finances,TVA,contributions,prélèvements,budget,trésorerie,comptabilité,dépenses,recettes',
        },
        {
            name: 'Social & Santé',
            slug: 'social_sante',
            color: '#FF6B6B',
            icon: '🏥',
            keywords: 'sécurité,sociale,santé,publique,hôpitaux,assurance,maladie,retraites,pensions,handicap,dépendance,famille,enfance,allocations,CAF,CPAM,protection,sociale,solidarité',
        },
        {
            name: 'Travail',
            slug: 'travail',
            color: '#4ECDC4',
            icon: '💼',
            keywords: 'code,travail,emploi,chômage,formation,professionnelle,dialogue,social,syndicats,salaires,contrats,travail,fonction,publique,congés,retraite,licenciement,CDI,CDD',
        },
        {
            name: 'Éducation',
            slug: 'education',
            color: '#95E1D3',
            icon: '📚',
            keywords: 'enseignement,scolaire,université,enseignement,supérieur,recherche,scientifique,innovation,étudiants,professeurs,écoles,formation,éducation,nationale,baccalauréat,diplôme,campus',
        },
        {
            name: 'Justice',
            slug: 'justice',
            color: '#8B4513',
            icon: '⚖️',
            keywords: 'droit,pénal,droit,civil,tribunaux,juges,procédure,judiciaire,libertés,publiques,droits,homme,protection,données,RGPD,justice,avocat,procès,condamnation,peine',
        },
        {
            name: 'Sécurité',
            slug: 'securite',
            color: '#1A535C',
            icon: '🚨',
            keywords: 'police,gendarmerie,défense,nationale,armée,terrorisme,cybersécurité,renseignement,sécurité,intérieure,forces,ordre,surveillance,criminalité,lutte,terrorisme',
        },
        {
            name: 'Écologie',
            slug: 'ecologie',
            color: '#2ECC71',
            icon: '🌱',
            keywords: 'climat,biodiversité,énergie,transition,écologique,énergies,renouvelables,pollution,déchets,eau,air,protection,animale,environnement,carbone,vert,développement,durable',
        },
        {
            name: 'Aménagement',
            slug: 'amenagement',
            color: '#9B59B6',
            icon: '🏗️',
            keywords: 'urbanisme,logement,construction,transports,mobilité,infrastructures,routes,ferroviaire,territoires,ruralité,montagne,littoral,aménagement,territoire,ville,métropole',
        },
        {
            name: 'Agriculture',
            slug: 'agriculture',
            color: '#F39C12',
            icon: '🌾',
            keywords: 'agriculture,élevage,pêche,aquaculture,alimentation,filières,agricoles,PAC,forêt,viticulture,agriculteur,exploitation,agricole,rurale,terre,culture,céréales',
        },
        {
            name: 'Culture',
            slug: 'culture',
            color: '#E91E63',
            icon: '🎭',
            keywords: 'patrimoine,culturel,arts,création,artistique,médias,audiovisuel,presse,cinéma,musées,sport,spectacles,théâtre,musique,livre,lecture,artiste,culture',
        },
        {
            name: 'International',
            slug: 'international',
            color: '#3498DB',
            icon: '🌍',
            keywords: 'relations,internationales,affaires,européennes,Union,européenne,diplomatie,coopération,internationale,développement,francophonie,traités,UE,Europe,monde,étranger',
        },
        {
            name: 'Institutions',
            slug: 'institutions',
            color: '#34495E',
            icon: '🏛️',
            keywords: 'constitution,organisation,pouvoirs,publics,collectivités,territoriales,décentralisation,élections,vie,démocratique,sénat,assemblée,nationale,député,gouvernement,république',
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
        const existingCount = await this.categoryRepository.count();

        if (existingCount > 0) {
            this.logger.log('Categories already seeded');
            return;
        }

        this.logger.log('Seeding categories...');

        for (const categoryData of this.categories) {
            const category = this.categoryRepository.create(categoryData);
            await this.categoryRepository.save(category);
        }

        this.logger.log(`✅ Seeded ${this.categories.length} categories`);
    }
}
