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
  /// Client HTTP sous-jacent (remplaçable dans les tests).
  static http.Client client = http.Client();

  /// En-têtes communs. Les GET n'envoient pas de Content-Type : sans en-tête « non simple »,
  /// une requête anonyme évite le preflight CORS (OPTIONS) et peut profiter du cache HTTP.
  static Map<String, String> _buildHeaders([Map<String, String>? extra, bool withBody = true]) {
    final headers = <String, String>{
      if (withBody) 'Content-Type': 'application/json',
    };
    
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
    
    // Redirige vers l'accueil (mode invité) en supprimant toute la pile de navigation
    navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (route) => false);
    
    debugPrint('[ApiClient] Token expiré — session réinitialisée, redirection vers l\'accueil.');
  }

  static bool _shouldHandle401(String path) {
    return !path.contains('/auth/login') && 
           !path.contains('/auth/register') && 
           !path.contains('/auth/forgot-password');
  }

  /// GET : la fraîcheur est gérée par les en-têtes Cache-Control de l'API
  /// (cache public court pour les lectures anonymes, revalidation sinon).
  static Future<http.Response> get(String path, {Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await client.get(uri, headers: _buildHeaders(headers, false));
    if (response.statusCode == 401 && _shouldHandle401(path)) await _handle401();
    return response;
  }

  static Future<http.Response> post(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await client.post(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401 && _shouldHandle401(path)) await _handle401();
    return response;
  }

  static Future<http.Response> patch(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await client.patch(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401 && _shouldHandle401(path)) await _handle401();
    return response;
  }

  static Future<http.Response> put(String path, {Object? body, Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await client.put(
      uri,
      headers: _buildHeaders(headers),
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode == 401 && _shouldHandle401(path)) await _handle401();
    return response;
  }

  static Future<http.Response> delete(String path, {Map<String, String>? headers}) async {
    final uri = Uri.parse('${Env.apiUrl}$path');
    final response = await client.delete(uri, headers: _buildHeaders(headers, false));
    if (response.statusCode == 401 && _shouldHandle401(path)) await _handle401();
    return response;
  }
}
