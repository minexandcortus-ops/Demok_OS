import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/user_session.dart';
import '../theme/app_colors.dart';
import '../widgets/citizen_badge.dart';
import '../services/gamification_service.dart';
import '../models/citizen_progress.dart';
import 'gamification_screen.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_client.dart';
import 'home_screen.dart';
import '../widgets/legal_dialogs.dart';
import '../services/push_notification_service.dart';

class ProfileScreen extends StatelessWidget {
  final bool autoExpandNotifications;
  const ProfileScreen({super.key, this.autoExpandNotifications = false});

  @override
  Widget build(BuildContext context) {
    return _ProfileScreenContent(autoExpandNotifications: autoExpandNotifications);
  }
}

/// Écran de profil utilisateur affichant les informations personnelles, 
/// la circonscription, le député associé et la progression (XP/Niveau).
class _ProfileScreenContent extends StatefulWidget {
  final bool autoExpandNotifications;
  const _ProfileScreenContent({super.key, this.autoExpandNotifications = false});

  @override
  State<_ProfileScreenContent> createState() => _ProfileScreenContentState();
}

class _ProfileScreenContentState extends State<_ProfileScreenContent> {
  Map<String, dynamic>? _profileData;
  bool _isLoading = true;
  CitizenProgress? _gamificationProgress;
  final GamificationService _gamificationService = GamificationService();
  bool _notificationsAuthorized = false;
  bool _isStreetMode = false;

  final GlobalKey _xpKey = GlobalKey();
  final GlobalKey _rankKey = GlobalKey();
  final GlobalKey _deputyKey = GlobalKey();
  final GlobalKey _emailKey = GlobalKey();
  final GlobalKey _deputyEmailKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _isStreetMode = UserSession().isStreetModePreferred;
    _fetchProfile();
    _fetchGamificationProgress();
    _checkNotificationStatus();
  }

  Future<void> _fetchGamificationProgress() async {
    final progress = await _gamificationService.getProgress();
    setState(() {
      _gamificationProgress = progress;
    });
  }

  Future<void> _checkNotificationStatus() async {
    // Only works on mobile or https web. We wrap it to avoid crash on dev HTTP web
    try {
      final settings = await FirebaseMessaging.instance.getNotificationSettings();
      if (settings.authorizationStatus == AuthorizationStatus.authorized || 
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        if (mounted) setState(() => _notificationsAuthorized = true);
      }
    } catch (e) {
      debugPrint("Could not check notification status: $e");
    }
  }



// ...

  Future<void> _fetchProfile() async {
    try {
      final userId = UserSession().userId;
      
      if (userId == null) {
        // Not logged in
        setState(() => _isLoading = false);
        return;
      }
      
      final response = await ApiClient.get(
        '/users/profile',
      );

      if (response.statusCode == 200) {
        setState(() {
          _profileData = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        // Handle error
        setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Debug Erreur: $e')),
        );
      }
    }
  }

  Future<void> _showLevelsDialog() async {
    // Fetch all levels from backend
    final levels = await _gamificationService.getAllLevels();
    
    if (!mounted) return;
    
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Engagement citoyen',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: levels.length,
              itemBuilder: (context, index) {
                final level = levels[index];
                final isCurrentLevel = _gamificationProgress?.currentLevel == level.level;
                
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isCurrentLevel 
                        ? AppColors.primaryBlue.withValues(alpha: 0.1) 
                        : Colors.grey[50],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isCurrentLevel 
                          ? AppColors.primaryBlue 
                          : Colors.grey[200]!,
                      width: isCurrentLevel ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        level.badge,
                        style: const TextStyle(fontSize: 32),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              level.name,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: isCurrentLevel ? AppColors.primaryBlue : Colors.black,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${level.xpRequired} XP requis',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isCurrentLevel)
                        const Icon(
                          Icons.check_circle,
                          color: AppColors.primaryBlue,
                        ),
                    ],
                  ),
                );
              },
            ),
          ),

        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_profileData == null) {
      // Check if it's because of missing session
      if (UserSession().userId == null) {
        return Scaffold(
          appBar: AppBar(title: const Text('Mon profil')),
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  "Vous n'êtes pas connecté",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text("Veuillez vous reconnecter pour voir votre profil."),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    // Navigate to Login
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  child: const Text("Se connecter"),
                ),
              ],
            ),
          ),
        );
      }
      
      return Scaffold(
        appBar: AppBar(title: const Text('Mon profil')),
        body: Center(
          child: Column(
             mainAxisAlignment: MainAxisAlignment.center,
             children: [
               const Icon(Icons.error_outline, size: 48, color: Colors.red),
               const SizedBox(height: 16),
               const Text("Impossible de charger le profil"),
               const SizedBox(height: 8),
               ElevatedButton(
                 onPressed: _fetchProfile,
                 child: const Text("Réessayer"),
               ),
             ],
          ),
        ),
      );
    }

    final consti = _profileData!['constituency'];

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        title: const Text(
          'Mon profil',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 20,
            letterSpacing: -0.4,
          ),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        toolbarHeight: 64,
        leadingWidth: 56,
        leading: Center(
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.pillBackground,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
            ),
            child: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, size: 20, color: AppColors.textPrimary),
              onPressed: () => Navigator.pop(context),
              padding: EdgeInsets.zero,
              splashRadius: 20,
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Column(
          children: [
            // Avatar / Badge
            GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const GamificationScreen(),
                    ),
                  );
                },
                child: _gamificationProgress != null
                    ? CitizenBadge(
                        level: _gamificationProgress!.currentLevel,
                        badge: _gamificationProgress!.badge,
                        size: 100,
                      )
                    : Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: AppColors.primaryBlue.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.person_rounded,
                          size: 50,
                          color: AppColors.primaryBlue,
                        ),
                      ),
              ),
            const SizedBox(height: 16),
            
            // Pseudo
            Text(
              _profileData!['pseudo'] ?? 'Citoyen',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            
            
            // XP with info button
            if (_gamificationProgress != null)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${_gamificationProgress!.currentXP} XP',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _showLevelsDialog,
                    child: Icon(
                      Icons.info_outline,
                      size: 18,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ],
              )
            else
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${_profileData!['xp'] ?? 0} XP',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _showLevelsDialog,
                    child: Icon(
                      Icons.info_outline,
                      size: 18,
                      color: AppColors.primaryBlue,
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 28),

            // User Info Card Container
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
                boxShadow: AppColors.cardShadow,
              ),
              child: Column(
                children: [
                  _buildInfoTile(Icons.cake_outlined, 'Année de naissance', _profileData!['birthYear']?.toString() ?? 'Non renseignée'),
                  const Divider(height: 1, color: AppColors.cardBorderSubtle),
                  if (consti != null) ...[
                    _buildInfoTile(
                      Icons.location_on_outlined, 
                      'Circonscription', 
                      '${consti['name']}',
                      onEdit: _showEditConstituencyDialog,
                    ),
                    const Divider(height: 1, color: AppColors.cardBorderSubtle),
                    _buildDeputyInfoTile('${consti['deputy']}', consti['deputyEmail'] ?? ''),
                  ] else ...[
                    _buildInfoTile(
                      Icons.location_on_outlined, 
                      'Circonscription', 
                      'Non assignée',
                      onEdit: _showEditConstituencyDialog,
                    ),
                  ],
                  const Divider(height: 1, color: AppColors.cardBorderSubtle),
                  _buildInfoTile(
                    Icons.mail_outline_rounded, 
                    'Email', 
                    _profileData!['email'] ?? 'Email masqué',
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),

            // Préférence du ton des résumés (Classique vs Mode Rue)
            _buildSummaryToneSection(),

            const SizedBox(height: 20),

            // Notification Preferences
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
                boxShadow: AppColors.cardShadow,
              ),
              child: Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                  iconColor: AppColors.primaryBlue,
                  collapsedIconColor: AppColors.primaryBlue,
                  initiallyExpanded: widget.autoExpandNotifications,
                  title: Row(
                    children: [
                      const Icon(Icons.notifications_outlined, size: 20, color: AppColors.primaryBlue),
                      const SizedBox(width: 8),
                      Text(
                        'Notifications Push',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primaryBlue,
                        ),
                      ),
                    ],
                  ),
                  childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _notificationsAuthorized ? null : () async {
                            await PushNotificationService().init();
                            await _checkNotificationStatus();
                            if (context.mounted && !_notificationsAuthorized) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Demande d\'autorisation envoyée. (Si rien ne s\'affiche, veuillez vérifier les réglages iOS/Android).'),
                                ),
                              );
                            }
                          },
                          icon: Icon(_notificationsAuthorized ? Icons.check_circle_rounded : Icons.notifications_active_rounded),
                          label: Text(_notificationsAuthorized ? 'Notifications activées' : 'Activer sur cet appareil'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _notificationsAuthorized ? Colors.green : AppColors.primaryBlue,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: Colors.green.withValues(alpha: 0.8),
                            disabledForegroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Résultats des lois votées', style: TextStyle(fontSize: 14)),
                      value: _profileData!['notifyLawResults'] ?? true,
                      onChanged: (val) => _updateProfile({'notifyLawResults': val}, popOnSuccess: false),
                      activeColor: AppColors.primaryBlue,
                    ),
                    Divider(height: 1, color: Colors.grey[100]),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Lois votées dans 1 jour', style: TextStyle(fontSize: 14)),
                      value: _profileData!['notifyUpcomingLaws'] ?? true,
                      onChanged: (val) => _updateProfile({'notifyUpcomingLaws': val}, popOnSuccess: false),
                      activeColor: AppColors.primaryBlue,
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Stats (Votes and Status)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
                boxShadow: AppColors.cardShadow,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem('Votes', '${_profileData!['voteCount'] ?? 0}'),
                  Container(width: 1, height: 32, color: AppColors.cardBorderSubtle),
                  _buildStatItem(
                      'Statut',
                      _gamificationProgress?.levelName ?? 'Observateur',
                    ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Legal Section
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
                boxShadow: AppColors.cardShadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Informations légales',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.description_outlined, size: 20, color: AppColors.textSecondary),
                    title: const Text('Conditions Générales d\'Utilisation', style: TextStyle(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textSecondary),
                    onTap: () => LegalDialogs.showCGU(context),
                  ),
                  const Divider(height: 1, color: AppColors.cardBorderSubtle),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.security_outlined, size: 20, color: AppColors.textSecondary),
                    title: const Text('Politique de confidentialité', style: TextStyle(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textSecondary),
                    onTap: () => LegalDialogs.showPrivacyPolicy(context),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await ApiClient.logout();
                  if (context.mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (context) => const HomeScreen()),
                      (route) => false,
                    );
                  }
                },
                icon: const Icon(Icons.logout_rounded, color: AppColors.voteContre, size: 20),
                label: const Text(
                  'Déconnexion',
                  style: TextStyle(color: AppColors.voteContre, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.cardBorder),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: () => _confirmDeleteAccount(),
                icon: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent, size: 20),
                label: const Text(
                  'Supprimer mon compte définitivement',
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryToneSection() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorderSubtle, width: 1),
        boxShadow: AppColors.cardShadow,
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          shape: const Border(),
          collapsedShape: const Border(),
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          iconColor: AppColors.primaryBlue,
          collapsedIconColor: AppColors.primaryBlue,
          initiallyExpanded: false,
          title: Row(
            children: [
              Icon(
                _isStreetMode ? Icons.local_fire_department_rounded : Icons.record_voice_over_rounded,
                color: _isStreetMode ? const Color(0xFFEA580C) : AppColors.primaryBlue,
                size: 20,
              ),
              const SizedBox(width: 8),
              const Text(
                'Ton des résumés',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primaryBlue,
                ),
              ),
            ],
          ),
          childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Choisissez le style de vulgarisation affiché par défaut sur les lois.',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildToneChoiceCard(
                    title: '🏛️ Classique',
                    subtitle: 'Neutre et synthétique',
                    isSelected: !_isStreetMode,
                    activeColor: AppColors.primaryBlue,
                    onTap: () async {
                      await UserSession().setStreetModePreferred(false);
                      if (mounted) setState(() => _isStreetMode = false);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildToneChoiceCard(
                    title: '🔥 Mode Rue',
                    subtitle: 'Argot urbain percutant',
                    isSelected: _isStreetMode,
                    activeColor: const Color(0xFFEA580C),
                    onTap: () async {
                      await UserSession().setStreetModePreferred(true);
                      if (mounted) setState(() => _isStreetMode = true);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToneChoiceCard({
    required String title,
    required String subtitle,
    required bool isSelected,
    required Color activeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.08) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? activeColor : AppColors.cardBorder,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isSelected ? activeColor : Colors.black87,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: isSelected ? activeColor.withValues(alpha: 0.9) : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String title, String value, {VoidCallback? onEdit}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primaryBlue.withValues(alpha: 0.8), size: 22),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          if (onEdit != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.primaryBlue),
              onPressed: onEdit,
              constraints: const BoxConstraints(),
              padding: EdgeInsets.zero,
            ),
        ],
      ),
    );
  }

  Future<void> _updateProfile(Map<String, dynamic> data, {bool popOnSuccess = true}) async {
    try {
      final userId = UserSession().userId;
      if (userId == null) return;

      final response = await ApiClient.patch(
        '/users/profile',
        body: data,
      );

      if (response.statusCode == 200) {
        final newProfileData = jsonDecode(response.body);

        setState(() {
          _profileData = newProfileData;
        });
        if (mounted) {
          if (popOnSuccess) {
            Navigator.of(context).pop(); // Close dialog
          }
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profil mis à jour avec succès')),
          );
        }
      } else {
        throw Exception('Failed to update profile');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('Erreur: Impossible de mettre à jour le profil')),
        );
      }
    }
  }



  void _showEditConstituencyDialog() {
    final constituencies = _profileData?['availableConstituencies'] as List?;
    
    if (constituencies != null && constituencies.isNotEmpty) {
      _showConstituencySelectionDialog();
    } else {
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           const SnackBar(
             content: Text('Votre code postal enregistré ne correspond qu\'à une seule circonscription.'),
             duration: Duration(seconds: 3),
           ),
         );
      }
    }
  }

  void _confirmDeleteAccount() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Suppression du compte', style: TextStyle(color: Colors.red)),
        content: const Text(
          'Attention, cette action est irréversible !\n\n'
          'Toutes vos données (profil, liste des lois votées, favoris, historique de connexion) seront définitivement effacées de nos serveurs.\n\n'
          'Confirmez-vous ?'
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(), // Close dialog
            child: const Text('Annuler', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              _executeAccountDeletion();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Oui, supprimer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _executeAccountDeletion() async {
    try {
      final userId = UserSession().userId;
      if (userId == null) return;

      // Show a loading indicator
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final response = await ApiClient.delete(
        '/users/profile',
      );

      if (mounted) {
        Navigator.of(context).pop(); // Remove loading indicator
      }

      if (response.statusCode == 200) {
        await UserSession().clearSession();
        if (mounted) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (context) => const HomeScreen()),
            (route) => false,
          );
          ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(content: Text('Votre compte a été supprimé définitivement.')),
          );
        }
      } else {
        throw Exception('Echec de la suppression');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
           const SnackBar(content: Text('Erreur: Impossible de supprimer le compte')),
        );
      }
    }
  }

  void _showConstituencySelectionDialog() {
    final constituencies = _profileData!['availableConstituencies'] as List;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Modifier ma circonscription'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Voici les circonscriptions rattachées au code postal renseigné lors de votre inscription :'),
              const SizedBox(height: 16),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: constituencies.length,
                  itemBuilder: (context, index) {
                    final c = constituencies[index];
                    return ListTile(
                      title: Text(c['name']),
                      subtitle: Text('Député(e): ${c['deputyName']}'),
                      onTap: () {
                        Navigator.of(context).pop(); // Close dialog immediately
                        _updateProfile({'constituencyCode': c['id']}, popOnSuccess: false);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: const Text('Annuler'),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.primaryBlue,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildDeputyInfoTile(String deputyName, String? deputyEmail) {
    String finalEmail = deputyEmail ?? '';
    if (finalEmail.isEmpty && deputyName.isNotEmpty) {
      final sanitized = deputyName.toLowerCase()
         .replaceAll('é', 'e').replaceAll('è', 'e').replaceAll('ê', 'e').replaceAll('ë', 'e')
         .replaceAll('à', 'a').replaceAll('â', 'a')
         .replaceAll('î', 'i').replaceAll('ï', 'i')
         .replaceAll('ô', 'o').replaceAll('ö', 'o')
         .replaceAll('ù', 'u').replaceAll('û', 'u')
         .replaceAll('ç', 'c')
         .replaceAll(RegExp(r'[^a-z0-9\-]'), '.'); 
      final cleanEmail = sanitized.replaceAll(RegExp(r'\.+'), '.').replaceAll(RegExp(r'^\.|\.$'), '');
      finalEmail = '$cleanEmail@assemblee-nationale.fr';
    }

    return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Icon(Icons.person_pin_circle_outlined, color: AppColors.primaryBlue.withValues(alpha: 0.8), size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Député',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    deputyName,
                    style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            if (finalEmail.isNotEmpty)
              IconButton(
                  icon: const Icon(Icons.mail_outline_rounded, color: AppColors.primaryBlue, size: 20),
                  onPressed: () => _sendEmailToDeputy(finalEmail),
                  tooltip: 'Envoyer un email au député',
                ),
          ],
        ),
      );
  }

  Future<void> _sendEmailToDeputy(String email) async {
    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: email,
      query: 'subject=Contact depuis Démok',
    );

    if (await canLaunchUrl(emailUri)) {
      await launchUrl(emailUri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impossible d\'ouvrir l\'application email'),
          ),
        );
      }
    }
  }
}
