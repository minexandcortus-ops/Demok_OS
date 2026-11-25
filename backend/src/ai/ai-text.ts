/** Budget de texte de loi envoyé au modèle (≈ 3 000 tokens), au lieu des 4 000 premiers caractères. */
export const LAW_TEXT_BUDGET = 12_000;

/**
 * Condense un texte de loi trop long sans le couper aveuglément :
 * garde le début (exposé des motifs, premiers articles), puis la première phrase
 * de chaque article suivant, dans la limite du budget.
 */
export function condenseLegalText(raw: string | null | undefined, budget = LAW_TEXT_BUDGET): string {
    const text = (raw || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length <= budget) return text;

    const headBudget = Math.floor(budget * 0.6);
    const head = text.slice(0, headBudget);
    const rest = text.slice(headBudget);

    const marker = '\n\n[…] Articles suivants (début de chaque article) :\n';
    const lines: string[] = [];
    let used = head.length + marker.length;
    const articleRe = /(?:^|\n)\s*(Article\s+(?:\d+|premier|[IVXLC]+)[^\n]*)\n?([^\n]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = articleRe.exec(rest)) !== null) {
        const firstSentence = (match[2] || '').split(/(?<=[.;:])\s/)[0];
        const line = `- ${match[1].trim()} : ${firstSentence.trim()}`.slice(0, 300);
        if (used + line.length + 1 > budget) break;
        lines.push(line);
        used += line.length + 1;
    }
    return lines.length ? head + marker + lines.join('\n') : text.slice(0, budget);
}

/**
 * Extrait l'objet JSON d'une réponse de modèle (tolère les balises ```json et le texte autour).
 * Lève une erreur si aucun objet valide n'est trouvé.
 */
export function parseJsonResponse<T = any>(content: string): T {
    const trimmed = (content || '').trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
        if (!candidate) throw new Error('Réponse IA sans objet JSON');
        return JSON.parse(candidate);
    }
}
