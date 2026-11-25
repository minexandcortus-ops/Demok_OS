/// Position d'un candidat sur une loi, toujours accompagnée de son origine.
class CandidatePosition {
  /// POUR, CONTRE, ABSTENTION, NUANCE ou INCONNU
  final String position;

  /// VOTE_PERSONNEL, DECLARATION, PROGRAMME, VOTE_GROUPE ou INCONNU
  final String sourceType;
  final String sourceLabel;
  final String? sourceUrl;
  final String? quote;
  final DateTime? sourceDate;
  final String? groupPosition;
  final String? groupLabel;

  const CandidatePosition({
    required this.position,
    required this.sourceType,
    required this.sourceLabel,
    this.sourceUrl,
    this.quote,
    this.sourceDate,
    this.groupPosition,
    this.groupLabel,
  });

  factory CandidatePosition.fromJson(Map<String, dynamic> json) =>
      CandidatePosition(
        position: json['position'] ?? 'INCONNU',
        sourceType: json['sourceType'] ?? 'INCONNU',
        sourceLabel: json['sourceLabel'] ?? '',
        sourceUrl: json['sourceUrl'],
        quote: json['quote'],
        sourceDate: json['sourceDate'] is String
            ? DateTime.tryParse(json['sourceDate'])
            : null,
        groupPosition: json['groupPosition'],
        groupLabel: json['groupLabel'],
      );

  bool get isKnown => position != 'INCONNU';

  /// Vrai quand la position est celle du groupe et non celle du candidat.
  bool get isGroupProxy => sourceType == 'VOTE_GROUPE';

  static String labelOf(String position) => switch (position) {
        'POUR' => 'Pour',
        'CONTRE' => 'Contre',
        'ABSTENTION' => 'Abstention',
        'NUANCE' => 'Nuancé',
        _ => 'Inconnue',
      };

  String get positionLabel => labelOf(position);

  String get sourceTypeLabel => switch (sourceType) {
        'VOTE_PERSONNEL' => 'Vote de député',
        'DECLARATION' => 'Déclaration',
        'PROGRAMME' => 'Programme',
        'VOTE_GROUPE' => 'Vote du groupe',
        _ => 'Aucune source',
      };
}

/// Position d'un candidat donné (bloc « candidats » d'une fiche loi).
class CandidateOnLaw {
  final String candidateId;
  final String name;
  final String party;
  final CandidatePosition position;

  const CandidateOnLaw(
      {required this.candidateId,
      required this.name,
      required this.party,
      required this.position});

  factory CandidateOnLaw.fromJson(Map<String, dynamic> json) => CandidateOnLaw(
        candidateId: json['candidateId'] ?? '',
        name: json['name'] ?? '',
        party: json['party'] ?? '',
        position: CandidatePosition.fromJson(json),
      );
}

/// Position d'un candidat sur une loi donnée (liste « ses positions » d'un candidat).
class LawOfCandidate {
  final String lawId;
  final String title;
  final DateTime? voteDate;
  final List<({String slug, String name, String icon})> categories;
  final CandidatePosition position;

  const LawOfCandidate({
    required this.lawId,
    required this.title,
    required this.voteDate,
    required this.categories,
    required this.position,
  });

  factory LawOfCandidate.fromJson(Map<String, dynamic> json) {
    final law = json['law'] as Map<String, dynamic>? ?? {};
    return LawOfCandidate(
      lawId: law['id'] ?? '',
      title: (law['titleVulgarized'] as String?)?.isNotEmpty == true
          ? law['titleVulgarized']
          : (law['titleOfficial'] ?? ''),
      voteDate:
          law['voteDate'] is String ? DateTime.tryParse(law['voteDate']) : null,
      categories: (law['categories'] as List<dynamic>? ?? [])
          .map((c) => (
                slug: (c['slug'] ?? '') as String,
                name: (c['name'] ?? '') as String,
                icon: (c['icon'] ?? '') as String
              ))
          .toList(),
      position: CandidatePosition.fromJson(json),
    );
  }
}
