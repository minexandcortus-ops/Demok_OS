
import 'dart:convert';
import '../models/opinion.dart';
import '../models/law.dart';
import 'user_session.dart';
import 'api_client.dart';

class DebateService {
  
  /// Retourne les lois les plus actives dans les débats (triées par nb d'opinions)
  static Future<List<Law>> getActiveLaws({int limit = 20}) async {
    try {
      final response = await ApiClient.get('/debates/active-laws?limit=$limit');
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => Law.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load active debates');
      }
    } catch (e) {
      throw Exception('Error fetching active debates: $e');
    }
  }


  static Future<List<Opinion>> getOpinions(String lawId, {String sort = 'recent'}) async {
    final userId = UserSession().userId;
    try {
      final response = await ApiClient.get(
        '/debates/opinions?lawId=$lawId&sort=$sort',
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) {
          final opinion = Opinion.fromJson(json);
          // Marquer les avis qui appartiennent à l'utilisateur courant
          return opinion.copyWith(isOwn: opinion.author.id == userId);
        }).toList();
      } else {
        throw Exception('Failed to load opinions');
      }
    } catch (e) {
      throw Exception('Error fetching opinions: $e');
    }
  }

  static Future<Opinion> postOpinion(String lawId, String content) async {
    final response = await ApiClient.post(
      '/debates/opinions',
      body: {'lawId': lawId, 'content': content},
    );

    if (response.statusCode == 201) {
      final opinion = Opinion.fromJson(jsonDecode(response.body));
      return opinion.copyWith(isOwn: true);
    } else if (response.statusCode == 403) {
      throw Exception('Niveau insuffisant ou non autorisé');
    } else {
      throw Exception('Failed to post opinion');
    }
  }

  static Future<Opinion> updateOpinion(String opinionId, String content) async {
    final response = await ApiClient.patch(
      '/debates/opinions/$opinionId',
      body: {'content': content},
    );

    if (response.statusCode == 200) {
      final opinion = Opinion.fromJson(jsonDecode(response.body));
      return opinion.copyWith(isOwn: true);
    } else if (response.statusCode == 403) {
      throw Exception('Vous ne pouvez modifier que vos propres avis');
    } else {
      throw Exception('Failed to update opinion');
    }
  }

  static Future<Map<String, dynamic>> toggleMoke(String opinionId) async {
    final response = await ApiClient.post(
      '/debates/opinions/$opinionId/moke',
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
       return jsonDecode(response.body);
    } else {
      throw Exception('Failed to toggle moke');
    }
  }

  static Future<void> reportOpinion(String opinionId, {String? reason}) async {
    final response = await ApiClient.post(
      '/debates/opinions/$opinionId/report',
      body: reason != null ? {'reason': reason} : {},
    );

    if (response.statusCode != 201 && response.statusCode != 200) {
      if (response.statusCode == 409) {
        throw Exception('Vous avez déjà signalé cet avis');
      }
      throw Exception('Failed to report opinion');
    }
  }
}
