import 'dart:convert';
import 'user_session.dart';
import 'api_client.dart';

class LawService {
  /// Toggles the favorite status of a law for the current user.
  /// Returns the new favorite status (true if favorited, false if unfavorited).
  static Future<bool> toggleFavorite(String lawId) async {
    if (!UserSession().isLoggedIn) {
      throw Exception('Veuillez vous connecter pour ajouter des favoris');
    }

    final response = await ApiClient.post(
      '/votes/laws/$lawId/favorite',
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['isFavorited'] ?? false;
    } else {
      throw Exception('Failed to toggle favorite: ${response.body}');
    }
  }
}
