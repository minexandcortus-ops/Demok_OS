class CitizenLevel {
  final int level;
  final String name;
  final String badge;
  final int xpRequired;

  CitizenLevel({
    required this.level,
    required this.name,
    required this.badge,
    required this.xpRequired,
  });

  factory CitizenLevel.fromJson(Map<String, dynamic> json) {
    return CitizenLevel(
      level: json['level'] as int,
      name: json['name'] as String,
      badge: json['badge'] as String,
      xpRequired: json['xpRequired'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'level': level,
      'name': name,
      'badge': badge,
      'xpRequired': xpRequired,
    };
  }
}
