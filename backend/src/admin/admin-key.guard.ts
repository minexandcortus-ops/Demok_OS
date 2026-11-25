import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Compare deux secrets en temps constant.
 * Les deux valeurs sont hachées au préalable pour obtenir des buffers de même longueur
 * (timingSafeEqual exige des longueurs identiques et ne doit pas révéler la longueur attendue).
 */
export function safeSecretEquals(provided: string, expected: string): boolean {
    const a = createHash('sha256').update(provided, 'utf8').digest();
    const b = createHash('sha256').update(expected, 'utf8').digest();
    return timingSafeEqual(a, b);
}

/**
 * Guard qui vérifie la présence d'une clé API admin dans le header X-Admin-Key.
 * Configure la variable d'environnement ADMIN_KEY sur le serveur.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const adminKey = process.env.ADMIN_KEY;

        if (!adminKey) {
            // Si ADMIN_KEY n'est pas configurée en environnement, on bloque par sécurité
            throw new UnauthorizedException('Administration non configurée.');
        }

        const providedKey = request.headers['x-admin-key'];
        if (typeof providedKey !== 'string' || !providedKey || !safeSecretEquals(providedKey, adminKey)) {
            throw new UnauthorizedException('Clé admin invalide ou manquante.');
        }

        return true;
    }
}
