// ignore: avoid_web_libraries_in_flutter
import 'dart:js_interop';
import 'package:flutter/foundation.dart';

/// Déclarations JS interop pour accéder aux fonctions exposées dans index.html
@JS('isInstallAvailable')
external bool _isInstallAvailable();

@JS('triggerInstallPrompt')
external JSPromise<JSBoolean> _triggerInstallPrompt();

@JS('isRunningAsPwa')
external bool _isRunningAsPwa();

@JS('getPlatform')
external JSString _getPlatform();

/// Service singleton gérant la logique d'installation PWA.
/// - Android : prompt natif via l'API beforeinstallprompt
/// - iOS : détection pour afficher le guide visuel manuel
class PwaInstallService {
  static final PwaInstallService _instance = PwaInstallService._internal();
  factory PwaInstallService() => _instance;
  PwaInstallService._internal();

  /// Vrai si le prompt Android natif est disponible et en attente
  bool get canInstallAndroid {
    if (!kIsWeb) return false;
    try {
      return _isInstallAvailable();
    } catch (_) {
      return false;
    }
  }

  /// Vrai si l'app tourne en mode standalone (déjà installée)
  bool get isAlreadyInstalled {
    if (!kIsWeb) return false;
    try {
      return _isRunningAsPwa();
    } catch (_) {
      return false;
    }
  }

  /// Vrai si l'utilisateur est sur iOS (et pas encore installé)
  bool get isIos {
    if (!kIsWeb) return false;
    try {
      return _getPlatform().toDart == 'ios';
    } catch (_) {
      return false;
    }
  }

  /// Vrai si l'utilisateur est sur Android avec le prompt disponible
  bool get isAndroid {
    if (!kIsWeb) return false;
    try {
      return _getPlatform().toDart == 'android';
    } catch (_) {
      return false;
    }
  }

  /// Déclenche le prompt natif Android.
  /// Retourne true si l'utilisateur a accepté, false sinon.
  Future<bool> triggerAndroidInstall() async {
    if (!kIsWeb) return false;
    try {
      final result = await _triggerInstallPrompt().toDart;
      return result.toDart;
    } catch (_) {
      return false;
    }
  }
}
