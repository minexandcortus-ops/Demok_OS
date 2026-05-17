import 'api_client.dart';
import 'user_session.dart';

class ReportService {
  static Future<bool> submitReport(String lawId, String category, String description) async {
    try {
      final userId = UserSession().userId ?? '';
      
      final response = await ApiClient.post(
        '/reports',
        body: {
          'lawId': lawId,
          'category': category,
          'description': description,
        },
      );

      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      print('Erreur lors du signalement : $e');
      return false;
    }
  }
}
