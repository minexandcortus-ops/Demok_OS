/// Règles de saisie partagées avec la validation backend (class-validator).
class Validators {
  Validators._();

  /// Doit rester aligné sur PASSWORD_MIN_LENGTH côté backend.
  static const int passwordMinLength = 8;

  /// Limite de bcrypt (72 octets) appliquée côté backend.
  static const int passwordMaxLength = 72;

  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  /// Retourne un message d'erreur, ou null si le mot de passe est valide.
  static String? password(String value) {
    if (value.length < passwordMinLength) {
      return 'Le mot de passe doit contenir au moins $passwordMinLength caractères';
    }
    if (value.length > passwordMaxLength) {
      return 'Le mot de passe ne doit pas dépasser $passwordMaxLength caractères';
    }
    return null;
  }

  /// Retourne un message d'erreur, ou null si l'email est valide.
  static String? email(String value) {
    if (!_email.hasMatch(value.trim())) {
      return "Cette adresse email ne semble pas valide";
    }
    return null;
  }
}
