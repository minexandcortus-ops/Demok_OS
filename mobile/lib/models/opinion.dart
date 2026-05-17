
class Opinion {
  final String id;
  final String content;
  final int mokes;
  final DateTime createdAt;
  final bool hasMoked;
  final OpinionAuthor author;
  final bool isOwn;

  Opinion({
    required this.id,
    required this.content,
    required this.mokes,
    required this.createdAt,
    required this.hasMoked,
    required this.author,
    this.isOwn = false,
  });

  factory Opinion.fromJson(Map<String, dynamic> json) {
    return Opinion(
      id: json['id'],
      content: json['content'],
      mokes: json['mokes'],
      createdAt: DateTime.parse(json['createdAt']),
      hasMoked: json['hasMoked'] ?? false,
      author: OpinionAuthor.fromJson(json['author']),
    );
  }

  Opinion copyWith({String? content, int? mokes, bool? hasMoked, bool? isOwn}) {
    return Opinion(
      id: id,
      content: content ?? this.content,
      mokes: mokes ?? this.mokes,
      createdAt: createdAt,
      hasMoked: hasMoked ?? this.hasMoked,
      author: author,
      isOwn: isOwn ?? this.isOwn,
    );
  }
}

class OpinionAuthor {
  final String id;
  final String pseudo;
  final int level;

  OpinionAuthor({
    required this.id,
    required this.pseudo,
    required this.level,
  });

  factory OpinionAuthor.fromJson(Map<String, dynamic> json) {
    return OpinionAuthor(
      id: json['id'],
      pseudo: json['pseudo'],
      level: json['level'],
    );
  }
}
