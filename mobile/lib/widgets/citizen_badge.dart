import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class CitizenBadge extends StatelessWidget {
  final int level;
  final String badge;
  final double size;

  const CitizenBadge({
    super.key,
    required this.level,
    required this.badge,
    this.size = 60,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Circle background
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [
                AppColors.primaryBlue.withValues(alpha: 0.2),
                AppColors.primaryBlue.withValues(alpha: 0.1),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: AppColors.primaryBlue,
              width: 2,
            ),
          ),
        ),
        
        
        // Badge emoji (centered)
        Text(
          badge,
          style: TextStyle(fontSize: size * 0.5),
        ),
      ],
    );
  }
}
