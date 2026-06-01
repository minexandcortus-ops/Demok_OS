import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_client.dart';

Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print("Handling a background message: ${message.messageId}");
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotificationsPlugin = FlutterLocalNotificationsPlugin();
  
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    try {
      NotificationSettings settings = await _fcm.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      print('User granted permission: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.authorized || 
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        
        try {
          // Sur le web en HTTP (non localhost), cela peut crasher
          String? token = await _fcm.getToken(
            vapidKey: 'BO4Eme4w7B-v7FNtAMQnDQc8WgC9mHz6FJd7t2oKjMhH6kw_xsaQoh0rik1qIMAILCDvqXpT1ih9YPdCA3hQnd0',
          );
          if (token != null) {
            await _sendTokenToBackend(token);
          }

          _fcm.onTokenRefresh.listen((newToken) {
            _sendTokenToBackend(newToken);
          });
        } catch (e) {
          print("FCM Token error (likely non-HTTPS web environment): $e");
        }

        const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
        const DarwinInitializationSettings initializationSettingsIOS = DarwinInitializationSettings();
        const InitializationSettings initializationSettings = InitializationSettings(
          android: initializationSettingsAndroid,
          iOS: initializationSettingsIOS,
        );
        
        await _localNotificationsPlugin.initialize(
          settings: initializationSettings,
          onDidReceiveNotificationResponse: (NotificationResponse response) {
             _handleNotificationTap(response.payload);
          },
        );

        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          if (message.notification != null && !kIsWeb) {
            _showLocalNotification(message);
          }
        });

        RemoteMessage? initialMessage = await FirebaseMessaging.instance.getInitialMessage();
        if (initialMessage != null) {
          _handleMessageAction(initialMessage.data);
        }

        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          _handleMessageAction(message.data);
        });

        _initialized = true;
      }
    } catch (e) {
      print("Failed to initialize push notifications: $e");
    }
  }

  Future<void> _sendTokenToBackend(String token) async {
    try {
      await ApiClient.patch('/users/fcm-token', body: {'fcmToken': token});
      print("FCM Token synced with backend");
    } catch (e) {
      print("Failed to sync FCM Token: $e");
    }
  }

  void _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics = AndroidNotificationDetails(
      'demok_notifications', // channel id
      'Démok Notifications', // channel name
      importance: Importance.max,
      priority: Priority.high,
      showWhen: false,
    );
    const NotificationDetails platformChannelSpecifics = NotificationDetails(android: androidPlatformChannelSpecifics);
    
    await _localNotificationsPlugin.show(
      id: message.hashCode,
      title: message.notification?.title,
      body: message.notification?.body,
      notificationDetails: platformChannelSpecifics,
      payload: jsonEncode(message.data),
    );
  }

  void _handleNotificationTap(String? payload) {
    if (payload != null) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        _handleMessageAction(data);
      } catch (e) {
        print("Error parsing payload: $e");
      }
    }
  }

  void _handleMessageAction(Map<String, dynamic> data) {
    print("Notification tapped with data: $data");

    // L'application peut être en train de démarrer, le navigatorKey peut être null temporairement.
    // On boucle jusqu'à ce que le state soit prêt (max 5 secondes).
    int retries = 50;
    void tryNavigate() {
      if (navigatorKey.currentState != null) {
        final type = data['type'] as String?;
        if (type == 'NEW_SURVEY' || type == 'SURVEY_CLOSED') {
          navigatorKey.currentState!.pushNamed('/surveys');
        } else if (type == 'LAW_MODIFIED' && data['lawId'] != null) {
          navigatorKey.currentState!.pushNamed('/laws/${data['lawId']}');
        }
      } else if (retries > 0) {
        retries--;
        Future.delayed(const Duration(milliseconds: 100), tryNavigate);
      } else {
        print("Erreur: navigatorKey n'est toujours pas disponible après 5 secondes.");
      }
    }

    tryNavigate();
  }
}
