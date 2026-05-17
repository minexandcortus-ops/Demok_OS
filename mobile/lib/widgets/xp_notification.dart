import 'package:flutter/material.dart';

/// Widget pour afficher une notification de gain d'XP avec animation
/// Affiche le montant d'XP et la raison (ex: "+10XP - A voté")
class XpNotification extends StatefulWidget {
  final int amount;
  final String reason;
  final VoidCallback onComplete;

  const XpNotification({
    Key? key,
    required this.amount,
    required this.reason,
    required this.onComplete,
  }) : super(key: key);

  @override
  State<XpNotification> createState() => _XpNotificationState();
}

class _XpNotificationState extends State<XpNotification>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _slideAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 3000),
      vsync: this,
    );

    // Animation de montée (de bottom=50 à bottom=150)
    _slideAnimation = Tween<double>(
      begin: 0.0,
      end: 100.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    // Animation de fondu
    _fadeAnimation = TweenSequence<double>([
      // Fade in rapide (0-20%)
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 20,
      ),
      // Reste visible (20-70%)
      TweenSequenceItem(
        tween: ConstantTween<double>(1.0),
        weight: 50,
      ),
      // Fade out (70-100%)
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
    ]).animate(_controller);

    _controller.forward().then((_) {
      widget.onComplete();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Positioned(
          bottom: 50 + _slideAnimation.value,
          left: 0,
          right: 0,
          child: Opacity(
            opacity: _fadeAnimation.value,
            child: child!,
          ),
        );
      },
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '+${widget.amount}XP',
              style: const TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Color(0xFF4CAF50), // Vert
                decoration: TextDecoration.none,
                shadows: [
                  Shadow(
                    color: Colors.black26,
                    offset: Offset(0, 2),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.reason,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.black87,
                fontWeight: FontWeight.w500,
                decoration: TextDecoration.none,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
