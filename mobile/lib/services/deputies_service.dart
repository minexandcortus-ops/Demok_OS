import 'dart:convert';
import '../models/deputy.dart';
import 'api_client.dart';
import 'user_session.dart';

class DeputiesService {
  static Future<List<Deputy>> searchDeputies({String query = '', String sortBy = 'name_asc', int limit = 20, int offset = 0}) async {
    final userId = UserSession().userId;
    String url = '/deputies?q=$query&sortBy=$sortBy&limit=$limit&offset=$offset';
    if (userId != null) {
      url += '&userId=$userId';
    }
    final response = await ApiClient.get(url);
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      final List data = json['deputies'];
      return data.map((d) => Deputy.fromJson(d)).toList();
    } else {
      throw Exception('Failed to load deputies');
    }
  }

  static Future<Deputy> getDeputyById(String id) async {
    final response = await ApiClient.get('/deputies/$id');
    if (response.statusCode == 200) {
      return Deputy.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load deputy');
    }
  }

  static Future<List<DeputyVote>> getDeputyVotes(String id, {int limit = 5}) async {
    final response = await ApiClient.get('/deputies/$id/votes?limit=$limit');
    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      final List data = json['votes'];
      return data.map((v) => DeputyVote.fromJson(v)).toList();
    } else {
      throw Exception('Failed to load deputy votes');
    }
  }

  static Future<Map<String, dynamic>> getDeputyStats(String id) async {
    final response = await ApiClient.get('/deputies/$id/stats');
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load deputy stats');
    }
  }
}
