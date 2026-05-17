/// Résultat agrégé du vote des députés à l'Assemblée Nationale.
class DeputyVoteResult {
  final int pour;
  final int contre;
  final int abstention;
  final int nonVotants;
  final int total;
  final bool adopted;
  final String scrutinId;
  final String? dateScrutin;
  final bool isSimplified;

  DeputyVoteResult({
    required this.pour,
    required this.contre,
    required this.abstention,
    required this.nonVotants,
    required this.total,
    required this.adopted,
    required this.scrutinId,
    this.dateScrutin,
    this.isSimplified = false,
  });

  factory DeputyVoteResult.fromJson(Map<String, dynamic> json) {
    return DeputyVoteResult(
      pour: json['pour'] ?? 0,
      contre: json['contre'] ?? 0,
      abstention: json['abstention'] ?? 0,
      nonVotants: json['nonVotants'] ?? 0,
      total: json['total'] ?? 0,
      adopted: json['adopted'] ?? false,
      scrutinId: json['scrutinId'] ?? '',
      dateScrutin: json['dateScrutin'],
      isSimplified: json['isSimplified'] ?? false,
    );
  }

  /// Pourcentage de votes POUR parmi les votants (hors non-votants)
  double get pourPercentage => total > 0 ? (pour / total) * 100 : 0;

  /// Pourcentage de votes CONTRE parmi les votants
  double get contrePercentage => total > 0 ? (contre / total) * 100 : 0;

  /// Pourcentage d'abstentions parmi les votants
  double get abstentionPercentage => total > 0 ? (abstention / total) * 100 : 0;
}
