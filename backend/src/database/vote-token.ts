import { createHmac } from 'crypto';

/** Jeton d'urne d'un sondage : HMAC_SHA256(VOTE_SECRET, "citizenId:surveyId") — identique à SurveysService. */
export function surveyVoterToken(secret: string, citizenId: string, surveyId: string): string {
    return createHmac('sha256', secret).update(`${citizenId}:${surveyId}`).digest('hex');
}
