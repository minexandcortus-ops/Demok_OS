/// Représente un amendement parlementaire lié à une loi.
class Amendement {
  final String id;
  final String externalId;
  final String numero;
  final String auteur;
  final String? texte;
  final String statut;
  final DateTime? dateDepot;
  final String? sort;
  final String? resume;  // Résumé factuel 1 ligne généré par Mistral
  final String? xmlUrl;  // URL XML source (usage interne)

  Amendement({
    required this.id,
    required this.externalId,
    required this.numero,
    required this.auteur,
    this.texte,
    required this.statut,
    this.dateDepot,
    this.sort,
    this.resume,
    this.xmlUrl,
  });

  factory Amendement.fromJson(Map<String, dynamic> json) {
    return Amendement(
      id: json['id'],
      externalId: json['externalId'],
      numero: json['numero'] ?? 'N/A',
      auteur: json['auteur'] ?? 'Auteur inconnu',
      texte: json['texte'],
      statut: json['statut'] ?? 'EN_DISCUSSION',
      dateDepot: json['dateDepot'] != null ? DateTime.tryParse(json['dateDepot']) : null,
      sort: json['sort'],
      resume: json['resume'],
      xmlUrl: json['xmlUrl'],
    );
  }

  /// Libellé humain du statut
  String get statutLabel {
    switch (statut) {
      case 'ADOPTE': return 'Adopté';
      case 'REJETE': return 'Rejeté';
      case 'RETIRE': return 'Retiré';
      case 'NON_DEFENDU': return 'Non défendu';
      case 'TOMBE': return 'Tombé';
      case 'EN_DISCUSSION': return 'En discussion';
      default: return statut;
    }
  }
}

/// Statistiques des amendements d'une loi
class AmendementsStats {
  final String lawId;
  final int total;
  final Map<String, int> parStatut;

  AmendementsStats({
    required this.lawId,
    required this.total,
    required this.parStatut,
  });

  factory AmendementsStats.fromJson(Map<String, dynamic> json) {
    return AmendementsStats(
      lawId: json['lawId'],
      total: json['total'] ?? 0,
      parStatut: Map<String, int>.from(
        (json['parStatut'] as Map<String, dynamic>?)?.map(
          (k, v) => MapEntry(k, v is int ? v : int.tryParse(v.toString()) ?? 0),
        ) ?? {},
      ),
    );
  }
}
