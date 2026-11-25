import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CandidatePositionDto } from './candidate-position.dto';
import { CandidateDto } from '../../admin/dto/candidate.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (metatype: any, value: unknown) => pipe.transform(value, { type: 'body', metatype } as ArgumentMetadata);
const UUID = '3f2b8c1e-9a4d-4c3b-8e2f-1a2b3c4d5e6f';

const valid = {
    candidateId: UUID,
    lawId: UUID,
    position: 'CONTRE',
    sourceType: 'DECLARATION',
    sourceUrl: 'https://media.example.fr/entretien',
    quote: 'Citation',
    sourceDate: '2026-10-02',
    verifiedBy: 'JJM',
};

describe('CandidatePositionDto', () => {
    it('accepts a sourced position', async () => {
        await expect(validate(CandidatePositionDto, valid)).resolves.toBeTruthy();
    });

    it.each([
        ['no source', { sourceUrl: undefined }],
        ['non-https source', { sourceUrl: 'http://media.example.fr' }],
        ['AI or vote as manual source type', { sourceType: 'VOTE_GROUPE' }],
        ['unknown position', { position: 'PEUT_ETRE' }],
        ['quote over 300 chars', { quote: 'x'.repeat(301) }],
        ['missing verifier', { verifiedBy: '' }],
        ['invalid date', { sourceDate: 'hier' }],
    ])('rejects %s', async (_label, override) => {
        await expect(validate(CandidatePositionDto, { ...valid, ...override })).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('CandidateDto — links to votes', () => {
    it('accepts a deputy id and an AN group code, or empty values', async () => {
        await expect(validate(CandidateDto, { deputyId: UUID, groupOrganeRef: 'PO845401' })).resolves.toBeTruthy();
        await expect(validate(CandidateDto, { deputyId: '', groupOrganeRef: null })).resolves.toBeTruthy();
    });

    it('rejects malformed values', async () => {
        await expect(validate(CandidateDto, { groupOrganeRef: 'RN' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(CandidateDto, { deputyId: 'PA1234' })).rejects.toBeInstanceOf(BadRequestException);
    });
});
