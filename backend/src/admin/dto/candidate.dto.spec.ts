import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CandidateDto, prepareCandidateUpdate } from './candidate.dto';
import { CandidateStatus, ProgramStatus } from '../../surveys/candidate.entity';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: CandidateDto } as ArgumentMetadata);

describe('CandidateDto validation', () => {
    it('accepts https links, uploaded files and empty values', async () => {
        await expect(
            validate({
                officialSiteUrl: 'https://campagne.example.fr',
                officialProgramUrl: '/api/uploads/candidates/file-1.pdf',
                programPublishedAt: '2027-02-14',
                status: 'OFFICIEL',
                programStatus: 'PUBLIE',
            }),
        ).resolves.toBeTruthy();
        await expect(validate({ officialSiteUrl: '', officialProgramUrl: null })).resolves.toBeTruthy();
    });

    it.each([
        ['http (non chiffré)', { officialSiteUrl: 'http://campagne.example.fr' }],
        ['javascript:', { officialProgramUrl: 'javascript:alert(1)' }],
        ['relative path outside uploads', { officialProgramUrl: '/etc/passwd' }],
        ['unknown status', { status: 'ELU' }],
        ['unknown program status', { programStatus: 'BIENTOT' }],
        ['invalid date', { programPublishedAt: '14/02/2027' }],
    ])('rejects %s', async (_label, body) => {
        await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('strips unknown fields (e.g. an attempt to rewrite the id)', async () => {
        const result = await validate({ name: 'A', id: 'other-id', displayOrder: 99 });
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('displayOrder');
    });
});

describe('prepareCandidateUpdate', () => {
    const now = new Date('2026-11-25T10:00:00Z');

    it('stamps linksCheckedAt when an official field is edited', () => {
        expect(prepareCandidateUpdate({ officialSiteUrl: 'https://x.fr' }, now).linksCheckedAt).toBe(now);
        expect(prepareCandidateUpdate({ programStatus: ProgramStatus.PARTIEL }, now).linksCheckedAt).toBe(now);
    });

    it('leaves linksCheckedAt alone for unrelated edits', () => {
        expect(prepareCandidateUpdate({ description: 'Bio' }, now)).not.toHaveProperty('linksCheckedAt');
        expect(prepareCandidateUpdate({ status: CandidateStatus.RETIRE }, now)).not.toHaveProperty('linksCheckedAt');
    });

    it('turns empty strings into null so links can be removed', () => {
        const data = prepareCandidateUpdate({ officialSiteUrl: '', officialProgramUrl: '', programPublishedAt: '' }, now);
        expect(data).toMatchObject({ officialSiteUrl: null, officialProgramUrl: null, programPublishedAt: null });
    });

    it('marks the program as published when an official link is given without status', () => {
        expect(prepareCandidateUpdate({ officialProgramUrl: 'https://x.fr/programme.pdf' }, now).programStatus).toBe(
            ProgramStatus.PUBLIE,
        );
        expect(
            prepareCandidateUpdate({ officialProgramUrl: 'https://x.fr/p', programStatus: ProgramStatus.PARTIEL }, now)
                .programStatus,
        ).toBe(ProgramStatus.PARTIEL);
    });
});
