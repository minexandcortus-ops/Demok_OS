import 'package:flutter/material.dart';
import '../models/citizen_level.dart';
import '../models/citizen_progress.dart';
import '../services/gamification_service.dart';
import '../services/user_session.dart';
import '../widgets/citizen_badge.dart';
import '../widgets/xp_progress_bar.dart';
import '../theme/app_colors.dart';

class GamificationScreen extends StatefulWidget {
  const GamificationScreen({super.key});

  @override
  State<GamificationScreen> createState() => _GamificationScreenState();
}

class _GamificationScreenState extends State<GamificationScreen> {
  final GamificationService _gamificationService = GamificationService();
  CitizenProgress? _progress;
  List<CitizenLevel> _allLevels = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    final progress = await _gamificationService.getProgress();
    final levels = await _gamificationService.getAllLevels();

    setState(() {
      _progress = progress;
      _allLevels = levels;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
        title: const Text(
          'Ma Progression',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _progress == null
              ? const Center(child: Text('Erreur de chargement'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header: Current Badge
                      Center(
                        child: Column(
                          children: [
                            CitizenBadge(
                              level: _progress!.currentLevel,
                              badge: _progress!.badge,
                              size: 100,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _progress!.levelName,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_progress!.currentXP} XP',
                              style: TextStyle(
                                fontSize: 18,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 32),

                      // XP Progress
                      XPProgressBar(
                        currentXP: _progress!.currentXP,
                        currentLevelXP: _progress!.currentLevelXP,
                        nextLevelXP: _progress!.nextLevelXP,
                        progressPercentage: _progress!.progressPercentage,
                      ),

                      const SizedBox(height: 32),

                      // Stats Cards
                      Row(
                        children: [
                          Expanded(
                            child: _buildStatCard(
                              '${_progress!.totalVotes}',
                              'Votes',
                              Icons.how_to_vote,
                              AppColors.votePour,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildStatCard(
                              '${_progress!.consecutiveDays}',
                              'Jours consécutifs',
                              Icons.local_fire_department,
                              Colors.orange,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 32),

                      // All Levels
                      const Text(
                        'Tous les niveaux',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),

                      ..._allLevels.map((level) {
                        final bool unlocked = level.level <= _progress!.currentLevel;
                        return _buildLevelTile(level, unlocked);
                      }),
                    ],
                  ),
                ),
    );
  }

  Widget _buildStatCard(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLevelTile(CitizenLevel level, bool unlocked) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: unlocked ? Colors.white : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: unlocked ? AppColors.primaryBlue : Colors.grey[300]!,
          width: 2,
        ),
      ),
      child: Row(
        children: [
          // Badge
          Text(
            level.badge,
            style: TextStyle(
              fontSize: 40,
              color: unlocked ? null : Colors.grey,
            ),
          ),
          const SizedBox(width: 16),
          
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  level.name,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: unlocked ? Colors.black : Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Niveau ${level.level} • ${level.xpRequired} XP',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          
          // Lock/Unlock icon
          unlocked
              ? Icon(Icons.check_circle, color: AppColors.primaryBlue, size: 28)
              : Icon(Icons.lock, color: Colors.grey[400], size: 28),
        ],
      ),
    );
  }
}
