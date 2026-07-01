import 'category.dart';
import 'deputy_vote_result.dart';

/// Statuts possibles d'une loi dans son cycle de vie parlementaire.
enum LawStatus {
  upcoming,   // À venir (inscrite à l'agenda, date future)
  pending,    // En cours (date passée, scrutin attendu)
  votedAn,    // Votée à l'Assemblée Nationale
  atSenate,   // En navette au Sénat
  validated,  // Promulguée (adoptée définitivement)
  rejected,   // Rejetée définitivement
}

/// Représente une loi ou proposition de loi.
/// Contient les données officielles, le résumé vulgarisé et les stats de vote.
class Law {
  final String id;
  final String externalId;
  final String titleOfficial;
  final String? titleVulgarized;
  final LawSummary? summary;
  final String status;
  final DateTime? voteDate;
  final DateTime? agendaDate;
  final String source;
  final VoteStatistics? statistics;
  final List<Category> categories;
  final String? userVote;
  final DateTime? dateDepot;
  final DateTime? datePromulgation;
  final int navetteCount;
  final bool procedureAcceleree;
  final String? officialUrl;
  final String? latestTextUrl;
  final String? latestTextType;
  final DeputyVoteResult? deputyVoteResult;
  bool isFavorited;

  Law({
    required this.id,
    required this.externalId,
    required this.titleOfficial,
    this.titleVulgarized,
    this.summary,
    required this.status,
    this.voteDate,
    this.agendaDate,
    required this.source,
    this.statistics,
    this.categories = const [],
    this.userVote,
    this.dateDepot,
    this.datePromulgation,
    this.navetteCount = 0,
    this.procedureAcceleree = false,
    this.officialUrl,
    this.latestTextUrl,
    this.latestTextType,
    this.deputyVoteResult,
    this.isFavorited = false,
  });

  /// Retourne le titre vulgarisé s'il existe, sinon le titre officiel.
  String get formattedTitle {
    final title = titleVulgarized ?? titleOfficial;
    if (title.isEmpty) return '';
    final lower = title.toLowerCase();
    final cased = lower[0].toUpperCase() + lower.substring(1);
    return cased.replaceAll('Démok', 'Démok');
  }

  /// Retourne le statut typé (enum) depuis la chaîne JSON.
  LawStatus get lawStatus {
    LawStatus baseStatus;
    switch (status.toUpperCase()) {
      case 'UPCOMING':   baseStatus = LawStatus.upcoming; break;
      case 'PENDING':    baseStatus = LawStatus.pending; break;
      case 'VOTED_AN':   baseStatus = LawStatus.votedAn; break;
      case 'AT_SENATE':  baseStatus = LawStatus.atSenate; break;
      case 'VALIDATED':  baseStatus = LawStatus.validated; break;
      case 'REJECTED':   baseStatus = LawStatus.rejected; break;
      // Compatibilité avec anciens statuts
      case 'VOTED':      baseStatus = LawStatus.votedAn; break;
      case 'PROMULGATED': baseStatus = LawStatus.validated; break;
      default:           baseStatus = LawStatus.pending; break;
    }

    // Période de grâce : maintenir la loi en statut "En cours" (pending) visuellement
    // si le vote a lieu aujourd'hui ou dans le futur (même si le backend l'a marquée comme votée).
    // Elle ne passera au statut officiel "Votée" que le lendemain.
    if (baseStatus != LawStatus.upcoming && baseStatus != LawStatus.pending) {
      // Si on a déjà les résultats du vote de l'AN, on ne force plus le pending
      if (deputyVoteResult != null) return baseStatus;

      final date = voteDate ?? agendaDate;
      if (date != null) {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final dateOnly = DateTime(date.year, date.month, date.day);
        
        // Si la date est égale à aujourd'hui (ou dans le futur), on force pending
        if (!dateOnly.isBefore(today)) {
          return LawStatus.pending;
        }
      }
    }
    
    return baseStatus;
  }

  /// Libellé affiché dans l'UI pour le statut.
  String get statusLabel {
    switch (lawStatus) {
      case LawStatus.upcoming:  return 'À venir';
      case LawStatus.pending:   return 'Discussion en cours';
      case LawStatus.votedAn:   return 'Adoptée';
      case LawStatus.atSenate:  return 'Au Sénat';
      case LawStatus.validated: return 'Adoptée';
      case LawStatus.rejected:  return 'Rejetée';
    }
  }

  /// Indique si le vote de cette loi est prévu aujourd'hui ("Vote aujourd'hui").
  bool get isVoteToday {
    final date = agendaDate ?? voteDate;
    if (date == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(date.year, date.month, date.day);
    return dateOnly == today;
  }

  /// Indique si le vote est ouvert (aujourd'hui ou dans le futur).
  /// Seules ces lois peuvent être votées par l'utilisateur.
  bool get isVotingOpen {
    final date = agendaDate ?? voteDate;
    if (date == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(date.year, date.month, date.day);
    // Le vote est ouvert si la date est aujourd'hui ou dans le futur
    return !dateOnly.isBefore(today);
  }

  /// Indique si l'utilisateur peut encore voter.
  /// Restreint aux lois dont le vote est aujourd'hui ou dans le futur.
  bool get isVotable => isVotingOpen;

  factory Law.fromJson(Map<String, dynamic> json) {
    return Law(
      id: json['id'],
      externalId: json['externalId'],
      titleOfficial: json['titleOfficial'],
      titleVulgarized: json['titleVulgarized'],
      summary: json['summary'] != null ? LawSummary.fromJson(json['summary']) : null,
      status: json['status'],
      voteDate: json['voteDate'] != null ? DateTime.parse(json['voteDate']) : null,
      agendaDate: json['agendaDate'] != null ? DateTime.parse(json['agendaDate']) : null,
      source: json['source'],
      statistics: json['statistics'] != null ? VoteStatistics.fromJson(json['statistics']) : null,
      categories: (json['categories'] as List<dynamic>?)
          ?.map((e) => Category.fromJson(e))
          .toList() ?? [],
      userVote: json['userVote'],
      dateDepot: json['dateDepot'] != null ? DateTime.parse(json['dateDepot']) : null,
      datePromulgation: json['datePromulgation'] != null ? DateTime.parse(json['datePromulgation']) : null,
      navetteCount: json['navetteCount'] ?? 0,
      procedureAcceleree: json['procedureAcceleree'] ?? false,
      officialUrl: json['officialUrl'],
      latestTextUrl: json['latestTextUrl'],
      latestTextType: json['latestTextType'],
      deputyVoteResult: json['deputyVoteResult'] != null
          ? DeputyVoteResult.fromJson(json['deputyVoteResult'])
          : null,
      isFavorited: json['isFavorited'] ?? false,
    );
  }
}

/// Résumé simplifié d'une loi avec les sections par catégorie et les arguments Pro/Contra.
class LawSummary {
  final Map<String, String> sections;
  final List<String> pro;
  final List<String> con;

  LawSummary({required this.sections, required this.pro, required this.con});

  factory LawSummary.fromJson(Map<String, dynamic> json) {
    return LawSummary(
      sections: Map<String, String>.from(json['sections'] ?? {}),
      pro: List<String>.from(json['pro'] ?? []),
      con: List<String>.from(json['con'] ?? []),
    );
  }
}

/// Statistiques globales des votes des citoyens sur une loi.
class VoteStatistics {
  final int totalVotes;
  final double forPercentage;
  final double againstPercentage;
  final double abstainPercentage;

  VoteStatistics({
    required this.totalVotes,
    required this.forPercentage,
    required this.againstPercentage,
    required this.abstainPercentage,
  });

  factory VoteStatistics.fromJson(Map<String, dynamic> json) {
    return VoteStatistics(
      totalVotes: json['totalVotes'],
      forPercentage: (json['forPercentage'] as num).toDouble(),
      againstPercentage: (json['againstPercentage'] as num).toDouble(),
      abstainPercentage: (json['abstainPercentage'] as num).toDouble(),
    );
  }
}
