export class VoteCastEvent {
    constructor(
        public readonly citizenId: string,
        public readonly lawId: string,
    ) { }
}
