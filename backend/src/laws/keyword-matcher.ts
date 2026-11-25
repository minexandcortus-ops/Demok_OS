/**
 * Moteur de catégorisation par mots-clés (repli quand l'IA n'a pas classé la loi).
 * - normalisation : minuscules, sans accents, ponctuation → espaces ;
 * - correspondance sur mots entiers / expressions entières (« eau » ne matche pas « nouveau ») ;
 * - mots trop génériques ignorés (« loi », « état », « publique »…) ;
 * - le titre pèse plus lourd que le résumé.
 */

export const STOP_WORDS = new Set([
    'loi', 'lois', 'etat', 'public', 'publique', 'publics', 'publiques', 'national', 'nationale',
    'code', 'droit', 'droits', 'protection', 'securite', 'projet', 'proposition', 'texte', 'vie',
    'organisation', 'forces', 'lutte', 'developpement', 'territoire', 'territoires', 'contrats',
]);

export const TITLE_WEIGHT = 3;
export const BODY_WEIGHT = 1;
export const MAX_CATEGORIES = 3;
/** Une catégorie secondaire doit atteindre ce ratio du meilleur score. */
export const SECONDARY_RATIO = 0.5;

export function normalizeText(text: string): string {
    return ` ${(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[’']/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()} `;
}

/** Découpe la liste CSV de mots-clés, normalise, retire les mots vides isolés et les doublons. */
export function parseKeywords(csv: string): string[] {
    const seen = new Set<string>();
    for (const raw of (csv || '').split(',')) {
        const keyword = normalizeText(raw).trim();
        if (!keyword || STOP_WORDS.has(keyword)) continue;
        seen.add(keyword);
    }
    return [...seen];
}

/** Nombre d'occurrences de l'expression entière dans un texte déjà normalisé. */
export function countMatches(normalizedText: string, keyword: string): number {
    const needle = ` ${keyword} `;
    let count = 0;
    let index = normalizedText.indexOf(needle);
    while (index !== -1) {
        count++;
        index = normalizedText.indexOf(needle, index + needle.length - 1);
    }
    return count;
}

export interface KeywordCategory {
    slug: string;
    keywords: string;
}

export interface CategoryScore<T extends KeywordCategory> {
    category: T;
    score: number;
}

/** Score de chaque catégorie : chaque mot-clé distinct compte une fois, pondéré par sa zone. */
export function scoreCategories<T extends KeywordCategory>(
    title: string,
    body: string,
    categories: T[],
): CategoryScore<T>[] {
    const normalizedTitle = normalizeText(title);
    const normalizedBody = normalizeText(body);
    const scores: CategoryScore<T>[] = [];

    for (const category of categories) {
        let score = 0;
        for (const keyword of parseKeywords(category.keywords)) {
            if (countMatches(normalizedTitle, keyword) > 0) score += TITLE_WEIGHT;
            else if (countMatches(normalizedBody, keyword) > 0) score += BODY_WEIGHT;
        }
        if (score > 0) scores.push({ category, score });
    }

    return scores.sort((a, b) => b.score - a.score || a.category.slug.localeCompare(b.category.slug));
}

/** Sélectionne la catégorie principale et au plus deux secondaires suffisamment proches. */
export function selectCategories<T extends KeywordCategory>(scores: CategoryScore<T>[]): T[] {
    if (!scores.length) return [];
    const best = scores[0].score;
    return scores
        .filter((s, i) => i === 0 || s.score >= best * SECONDARY_RATIO)
        .slice(0, MAX_CATEGORIES)
        .map((s) => s.category);
}
