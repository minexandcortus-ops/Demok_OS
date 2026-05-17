import 'package:flutter/material.dart';

class ChatMessage {
  final String text;
  final bool isBot;
  final DateTime timestamp;
  final Widget? richContent; // Optional custom content for clickable links

  ChatMessage({
    required this.text,
    required this.isBot,
    DateTime? timestamp,
    this.richContent,
  }) : timestamp = timestamp ?? DateTime.now();
}

enum OnboardingStep {
  intro,
  welcome,
  pseudo,
  birthYear,
  postalCode,
  email,
  password,
  readyToSubmit,
  complete,
}
