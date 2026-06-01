import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'screens/landing_screen.dart';
import 'screens/home_screen.dart';
import 'services/user_session.dart';
import 'services/push_notification_service.dart';
import 'services/api_client.dart'; // Import navigatorKey
import 'package:timeago/timeago.dart' as timeago;
import 'screens/reset_password_screen.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'utils/timeago_fr_custom.dart';
import 'screens/law_loader_screen.dart';

void main() async {
  // Build buster: 2026-05-16 17:20
  WidgetsFlutterBinding.ensureInitialized();
  usePathUrlStrategy();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await UserSession().init();
  if (UserSession().isLoggedIn) {
    await PushNotificationService().init();
  }
  timeago.setLocaleMessages('fr', FrMessagesCustom());
  runApp(const DemokApp());
}

class DemokApp extends StatelessWidget {
  const DemokApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Démok',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey, // Branché pour la gestion 401
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF007AFF)),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
      ),
      onGenerateRoute: (settings) {
        // Handle deep links like /reset-password?token=XYZ
        final uri = Uri.parse(settings.name ?? '');
        
        if (uri.path == '/reset-password') {
          final token = uri.queryParameters['token'];
          if (token != null) {
            return MaterialPageRoute(
              builder: (context) => ResetPasswordScreen(token: token),
            );
          }
        }
        
        if (uri.path == '/surveys') {
          return MaterialPageRoute(
            builder: (context) => (UserSession().isLoggedIn || UserSession().isGuest) 
              ? const HomeScreen(initialTab: 1)
              : const LandingScreen(),
          );
        }

        if (uri.path.startsWith('/laws/')) {
          final parts = uri.path.split('/');
          if (parts.length == 3) {
            final lawId = parts[2];
            return MaterialPageRoute(
              builder: (context) => LawLoaderScreen(lawId: lawId),
            );
          }
        }
        
        // Default routing
        return MaterialPageRoute(
          builder: (context) => (UserSession().isLoggedIn || UserSession().isGuest) 
            ? const HomeScreen() 
            : const LandingScreen(),
        );
      },
    );
  }
}
