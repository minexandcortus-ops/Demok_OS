import 'dart:convert';
import '../models/citizen_level.dart';
import '../models/citizen_progress.dart';
import 'api_client.dart';

class GamificationService {

  /// Récupère la progression du citoyen connecté
  Future<CitizenProgress?> getProgress() async {
    try {
      final response = await ApiClient.get('/gamification/progress');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return CitizenProgress.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Error fetching progress: $e');
      return null;
    }
  }

  /// Récupère tous les niveaux disponibles
  Future<List<CitizenLevel>> getAllLevels() async {
    try {
      final response = await ApiClient.get('/gamification/levels');

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => CitizenLevel.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      print('Error fetching levels: $e');
      return [];
    }
  }
}
