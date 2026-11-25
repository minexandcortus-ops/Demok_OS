import { condenseLegalText, LAW_TEXT_BUDGET, parseJsonResponse } from './ai-text';

describe('condenseLegalText', () => {
    it('returns short texts untouched (whitespace normalised)', () => {
        expect(condenseLegalText('Article 1er\n\n\n\nLe   code est modifié.')).toBe('Article 1er\n\nLe code est modifié.');
        expect(condenseLegalText(null)).toBe('');
    });

    it('keeps the beginning and the first sentence of every following article within budget', () => {
        const preamble = 'Exposé des motifs. '.repeat(500); // ~9 500 caractères
        const articles = Array.from({ length: 40 }, (_, i) => `Article ${i + 2}\nLe dispositif ${i + 2} prévoit une mesure. Détails longs ${'x'.repeat(400)}.`).join('\n');
        const condensed = condenseLegalText(`${preamble}\n${articles}`, LAW_TEXT_BUDGET);

        expect(condensed.length).toBeLessThanOrEqual(LAW_TEXT_BUDGET);
        expect(condensed.startsWith('Exposé des motifs.')).toBe(true);
        expect(condensed).toContain('Articles suivants');
        expect(condensed).toMatch(/- Article \d+ : Le dispositif \d+ prévoit une mesure\./);
        expect(condensed).not.toContain('x'.repeat(400));
    });

    it('falls back to a hard cut when no article heading is found', () => {
        const condensed = condenseLegalText('a'.repeat(30_000), 1_000);
        expect(condensed).toHaveLength(1_000);
    });
});

describe('parseJsonResponse', () => {
    it('parses plain, fenced and wrapped JSON', () => {
        expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 });
        expect(parseJsonResponse('```json\n{"a":2}\n```')).toEqual({ a: 2 });
        expect(parseJsonResponse('Voici la réponse : {"a":3} Bonne lecture')).toEqual({ a: 3 });
    });

    it('throws without a JSON object', () => {
        expect(() => parseJsonResponse('pas de json')).toThrow();
    });
});
