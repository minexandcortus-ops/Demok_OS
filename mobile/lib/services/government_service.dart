import '../services/api_client.dart';
import '../data/government_data.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class GovernmentService {
  static const String _cacheKey = 'cached_government_composition';

  // Fetch the latest government composition directly from the NestJS Backend
  static Future<List<GovernmentMember>> fetchGovernmentComposition() async {
    try {
      final response = await ApiClient.get('/government/composition');

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = jsonDecode(response.body);
        final members = jsonList.map((json) => GovernmentMember.fromJson(json)).toList();
        
        // Cache the result so it loads fast next time
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_cacheKey, response.body);

        return members;
      } else {
        throw Exception('Failed to load government composition from API');
      }
    } catch (e) {
      // Fallback to local cache if offline or server is down
      final prefs = await SharedPreferences.getInstance();
      final cachedData = prefs.getString(_cacheKey);
      if (cachedData != null) {
        final List<dynamic> jsonList = jsonDecode(cachedData);
        return jsonList.map((json) => GovernmentMember.fromJson(json)).toList();
      }
      
      // If no cache, return empty list or throw error
      throw Exception('Impossible de charger le gouvernement. Êtes-vous connecté à internet ?');
    }
  }
}
