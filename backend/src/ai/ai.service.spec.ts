import { AiNotConfiguredError, AiService } from './ai.service';

const config = (values: Record<string, string | undefined>) => ({ get: (key: string) => values[key] }) as any;
const ok = (content: string) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
const fail = (status: number) => ({ ok: false, status, statusText: 'err', json: async () => ({}) });

describe('AiService', () => {
    const originalFetch = global.fetch;
    let service: AiService;
    let sleeps: number[];

    beforeEach(() => {
        service = new AiService(config({ MISTRAL_API_KEY: 'key', MISTRAL_MODEL: 'mistral-test' }));
        sleeps = [];
        service.sleep = async (ms) => {
            sleeps.push(ms);
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('sends system and user messages, JSON mode, max tokens and temperature', async () => {
        global.fetch = jest.fn().mockResolvedValue(ok('{"x":1}')) as any;

        await expect(service.chatJson({ system: 'S', user: 'U', maxTokens: 100 })).resolves.toEqual({ x: 1 });

        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(init.body);
        expect(url).toBe(AiService.ENDPOINT);
        expect(init.headers.Authorization).toBe('Bearer key');
        expect(body).toMatchObject({
            model: 'mistral-test',
            messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }],
            response_format: { type: 'json_object' },
            max_tokens: 100,
        });

        await service.chat({ user: 'U', temperature: 0.2 });
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({ temperature: 0.2 });
    });

    it('retries transient errors (429, 503, network) with exponential backoff', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce(fail(429))
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(ok('réponse')) as any;

        await expect(service.chat({ user: 'U' })).resolves.toBe('réponse');
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(sleeps).toEqual([500, 1000]);
    });

    it('gives up after the maximum number of attempts', async () => {
        global.fetch = jest.fn().mockResolvedValue(fail(503)) as any;
        await expect(service.chat({ user: 'U' })).rejects.toThrow('503');
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry client errors such as 401', async () => {
        global.fetch = jest.fn().mockResolvedValue(fail(401)) as any;
        await expect(service.chat({ user: 'U' })).rejects.toThrow('401');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('rejects incomplete answers and reports a missing key', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }) as any;
        await expect(service.chat({ user: 'U' })).rejects.toThrow('incomplète');

        const unconfigured = new AiService(config({}));
        expect(unconfigured.isConfigured()).toBe(false);
        await expect(unconfigured.chat({ user: 'U' })).rejects.toBeInstanceOf(AiNotConfiguredError);
        expect(unconfigured.model).toBe('mistral-small-latest');
    });

    it('aborts a request that exceeds the timeout', async () => {
        const slow = new AiService(config({ MISTRAL_API_KEY: 'key', AI_TIMEOUT_MS: '20', AI_MAX_ATTEMPTS: '1' }));
        global.fetch = jest.fn(
            (_url, init: any) =>
                new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
        ) as any;
        await expect(slow.chat({ user: 'U' })).rejects.toThrow('délai');
    });
});
