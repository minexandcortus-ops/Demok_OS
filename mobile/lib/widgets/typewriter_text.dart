import 'package:flutter/material.dart';

class TypewriterText extends StatelessWidget {
  final String text;
  final TextStyle? style;
  final Duration speed;
  final VoidCallback? onEnd;

  const TypewriterText(
    this.text, {
    super.key,
    this.style,
    this.speed = const Duration(milliseconds: 30),
    this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: text.length),
      duration: speed * text.length,
      builder: (context, value, child) {
        return Text(
          text.substring(0, value),
          style: style,
        );
      },
      onEnd: onEnd,
    );
  }
}
