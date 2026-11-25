import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

export const PUBLIC_CACHE_KEY = 'http:public-cache-seconds';

/**
 * Autorise la mise en cache partagée (navigateur/CDN) d'une lecture publique,
 * uniquement pour les requêtes anonymes (sans en-tête Authorization).
 */
export const PublicCache = (maxAgeSeconds: number) => SetMetadata(PUBLIC_CACHE_KEY, maxAgeSeconds);

export const PRIVATE_NO_CACHE = 'private, no-cache';

export function cacheControlFor(maxAge: number | undefined, isAuthenticated: boolean): string {
    if (!maxAge || isAuthenticated) return PRIVATE_NO_CACHE;
    return `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 5}`;
}

/**
 * Pose Cache-Control sur les réponses GET réussies :
 * - `@PublicCache(n)` + requête anonyme → cache public de n secondes ;
 * - sinon → `private, no-cache` (revalidation systématique via ETag, réponse 304 si inchangée).
 * Ne touche pas aux réponses qui ont déjà leur propre Cache-Control (ex. photos des députés).
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') return next.handle();
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        if (req.method !== 'GET') return next.handle();

        const maxAge = this.reflector.getAllAndOverride<number>(PUBLIC_CACHE_KEY, [context.getHandler(), context.getClass()]);
        const value = cacheControlFor(maxAge, Boolean(req.headers?.authorization));

        return next.handle().pipe(
            tap(() => {
                if (res.headersSent || res.getHeader('Cache-Control')) return;
                res.setHeader('Cache-Control', value);
                res.vary?.('Authorization');
            }),
        );
    }
}
