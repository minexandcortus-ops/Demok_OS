import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { RefreshToken } from './refresh-token.entity';
import { User } from '../users/user.entity';

export const REFRESH_TOKEN_TTL_DAYS = 60;

export const hashRefreshToken = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

@Injectable()
export class RefreshTokenService {
    private readonly logger = new Logger(RefreshTokenService.name);

    constructor(@InjectRepository(RefreshToken) private readonly repository: Repository<RefreshToken>) { }

    private ttlMs(): number {
        const days = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '', 10);
        return (Number.isFinite(days) && days > 0 ? days : REFRESH_TOKEN_TTL_DAYS) * 86_400_000;
    }

    /** Émet un nouveau jeton (valeur brute renvoyée une seule fois au client). */
    async issue(user: User): Promise<{ token: string; entity: RefreshToken }> {
        const token = randomBytes(48).toString('base64url');
        const entity = await this.repository.save(
            this.repository.create({ user, tokenHash: hashRefreshToken(token), expiresAt: new Date(Date.now() + this.ttlMs()) }),
        );
        return { token, entity };
    }

    /**
     * Échange un jeton valide contre un nouveau (rotation).
     * Un jeton expiré, inconnu ou révoqué est refusé ; un jeton déjà tourné qui revient
     * signale un vol probable : tous les jetons de l'utilisateur sont révoqués.
     */
    async rotate(raw: string): Promise<{ user: User; token: string }> {
        const current = await this.repository.findOne({
            where: { tokenHash: hashRefreshToken(raw || '') },
            relations: ['user'],
        });
        if (!current || !current.user) throw new UnauthorizedException('Session expirée');

        if (current.revokedAt) {
            if (current.replacedById) {
                this.logger.warn(`🚨 Réutilisation d'un jeton de rafraîchissement (user ${current.user.id}) : révocation de la session`);
                await this.revokeAllForUser(current.user.id);
            }
            throw new UnauthorizedException('Session expirée');
        }
        if (current.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Session expirée');

        const next = await this.issue(current.user);
        current.revokedAt = new Date();
        current.replacedById = next.entity.id;
        await this.repository.save(current);
        return { user: current.user, token: next.token };
    }

    /** Déconnexion : révoque le jeton présenté (sans erreur s'il est inconnu). */
    async revoke(raw: string): Promise<void> {
        await this.repository.update({ tokenHash: hashRefreshToken(raw || ''), revokedAt: IsNull() }, { revokedAt: new Date() });
    }

    /** Révoque toutes les sessions d'un utilisateur (mot de passe réinitialisé, vol détecté). */
    async revokeAllForUser(userId: string): Promise<void> {
        await this.repository.update({ user: { id: userId }, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
}
