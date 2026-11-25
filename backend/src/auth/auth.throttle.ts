/**
 * Limites de débit des routes d'authentification (par IP).
 * - défaut : 20 requêtes / minute (check-pseudo, register)
 * - login  : 10 requêtes / minute
 * - strict : 5 requêtes / minute (OTP, mot de passe oublié / réinitialisation)
 */
export const AUTH_THROTTLE_DEFAULT = { name: 'default', ttl: 60_000, limit: 20 };
export const AUTH_THROTTLE_STRICT = { ttl: 60_000, limit: 5 };
export const AUTH_THROTTLE_LOGIN = { ttl: 60_000, limit: 10 };

export const AUTH_THROTTLE_MESSAGE = 'Trop de tentatives. Réessaie dans une minute.';

/** Options du ThrottlerModule pour les routes d'authentification. */
export const AUTH_THROTTLER_OPTIONS = {
    throttlers: [AUTH_THROTTLE_DEFAULT],
    errorMessage: AUTH_THROTTLE_MESSAGE,
};
