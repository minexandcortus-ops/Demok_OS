import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/** Aplatit les erreurs class-validator (y compris imbriquées) en liste de messages. */
export function flattenValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];
    const walk = (list: ValidationError[]) => {
        for (const error of list) {
            if (error.constraints) messages.push(...Object.values(error.constraints));
            if (error.children?.length) walk(error.children);
        }
    };
    walk(errors);
    return messages;
}

/**
 * ValidationPipe global de l'API.
 * - whitelist : les propriétés non déclarées dans le DTO sont supprimées.
 * - transform : le body est converti en instance du DTO.
 * - message : chaîne unique (le client Flutter lit `message` comme un String).
 */
export function createValidationPipe(): ValidationPipe {
    return new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
            const messages = flattenValidationErrors(errors);
            return new BadRequestException(messages.length ? messages.join(' · ') : 'Requête invalide');
        },
    });
}
