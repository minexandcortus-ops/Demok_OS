class Deputy {
  final String id;
  final String fullName;
  final String? party;
  final String? constituencyCode;
  final String? groupePolitique;
  final String? photoUrl;
  final String? bio;
  final String? department;
  final int? presenceWeeks;
  final int? votesCount;
  final bool? isActive;

  Deputy({
    required this.id,
    required this.fullName,
    this.party,
    this.constituencyCode,
    this.groupePolitique,
    this.photoUrl,
    this.bio,
    this.department,
    this.presenceWeeks,
    this.votesCount,
    this.isActive = true,
  });

  factory Deputy.fromJson(Map<String, dynamic> json) {
    return Deputy(
      id: json['id'],
      fullName: json['fullName'],
      party: json['party'],
      constituencyCode: json['constituencyCode'],
      groupePolitique: json['groupePolitique'],
      photoUrl: json['photoUrl'],
      bio: json['bio'],
      department: json['department'],
      presenceWeeks: json['presenceWeeks'],
      votesCount: json['votesCount'],
      isActive: json['isActive'] ?? true,
    );
  }
}

class DeputyVote {
  final String id;
  final String lawId;
  final String lawTitle;
  final String choice;
  final DateTime? voteDate;
  final String scrutinId;

  DeputyVote({
    required this.id,
    required this.lawId,
    required this.lawTitle,
    required this.choice,
    this.voteDate,
    required this.scrutinId,
  });

  factory DeputyVote.fromJson(Map<String, dynamic> json) {
    return DeputyVote(
      id: json['id'],
      lawId: json['lawId'],
      lawTitle: json['lawTitle'],
      choice: json['choice'],
      voteDate: json['voteDate'] != null ? DateTime.parse(json['voteDate']) : null,
      scrutinId: json['scrutinId'],
    );
  }
}
