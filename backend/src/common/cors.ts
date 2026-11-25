type OriginCallback = (err: Error | null, allow?: boolean) => void;

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Liste blanche des origines autorisées.
 * - CORS_ORIGINS (liste séparée par des virgules) : mode strict, seules ces origines passent.
 * - Sinon (développement) : FRONTEND_URL + localhost / 127.0.0.1 sur tout port.
 */
export function parseAllowedOrigins(env: NodeJS.ProcessEnv): { origins: Set<string>; allowLocalhost: boolean } {
    const normalize = (o: string) => o.trim().replace(/\/+$/, '');
    if (env.CORS_ORIGINS && env.CORS_ORIGINS.trim()) {
        return {
            origins: new Set(env.CORS_ORIGINS.split(',').map(normalize).filter(Boolean)),
            allowLocalhost: false,
        };
    }
    const origins = new Set<string>();
    if (env.FRONTEND_URL) origins.add(normalize(env.FRONTEND_URL));
    return { origins, allowLocalhost: true };
}

/** Fonction `origin` pour app.enableCors(). */
export function buildCorsOrigin(env: NodeJS.ProcessEnv = process.env) {
    const { origins, allowLocalhost } = parseAllowedOrigins(env);
    return (origin: string | undefined, callback: OriginCallback) => {
        // Requêtes sans Origin (curl, health checks, apps natives) : pas de contrainte CORS
        if (!origin) return callback(null, true);
        if (origins.has(origin) || (allowLocalhost && LOCALHOST.test(origin))) {
            return callback(null, true);
        }
        // Pas d'en-têtes CORS : le navigateur bloque la réponse
        return callback(null, false);
    };
}
