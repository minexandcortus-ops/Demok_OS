import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Candidate, VISIBLE_CANDIDATE_STATUSES } from './candidate.entity';
import { CandidateLawPosition } from './candidate-law-position.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { GroupVote } from '../votes/group-vote.entity';
import { Law } from '../laws/law.entity';
import { CandidatePositionView, PositionEvidence, resolvePosition } from './candidate-positions';
import { CandidatePositionDto } from './dto/candidate-position.dto';

type Declared = CandidateLawPosition & { candidate: Candidate; law: Law };

const toDeclared = (p: CandidateLawPosition): PositionEvidence['declared'] => ({
    position: p.position,
    sourceType: p.sourceType,
    sourceUrl: p.sourceUrl,
    quote: p.quote,
    sourceDate: p.sourceDate,
    verifiedAt: p.verifiedAt,
});

@Injectable()
export class CandidatePositionsService {
    constructor(
        @InjectRepository(Candidate) private readonly candidateRepository: Repository<Candidate>,
        @InjectRepository(CandidateLawPosition) private readonly positionRepository: Repository<CandidateLawPosition>,
        @InjectRepository(OfficialVote) private readonly officialVoteRepository: Repository<OfficialVote>,
        @InjectRepository(GroupVote) private readonly groupVoteRepository: Repository<GroupVote>,
        @InjectRepository(Law) private readonly lawRepository: Repository<Law>,
    ) { }

    /** Position de chaque candidat visible sur une loi. */
    async getForLaw(lawId: string): Promise<Array<{ candidateId: string; name: string; party: string; photoUrl: string } & CandidatePositionView>> {
        const candidates = await this.candidateRepository.find({ where: { status: In(VISIBLE_CANDIDATE_STATUSES) } });
        if (!candidates.length) return [];

        const declared = (await this.positionRepository.find({
            where: { law: { id: lawId } },
            relations: ['candidate'],
        })) as Declared[];
        const deputyIds = candidates.map((c) => c.deputyId).filter(Boolean);
        const personalVotes = deputyIds.length
            ? await this.officialVoteRepository.find({
                where: { law: { id: lawId }, deputy: { id: In(deputyIds) } },
                relations: ['deputy'],
            })
            : [];
        const groupVotes = await this.groupVoteRepository.find({ where: { law: { id: lawId } } });

        return candidates
            .map((c) => {
                const vote = personalVotes.find((v) => v.deputy?.id === c.deputyId);
                const decl = declared.find((p) => p.candidate?.id === c.id);
                const group = groupVotes.find((g) => c.groupOrganeRef && g.organeRef === c.groupOrganeRef);
                return {
                    candidateId: c.id,
                    name: c.name,
                    party: c.party,
                    photoUrl: c.photoUrl,
                    ...resolvePosition({
                        personalVote: vote ? { choice: vote.choice, scrutinId: vote.scrutinId } : null,
                        declared: decl ? toDeclared(decl) : null,
                        groupVote: group ? { position: group.position, label: group.label } : null,
                    }),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }

    /** Toutes les lois sur lesquelles une position (votée, déclarée ou de groupe) est connue pour un candidat. */
    async getForCandidate(candidateId: string) {
        const candidate = await this.candidateRepository.findOne({
            where: { id: candidateId, status: In(VISIBLE_CANDIDATE_STATUSES) },
        });
        if (!candidate) throw new NotFoundException('Candidat introuvable');

        const declared = (await this.positionRepository.find({
            where: { candidate: { id: candidateId } },
            relations: ['law'],
        })) as Declared[];
        const personalVotes = candidate.deputyId
            ? await this.officialVoteRepository.find({ where: { deputy: { id: candidate.deputyId } }, relations: ['law'] })
            : [];
        const groupVotes = candidate.groupOrganeRef
            ? await this.groupVoteRepository.find({ where: { organeRef: candidate.groupOrganeRef }, relations: ['law'] })
            : [];

        const lawIds = new Set<string>([
            ...declared.map((p) => p.law?.id),
            ...personalVotes.map((v) => v.law?.id),
            ...groupVotes.map((g) => g.law?.id),
        ].filter(Boolean));
        if (!lawIds.size) return { candidateId, positions: [] };

        const laws = await this.lawRepository.find({ where: { id: In([...lawIds]) }, relations: ['categories'] });

        const positions = laws
            .map((law) => {
                const vote = personalVotes.find((v) => v.law?.id === law.id);
                const decl = declared.find((p) => p.law?.id === law.id);
                const group = groupVotes.find((g) => g.law?.id === law.id);
                return {
                    law: {
                        id: law.id,
                        titleOfficial: law.titleOfficial,
                        titleVulgarized: law.titleVulgarized,
                        voteDate: law.voteDate,
                        categories: (law.categories || []).map((c) => ({ slug: c.slug, name: c.name, icon: c.icon })),
                    },
                    ...resolvePosition({
                        personalVote: vote ? { choice: vote.choice, scrutinId: vote.scrutinId } : null,
                        declared: decl ? toDeclared(decl) : null,
                        groupVote: group ? { position: group.position, label: group.label } : null,
                    }),
                };
            })
            .sort((a, b) => String(b.law.voteDate ?? '').localeCompare(String(a.law.voteDate ?? '')));

        return { candidateId, positions };
    }

    // ---------- Administration (positions déclarées) ----------

    async listDeclared(filter: { candidateId?: string; lawId?: string }) {
        const where: any = {};
        if (filter.candidateId) where.candidate = { id: filter.candidateId };
        if (filter.lawId) where.law = { id: filter.lawId };
        return this.positionRepository.find({
            where,
            relations: ['candidate', 'law'],
            order: { verifiedAt: 'DESC' },
            take: 200,
        });
    }

    /** Crée ou remplace la position déclarée d'un candidat sur une loi. */
    async upsertDeclared(dto: CandidatePositionDto) {
        const [candidate, law] = await Promise.all([
            this.candidateRepository.findOne({ where: { id: dto.candidateId } }),
            this.lawRepository.findOne({ where: { id: dto.lawId } }),
        ]);
        if (!candidate || !law) throw new NotFoundException('Candidat ou loi introuvable');

        const existing = await this.positionRepository.findOne({
            where: { candidate: { id: candidate.id }, law: { id: law.id } },
        });
        const entity = this.positionRepository.create({
            ...(existing ?? {}),
            candidate,
            law,
            position: dto.position,
            sourceType: dto.sourceType,
            sourceUrl: dto.sourceUrl,
            quote: dto.quote?.trim() || null,
            sourceDate: dto.sourceDate,
            verifiedBy: dto.verifiedBy.trim(),
        });
        return this.positionRepository.save(entity);
    }

    async deleteDeclared(id: string) {
        await this.positionRepository.delete(id);
        return { success: true };
    }
}
