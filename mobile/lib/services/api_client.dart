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
           !path.contains('/auth/forgot-password') &&
           !path.contains('/auth/refresh') &&
           !path.contains('/auth/logout');
  }

  /// Rafraîchissement en cours, partagé par toutes les requêtes qui reçoivent un 401 en même temps.
  static Future<bool>? _refreshing;

  /// Échange le jeton de rafraîchissement contre une nouvelle paire (une seule fois à la fois).
  static Future<bool> _refreshSession() {
    return _refreshing ??= () async {
      try {
        final refreshToken = UserSession().refreshToken;
        if (refreshToken == null) return false;
        final response = await client.post(
          Uri.parse('${Env.apiUrl}/auth/refresh'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        );
        if (response.statusCode != 200) return false;
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final access = data['accessToken'] as String?;
        final refresh = data['refreshToken'] as String?;
        if (access == null || refresh == null) return false;
        await UserSession().updateTokens(accessToken: access, refreshToken: refresh);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  /// Envoie la requête ; sur 401, tente un rafraîchissement de session puis rejoue la requête une fois.
  static Future<http.Response> _send(String path, Future<http.Response> Function() request) async {
    var response = await request();
    if (response.statusCode != 401 || !_shouldHandle401(path)) return response;

    if (UserSession().accessToken != null && await _refreshSession()) {
      response = await request();
      if (response.statusCode != 401) return response;
    }
    await _handle401();
    return response;
  }

  /// GET : la fraîcheur est gérée par les en-têtes Cache-Control de l'API
  /// (cache public court pour les lectures anonymes, revalidation sinon).
  static Future<http.Response> get(String path, {Map<String, String>? headers}) {
    final uri = Uri.parse('${Env.apiUrl}$path');
    return _send(path, () => client.get(uri, headers: _buildHeaders(headers, false)));
  }

  static Future<http.Response> post(String path, {Object? body, Map<String, String>? headers}) {
    final uri = Uri.parse('${Env.apiUrl}$path');
    return _send(path, () => client.post(uri, headers: _buildHeaders(headers), body: body != null ? jsonEncode(body) : null));
  }

  static Future<http.Response> patch(String path, {Object? body, Map<String, String>? headers}) {
    final uri = Uri.parse('${Env.apiUrl}$path');
    return _send(path, () => client.patch(uri, headers: _buildHeaders(headers), body: body != null ? jsonEncode(body) : null));
  }

  static Future<http.Response> put(String path, {Object? body, Map<String, String>? headers}) {
    final uri = Uri.parse('${Env.apiUrl}$path');
    return _send(path, () => client.put(uri, headers: _buildHeaders(headers), body: body != null ? jsonEncode(body) : null));
  }

  static Future<http.Response> delete(String path, {Map<String, String>? headers}) {
    final uri = Uri.parse('${Env.apiUrl}$path');
    return _send(path, () => client.delete(uri, headers: _buildHeaders(headers, false)));
  }

  /// Déconnexion : révoque le jeton de rafraîchissement côté serveur (au mieux), puis efface la session.
  static Future<void> logout() async {
    final refreshToken = UserSession().refreshToken;
    if (refreshToken != null) {
      try {
        await client.post(
          Uri.parse('${Env.apiUrl}/auth/logout'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        );
      } catch (_) {
        // hors ligne : la session locale est quand même effacée
      }
    }
    await UserSession().clearSession();
  }
}
