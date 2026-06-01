class Env {
  /// URL de l'API (injectée dynamiquement lors de la compilation)
  /// Par défaut, pointe vers l'environnement local pour les tests.
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.0.103:3000/api',
  );
}
