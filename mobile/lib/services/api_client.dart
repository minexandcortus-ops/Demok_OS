import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/env.dart';
import 'user_session.dart';

/// Clé globale pour permettre la navigation sans contexte depuis ApiClient
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

/// Client HTTP centralisé qui injecte les headers nécessaires dans toutes les requêtes.
/// Gère automatiquement les erreurs 401 (token expiré) en déconnectant l'utilisateur.
class ApiClient {
  static const Map<String, String> _defaultHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true', // Contourne l'avertissement de sécurité de localtunnel
  };

  static Map<String, String> _buildHeaders([Map<String, String>? extra]) {
    final headers = Map<String, String>.from(_defaultHeaders);
    
    // Inject JWT token if available
    final token = UserSession().accessToken;
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (extra != null) headers.addAll(extra);
    return headers;
  }

  /// Intercepte les réponses 401 et déconnecte l'utilisateur automatiquement
  static Future<void> _handle401() async {
    await UserSession().clearSession();
    
    // Redirige vers LandingScreen en supprimant toute la pile de navigation
    navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (route) => false);
    
    debugPrint('[ApiClient] Token expiré — session réinitialisée, redirection vers l\'accueil.');
  }

  static Future<http.Response> get(String path, {Map<String, String>? headers}) async {
    // Add cache buster for Web to prevent browser/PWA caching
    final cacheBuster = 't=${DateTime.now().millisecondsSinceEpoch}';
    final pathWithBuster = path.contains('?') ? '$path&$cacheBuster' : '$path?$cacheBuster';
    final uri = Uri.parse('${Env.apiUrl}$pathWithBuster');
    
    final finalHeaders = _buildHeaders(headers);
    finalHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    
    final response = await http.get(uri, headers: finalHeaders);
    if (response.statusCode == 401) await _handle401();
    return response;
  }

  static Future<http.Response> post(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await http.post(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401) await _handle401();
    return response;
  }

  static Future<http.Response> patch(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await http.patch(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401) await _handle401();
    return response;
  }

  static Future<http.Response> put(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await http.put(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401) await _handle401();
    return response;
  }

  static Future<http.Response> delete(String path, {Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await http.delete(uri, headers: _buildHeaders(headers));
    if (response.statusCode == 401) await _handle401();
    return response;
  }
}
