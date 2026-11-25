/** Code postal français : départements 01-95, 97 (DROM) et 98 (COM). */
export const FRENCH_POSTAL_CODE = /^(?:0[1-9]|[1-8][0-9]|9[0-5]|97|98)[0-9]{3}$/;

/** Longueur minimale des nouveaux mots de passe. */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignore tout ce qui dépasse 72 octets. */
export const PASSWORD_MAX_LENGTH = 72;
