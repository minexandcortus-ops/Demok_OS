import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

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
        if (!providedKey || providedKey !== adminKey) {
            throw new UnauthorizedException('Clé admin invalide ou manquante.');
        }

        return true;
    }
}
