import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroupVote } from './group-vote.entity';
import { Deputy } from './deputy.entity';
import { OfficialVote } from './official-vote.entity';
import { Law } from '../laws/law.entity';
import { GroupVoteData, isDissident, mostCommonLabel } from './group-votes';

export interface GroupVoteView {
    organeRef: string;
    label: string;
    pour: number;
    contre: number;
    abstention: number;
    nonVotants: number;
    position: string;
    dissidents: Array<{ deputyId: string; fullName: string; choice: string }>;
}

@Injectable()
export class GroupVotesService {
    private readonly logger = new Logger(GroupVotesService.name);

    constructor(
        @InjectRepository(GroupVote) private readonly groupVoteRepository: Repository<GroupVote>,
        @InjectRepository(Deputy) private readonly deputyRepository: Repository<Deputy>,
        @InjectRepository(OfficialVote) private readonly officialVoteRepository: Repository<OfficialVote>,
    ) { }

    /**
     * Remplace les votes par groupe d'une loi.
     * Les libellés manquants sont déduits de l'étiquette des députés du groupe,
     * et l'appartenance au groupe (organeRef) est enregistrée sur chaque député.
     */
    async replaceForLaw(law: Law, scrutinId: string, groups: GroupVoteData[]): Promise<number> {
        if (!groups.length) return 0;

        const allRefs = groups.flatMap((g) => [...g.nominatif.FOR, ...g.nominatif.AGAINST, ...g.nominatif.ABSTAIN]);
        const deputies = allRefs.length ? await this.deputyRepository.find({ where: { anActeurRef: In(allRefs) } }) : [];
        const partyByRef = new Map(deputies.map((d) => [d.anActeurRef, d.party]));

        const rows = groups.map((g) => {
            const refs = [...g.nominatif.FOR, ...g.nominatif.AGAINST, ...g.nominatif.ABSTAIN];
            return this.groupVoteRepository.create({
                law,
                scrutinId,
                organeRef: g.organeRef,
                label: g.label || mostCommonLabel(refs.map((r) => partyByRef.get(r)), g.organeRef),
                pour: g.pour,
                contre: g.contre,
                abstention: g.abstention,
                nonVotants: g.nonVotants,
                position: g.position,
            });
        });

        await this.groupVoteRepository.delete({ law: { id: law.id } });
        await this.groupVoteRepository.save(rows);

        for (const g of groups) {
            const refs = [...g.nominatif.FOR, ...g.nominatif.AGAINST, ...g.nominatif.ABSTAIN];
            if (refs.length) {
                await this.deputyRepository.update({ anActeurRef: In(refs) }, { groupePolitique: g.organeRef });
            }
        }

        this.logger.log(`🏛️ ${rows.length} groupe(s) enregistré(s) pour ${law.externalId} (scrutin ${scrutinId})`);
        return rows.length;
    }

    async hasGroupVotes(lawId: string): Promise<boolean> {
        return (await this.groupVoteRepository.count({ where: { law: { id: lawId } } })) > 0;
    }

    /** Votes par groupe d'une loi, du plus grand au plus petit groupe, avec les frondeurs. */
    async getForLaw(lawId: string): Promise<{ scrutinId: string | null; groups: GroupVoteView[] }> {
        const groups = await this.groupVoteRepository.find({ where: { law: { id: lawId } } });
        if (!groups.length) return { scrutinId: null, groups: [] };

        const votes = await this.officialVoteRepository.find({
            where: { law: { id: lawId } },
            relations: ['deputy'],
        });

        const views = groups.map((g) => ({
            organeRef: g.organeRef,
            label: g.label,
            pour: g.pour,
            contre: g.contre,
            abstention: g.abstention,
            nonVotants: g.nonVotants,
            position: g.position,
            dissidents: votes
                .filter((v) => v.deputy?.groupePolitique === g.organeRef && isDissident(v.choice, g.position))
                .map((v) => ({ deputyId: v.deputy.id, fullName: v.deputy.fullName, choice: v.choice }))
                .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr')),
        }));

        const size = (g: GroupVoteView) => g.pour + g.contre + g.abstention + g.nonVotants;
        views.sort((a, b) => size(b) - size(a) || a.label.localeCompare(b.label, 'fr'));
        return { scrutinId: groups[0].scrutinId, groups: views };
    }
}
