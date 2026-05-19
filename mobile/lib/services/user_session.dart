import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Singleton gérant la session de l'utilisateur connecté dans l'application.
/// Stocke les identifiants essentiels pour les appels API (userId, citizenId, accessToken).
class UserSession {
  static final UserSession _instance = UserSession._internal();
  
  factory UserSession() {
    return _instance;
  }
  
  UserSession._internal();
  
  String? userId;
  String? citizenId;
  String? pseudo;
  String? email;
  int? birthYear;
  String? accessToken;
  
  SharedPreferences? _prefs;

  bool get isLoggedIn => accessToken != null;
  bool get isGuest => _prefs?.getBool('session_isGuest') ?? false;
  
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    
    // Restore session variables
    userId = _prefs?.getString('session_userId');
    citizenId = _prefs?.getString('session_citizenId');
    pseudo = _prefs?.getString('session_pseudo');
    email = _prefs?.getString('session_email');
    birthYear = _prefs?.getInt('session_birthYear');
    accessToken = _prefs?.getString('session_token');

    if (kDebugMode) {
      debugPrint('[UserSession] Initialized. LoggedIn: $isLoggedIn');
      debugPrint('[UserSession] userId: $userId, pseudo: $pseudo');
      if (accessToken != null) {
        debugPrint('[UserSession] Token found: ${accessToken!.substring(0, 10)}...');
      } else {
        debugPrint('[UserSession] No token found in SharedPreferences');
      }
    }
  }

  // Helper to get per-user key
  String _getUserKey(String baseKey) => userId != null ? '${baseKey}_$userId' : baseKey;

  // Obtenir/Définir le statut du tutoriel Accueil
  bool get hasSeenHomeShowcase => _prefs?.getBool(_getUserKey('hasSeenHomeShowcase')) ?? false;
  Future<void> setHomeShowcaseSeen() async => await _prefs?.setBool(_getUserKey('hasSeenHomeShowcase'), true);

  // Obtenir/Définir le statut du tutoriel Profil
  bool get hasSeenProfileShowcase => _prefs?.getBool(_getUserKey('hasSeenProfileShowcase')) ?? false;
  Future<void> setProfileShowcaseSeen() async => await _prefs?.setBool(_getUserKey('hasSeenProfileShowcase'), true);

  // Obtenir/Définir le statut du tutoriel Loi
  bool get hasSeenLawShowcase => _prefs?.getBool(_getUserKey('hasSeenLawShowcase')) ?? false;
  Future<void> setLawShowcaseSeen() async => await _prefs?.setBool(_getUserKey('hasSeenLawShowcase'), true);

  // Obtenir/Définir le statut du tutoriel Sondages
  bool get hasSeenSurveysShowcase => _prefs?.getBool(_getUserKey('hasSeenSurveysShowcase')) ?? false;
  Future<void> setSurveysShowcaseSeen() async => await _prefs?.setBool(_getUserKey('hasSeenSurveysShowcase'), true);

  // Obtenir/Définir le statut du tutoriel Débats
  bool get hasSeenDebatesShowcase => _prefs?.getBool(_getUserKey('hasSeenDebatesShowcase')) ?? false;
  Future<void> setDebatesShowcaseSeen() async => await _prefs?.setBool(_getUserKey('hasSeenDebatesShowcase'), true);

  // ---- Bannière d'installation PWA ----

  /// Timestamp (ms) du dernier "soft dismiss" (swipe/auto)
  int? get _pwaPromptSoftDismissAt => _prefs?.getInt('pwa_prompt_soft_dismiss_at');
  
  /// Timestamp (ms) du dernier "hard dismiss" (bouton Pas maintenant)
  int? get _pwaPromptHardDismissAt => _prefs?.getInt('pwa_prompt_hard_dismiss_at');

  /// L'app a été installée avec succès via notre bannière
  bool get pwaInstalled => _prefs?.getBool('pwa_prompt_installed') ?? false;

  /// Vrai si la bannière doit être affichée (en tenant compte des délais)
  bool get shouldShowPwaBanner {
    if (pwaInstalled) return false;
    final now = DateTime.now().millisecondsSinceEpoch;
    // Hard dismiss = 15 jours
    final hardDismiss = _pwaPromptHardDismissAt;
    if (hardDismiss != null && now - hardDismiss < 15 * 86400 * 1000) return false;
    // Soft dismiss = 1 jour
    final softDismiss = _pwaPromptSoftDismissAt;
    if (softDismiss != null && now - softDismiss < 1 * 86400 * 1000) return false;
    return true;
  }

  Future<void> setPwaBannerSoftDismissed() async {
    await _prefs?.setInt('pwa_prompt_soft_dismiss_at', DateTime.now().millisecondsSinceEpoch);
  }

  Future<void> setPwaBannerHardDismissed() async {
    await _prefs?.setInt('pwa_prompt_hard_dismiss_at', DateTime.now().millisecondsSinceEpoch);
  }

  Future<void> setPwaInstalled() async {
    await _prefs?.setBool('pwa_prompt_installed', true);
  }

  // Définir le mode invité
  Future<void> setGuestMode(bool isGuest) async {
    if (_prefs != null) {
      await _prefs!.setBool('session_isGuest', isGuest);
    }
  }

  Future<void> saveSession({
    required String userId, 
    String? citizenId, 
    String? pseudo, 
    String? email,
    int? birthYear,
    String? token,
  }) async {
    this.userId = userId;
    this.citizenId = citizenId;
    this.pseudo = pseudo;
    if (email != null) this.email = email;
    if (birthYear != null) this.birthYear = birthYear;
    if (token != null) this.accessToken = token;
    
    if (kDebugMode) {
      debugPrint('[UserSession] Saving session: userId=$userId, pseudo=$pseudo, email=$email, birthYear=$birthYear');
    }

    if (_prefs != null) {
      await _prefs!.setString('session_userId', userId);
      if (citizenId != null) await _prefs!.setString('session_citizenId', citizenId);
      if (pseudo != null) await _prefs!.setString('session_pseudo', pseudo);
      if (email != null) await _prefs!.setString('session_email', email);
      if (birthYear != null) await _prefs!.setInt('session_birthYear', birthYear);
      if (token != null) await _prefs!.setString('session_token', token);
      await _prefs!.remove('session_isGuest'); // Login clears guest mode
    }
  }
  
  Future<void> clearSession() async {
    userId = null;
    citizenId = null;
    pseudo = null;
    email = null;
    accessToken = null;
    
    if (_prefs != null) {
      await _prefs!.remove('session_userId');
      await _prefs!.remove('session_citizenId');
      await _prefs!.remove('session_pseudo');
      await _prefs!.remove('session_email');
      await _prefs!.remove('session_birthYear');
      await _prefs!.remove('session_token');
      await _prefs!.remove('session_isGuest');
    }
  }
}
