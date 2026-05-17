class CitizenProgress {
  final int currentLevel;
  final String levelName;
  final String badge;
  final int currentXP;
  final int currentLevelXP;
  final int? nextLevelXP;
  final double progressPercentage;
  final int totalVotes;
  final int consecutiveDays;
  final int weeklyStreak;

  CitizenProgress({
    required this.currentLevel,
    required this.levelName,
    required this.badge,
    required this.currentXP,
    required this.currentLevelXP,
    this.nextLevelXP,
    required this.progressPercentage,
    required this.totalVotes,
    required this.consecutiveDays,
    required this.weeklyStreak,
  });

  factory CitizenProgress.fromJson(Map<String, dynamic> json) {
    return CitizenProgress(
      currentLevel: json['currentLevel'] as int,
      levelName: json['levelName'] as String,
      badge: json['badge'] as String,
      currentXP: json['currentXP'] as int,
      currentLevelXP: json['currentLevelXP'] as int,
      nextLevelXP: json['nextLevelXP'] as int?,
      progressPercentage: (json['progressPercentage'] as num).toDouble(),
      totalVotes: json['totalVotes'] as int,
      consecutiveDays: json['consecutiveDays'] as int,
      weeklyStreak: json['weeklyStreak'] as int,
    );
  }

  // Helper: XP needed to reach next level
  int get xpNeededForNextLevel {
    if (nextLevelXP == null) return 0;
    return nextLevelXP! - currentXP;
  }

  // Helper: XP earned in current level
  int get xpInCurrentLevel {
    return currentXP - currentLevelXP;
  }

  // Helper: Total XP range for current level
  int get xpRangeInLevel {
    if (nextLevelXP == null) return 1;
    return nextLevelXP! - currentLevelXP;
  }
}
