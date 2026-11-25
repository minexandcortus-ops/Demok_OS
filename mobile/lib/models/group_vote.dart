/// Vote d'un groupe politique de l'Assemblée sur une loi.
class GroupVote {
  final String organeRef;
  final String label;
  final int pour;
  final int contre;
  final int abstention;
  final int nonVotants;

  /// FOR, AGAINST, ABSTAIN ou MIXED (égalité)
  final String position;
  final List<GroupDissident> dissidents;

  const GroupVote({
    required this.organeRef,
    required this.label,
    required this.pour,
    required this.contre,
    required this.abstention,
    required this.nonVotants,
    required this.position,
    this.dissidents = const [],
  });

  factory GroupVote.fromJson(Map<String, dynamic> json) => GroupVote(
        organeRef: json['organeRef'] ?? '',
        label: json['label'] ?? json['organeRef'] ?? '',
        pour: json['pour'] ?? 0,
        contre: json['contre'] ?? 0,
        abstention: json['abstention'] ?? 0,
        nonVotants: json['nonVotants'] ?? 0,
        position: json['position'] ?? 'MIXED',
        dissidents: (json['dissidents'] as List<dynamic>? ?? [])
            .map((d) => GroupDissident.fromJson(d as Map<String, dynamic>))
            .toList(),
      );

  /// Votes exprimés (hors non-votants)
  int get expressed => pour + contre + abstention;

  String get positionLabel => switch (position) {
        'FOR' => 'Pour',
        'AGAINST' => 'Contre',
        'ABSTAIN' => 'Abstention',
        _ => 'Partagé',
      };
}

class GroupDissident {
  final String deputyId;
  final String fullName;
  final String choice;

  const GroupDissident({required this.deputyId, required this.fullName, required this.choice});

  factory GroupDissident.fromJson(Map<String, dynamic> json) => GroupDissident(
        deputyId: json['deputyId'] ?? '',
        fullName: json['fullName'] ?? '',
        choice: json['choice'] ?? '',
      );

  String get choiceLabel => switch (choice) {
        'FOR' => 'pour',
        'AGAINST' => 'contre',
        'ABSTAIN' => 'abstention',
        _ => choice.toLowerCase(),
      };
}
