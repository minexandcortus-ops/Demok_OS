class Env {
  /// URL de l'API (injectée dynamiquement lors de la compilation)
  /// Par défaut, pointe vers l'environnement local pour les tests.
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000/api',
  );
}
