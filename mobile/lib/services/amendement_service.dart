import 'dart:convert';
import '../models/amendement.dart';
import 'api_client.dart';

/// Service pour récupérer les amendements depuis l'API backend.
class AmendementService {
  /// Récupère la liste des amendements pour une loi donnée.
  static Future<List<Amendement>> fetchAmendements(
    String lawId, {
    String? statut,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (statut != null) params['statut'] = statut;

    final queryString = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    final response = await ApiClient.get('/laws/$lawId/amendements?$queryString');

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final items = data['items'] as List<dynamic>;
      return items.map((e) => Amendement.fromJson(e)).toList();
    }

    return [];
  }

  /// Récupère les statistiques des amendements d'une loi.
  static Future<AmendementsStats?> fetchStats(String lawId) async {
    final response = await ApiClient.get('/laws/$lawId/amendements/stats');

    if (response.statusCode == 200) {
      return AmendementsStats.fromJson(json.decode(response.body));
    }
    return null;
  }
}
