import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class XPProgressBar extends StatelessWidget {
  final int currentXP;
  final int currentLevelXP;
  final int? nextLevelXP;
  final double progressPercentage;

  const XPProgressBar({
    super.key,
    required this.currentXP,
    required this.currentLevelXP,
    this.nextLevelXP,
    required this.progressPercentage,
  });

  @override
  Widget build(BuildContext context) {
    final xpInLevel = currentXP - currentLevelXP;
    final xpNeeded = nextLevelXP != null ? nextLevelXP! - currentLevelXP : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // XP Text
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Expérience',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            if (nextLevelXP != null)
              Text(
                '$xpInLevel / $xpNeeded XP',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryBlue,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        
        // Progress bar
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: progressPercentage / 100,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primaryBlue),
            minHeight: 12,
          ),
        ),
        
        const SizedBox(height: 4),
        
        // Percentage
        Text(
          '${progressPercentage.toStringAsFixed(1)}% vers le prochain niveau',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}
