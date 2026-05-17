import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any) {
        // Personnalisation des erreurs si besoin
        if (err || !user) {
            throw err || new UnauthorizedException('Session expirée ou invalide. Veuillez vous reconnecter.');
        }
        return user;
    }
}
