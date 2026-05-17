import 'package:flutter/material.dart';

/// Thématique d'une loi (ex: Environnement, Économie).
/// Gère également l'affichage visuel (icône emoji et couleur).
class Category {
  final int id;
  final String name;
  final String slug;
  final String color; // Hex string e.g. "#FFD700"
  final String icon; // Emoji

  Category({
    required this.id,
    required this.name,
    required this.slug,
    required this.color,
    required this.icon,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'],
      name: json['name'],
      slug: json['slug'],
      color: json['color'],
      icon: json['icon'],
    );
  }

  /// Convertit la chaîne Hex (ex: "#FFD700") en objet Color Flutter.
  Color get colorObject {
    try {
      return Color(int.parse(color.replaceFirst('#', '0xFF')));
    } catch (e) {
      return Colors.grey;
    }
  }
}
