import { normalizeText, countMatches } from './keyword-matcher';

/** Axe « territoire » d'une loi (indépendant du thème). */
export enum Territory {
    NATIONAL = 'NATIONAL',
    METROPOLE = 'METROPOLE',
    OUTRE_MER = 'OUTRE_MER',
    GUADELOUPE = 'GUADELOUPE',
    MARTINIQUE = 'MARTINIQUE',
    GUYANE = 'GUYANE',
    REUNION = 'REUNION',
    MAYOTTE = 'MAYOTTE',
    NOUVELLE_CALEDONIE = 'NOUVELLE_CALEDONIE',
    POLYNESIE = 'POLYNESIE',
    SPM = 'SPM',
    WALLIS_FUTUNA = 'WALLIS_FUTUNA',
    SAINT_MARTIN = 'SAINT_MARTIN',
    SAINT_BARTHELEMY = 'SAINT_BARTHELEMY',
    CORSE = 'CORSE',
    UE = 'UE',
    INTERNATIONAL = 'INTERNATIONAL',
}

/** Territoires ultramarins : en sélectionner un implique OUTRE_MER. */
export const OUTRE_MER_TERRITORIES: Territory[] = [
    Territory.GUADELOUPE, Territory.MARTINIQUE, Territory.GUYANE, Territory.REUNION, Territory.MAYOTTE,
    Territory.NOUVELLE_CALEDONIE, Territory.POLYNESIE, Territory.SPM, Territory.WALLIS_FUTUNA,
    Territory.SAINT_MARTIN, Territory.SAINT_BARTHELEMY,
];

const TERRITORY_VALUES = new Set<string>(Object.values(Territory));

/** Expressions (normalisées à l'usage) signalant un territoire dans un titre ou un résumé. */
const TERRITORY_KEYWORDS: Array<[Territory, string[]]> = [
    [Territory.GUADELOUPE, ['guadeloupe', 'guadeloupeen', 'guadeloupeens']],
    [Territory.MARTINIQUE, ['martinique', 'martiniquais']],
    [Territory.GUYANE, ['guyane', 'guyanais']],
    [Territory.REUNION, ['la reunion', 'ile de la reunion', 'reunionnais']],
    [Territory.MAYOTTE, ['mayotte', 'mahorais']],
    [Territory.NOUVELLE_CALEDONIE, ['nouvelle caledonie', 'caledonien', 'caledoniens', 'kanak']],
    [Territory.POLYNESIE, ['polynesie', 'polynesie francaise']],
    [Territory.SPM, ['saint pierre et miquelon']],
    [Territory.WALLIS_FUTUNA, ['wallis et futuna', 'wallis']],
    [Territory.SAINT_MARTIN, ['saint martin']],
    [Territory.SAINT_BARTHELEMY, ['saint barthelemy']],
    [Territory.OUTRE_MER, ['outre mer', 'ultramarin', 'ultramarins', 'ultramarine', 'ultramarines', 'drom', 'dom tom']],
    [Territory.CORSE, ['corse', 'collectivite de corse']],
    [Territory.UE, ['union europeenne', 'directive europeenne', 'reglement europeen', 'droit de l union europeenne']],
    [Territory.INTERNATIONAL, ['ratification', 'traite', 'accord international', 'convention internationale']],
];

/** Ajoute OUTRE_MER si un territoire ultramarin est présent ; NATIONAL par défaut ; dédoublonne. */
export function normalizeTerritories(values: unknown[]): Territory[] {
    const set = new Set<Territory>();
    for (const v of values || []) {
        const code = String(v || '').trim().toUpperCase();
        if (TERRITORY_VALUES.has(code)) set.add(code as Territory);
    }
    if (OUTRE_MER_TERRITORIES.some((t) => set.has(t))) set.add(Territory.OUTRE_MER);
    if (set.size > 1) set.delete(Territory.NATIONAL);
    if (!set.size) set.add(Territory.NATIONAL);
    return [...set];
}

/** Détection par mots-clés (repli quand l'IA n'a pas classé la loi). */
export function detectTerritories(text: string): Territory[] {
    const normalized = normalizeText(text);
    const found: Territory[] = [];
    for (const [territory, keywords] of TERRITORY_KEYWORDS) {
        if (keywords.some((k) => countMatches(normalized, normalizeText(k).trim()) > 0)) found.push(territory);
    }
    return normalizeTerritories(found);
}

/** Codes d'un filtre de flux : OUTRE_MER couvre aussi chaque territoire ultramarin. */
export function expandTerritoryFilter(territory: string): string[] {
    const code = String(territory || '').toUpperCase();
    if (code === Territory.OUTRE_MER) return [Territory.OUTRE_MER, ...OUTRE_MER_TERRITORIES];
    return TERRITORY_VALUES.has(code) ? [code] : [];
}

export interface ParsedClassification {
    themes: string[];
    territories: Territory[];
    confidence: number;
}

/**
 * Valide la classification renvoyée par l'IA contre la taxonomie fermée.
 * Thème principal en tête, 2 secondaires maximum, slugs inconnus ignorés.
 * Retourne null si aucun thème valide n'a été proposé.
 */
export function parseClassification(raw: any, validThemeSlugs: string[]): ParsedClassification | null {
    if (!raw || typeof raw !== 'object') return null;
    const valid = new Set(validThemeSlugs);
    const themes: string[] = [];
    const push = (slug: unknown) => {
        const s = String(slug || '').trim().toLowerCase();
        if (valid.has(s) && !themes.includes(s)) themes.push(s);
    };
    push(raw.theme_principal);
    for (const s of Array.isArray(raw.themes_secondaires) ? raw.themes_secondaires : []) push(s);
    if (!themes.length) return null;

    const confidence = Number(raw.confiance);
    return {
        themes: themes.slice(0, 3),
        territories: normalizeTerritories(Array.isArray(raw.territoires) ? raw.territoires : []),
        confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0,
    };
}

/** Consigne ajoutée au prompt de synthèse pour classer la loi dans le même appel. */
export function buildClassificationInstructions(themes: ReadonlyArray<{ slug: string; name: string }>): string {
    return `
Ajoute aussi à l'objet JSON une clé "classification" :
"classification": {
    "theme_principal": "un slug parmi : ${themes.map((t) => t.slug).join(', ')}",
    "themes_secondaires": ["0 à 2 autres slugs de la même liste, seulement s'ils sont vraiment concernés"],
    "territoires": ["1 ou plusieurs codes parmi : ${Object.values(Territory).join(', ')} (NATIONAL si la loi s'applique à toute la France)"],
    "confiance": 0.0
}
Correspondance des thèmes : ${themes.map((t) => `${t.slug} = ${t.name}`).join(' ; ')}.
N'invente aucun slug ni code hors de ces listes.`;
}
