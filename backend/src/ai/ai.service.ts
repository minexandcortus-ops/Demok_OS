import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseJsonResponse } from './ai-text';

export interface ChatRequest {
    system?: string;
    user: string;
    /** Demande une réponse JSON (response_format json_object) */
    json?: boolean;
    maxTokens?: number;
    temperature?: number;
}

export class AiNotConfiguredError extends Error {
    constructor() {
        super('MISTRAL_API_KEY non configurée');
    }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Point d'accès unique à l'API Mistral : timeout, nouvelles tentatives avec attente exponentielle
 * sur les erreurs transitoires (429, 5xx, réseau), journalisation de la consommation de tokens.
 */
@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    static readonly ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';

    /** Remplaçable dans les tests pour ne pas attendre réellement. */
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    constructor(private readonly config: ConfigService) { }

    get model(): string {
        return this.config.get<string>('MISTRAL_MODEL') || 'mistral-small-latest';
    }

    isConfigured(): boolean {
        return !!this.config.get<string>('MISTRAL_API_KEY');
    }

    private get maxAttempts(): number {
        return parseInt(this.config.get<string>('AI_MAX_ATTEMPTS') || '3', 10) || 3;
    }

    private get timeoutMs(): number {
        return parseInt(this.config.get<string>('AI_TIMEOUT_MS') || '45000', 10) || 45_000;
    }

    /** Renvoie le contenu textuel de la réponse du modèle. */
    async chat(request: ChatRequest): Promise<string> {
        const apiKey = this.config.get<string>('MISTRAL_API_KEY');
        if (!apiKey) throw new AiNotConfiguredError();

        const body = JSON.stringify({
            model: this.model,
            messages: [
                ...(request.system ? [{ role: 'system', content: request.system }] : []),
                { role: 'user', content: request.user },
            ],
            ...(request.json ? { response_format: { type: 'json_object' } } : {}),
            ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        });

        let lastError: Error = new Error('Appel IA impossible');
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const response = await fetch(AiService.ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
                    body,
                    signal: controller.signal,
                });
                if (!response.ok) {
                    lastError = new Error(`Mistral API error: ${response.status} ${response.statusText}`);
                    if (!RETRYABLE.has(response.status)) throw lastError;
                } else {
                    const data = await response.json();
                    const content = data?.choices?.[0]?.message?.content;
                    if (typeof content !== 'string') throw new Error('Réponse Mistral incomplète');
                    if (data.usage) {
                        this.logger.debug(`🤖 ${this.model} : ${data.usage.prompt_tokens} + ${data.usage.completion_tokens} tokens`);
                    }
                    return content;
                }
            } catch (error) {
                lastError = error.name === 'AbortError' ? new Error(`Mistral : délai de ${this.timeoutMs} ms dépassé`) : error;
                const status = /error: (\d{3})/.exec(lastError.message)?.[1];
                if (status && !RETRYABLE.has(Number(status))) throw lastError;
            } finally {
                clearTimeout(timer);
            }
            if (attempt < this.maxAttempts) {
                const delay = 500 * 2 ** (attempt - 1);
                this.logger.warn(`⏳ Mistral : tentative ${attempt} échouée (${lastError.message}), nouvel essai dans ${delay} ms`);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }

    /** Variante JSON : réponse parsée (balises ```json et texte parasite tolérés). */
    async chatJson<T = any>(request: Omit<ChatRequest, 'json'>): Promise<T> {
        return parseJsonResponse<T>(await this.chat({ ...request, json: true }));
    }
}
