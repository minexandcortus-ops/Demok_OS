import 'package:flutter/material.dart';
import 'dart:convert';
import '../services/user_session.dart';
import '../theme/app_colors.dart';
import '../widgets/citizen_badge.dart';
import '../services/gamification_service.dart';
import '../models/citizen_progress.dart';
import 'gamification_screen.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_client.dart';
import 'package:showcaseview/showcaseview.dart';
import '../widgets/showcase_helper.dart';
import 'landing_screen.dart';
import '../widgets/legal_dialogs.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DemokShowcaseWidget(
      onFinish: () => UserSession().setProfileShowcaseSeen(),
      builder: (context) => const _ProfileScreenContent(),
    );
  }
}

/// Écran de profil utilisateur affichant les informations personnelles, 
/// la circonscription, le député associé et la progression (XP/Niveau).
class _ProfileScreenContent extends StatefulWidget {
  const _ProfileScreenContent({super.key});

  @override
  State<_ProfileScreenContent> createState() => _ProfileScreenContentState();
}

class _ProfileScreenContentState extends State<_ProfileScreenContent> {
  Map<String, dynamic>? _profileData;
  bool _isLoading = true;
  CitizenProgress? _gamificationProgress;
  final GamificationService _gamificationService = GamificationService();

  final GlobalKey _xpKey = GlobalKey();
  final GlobalKey _rankKey = GlobalKey();
  final GlobalKey _deputyKey = GlobalKey();
  final GlobalKey _emailKey = GlobalKey();
  final GlobalKey _deputyEmailKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _fetchProfile();
    _fetchGamificationProgress();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!UserSession().hasSeenProfileShowcase) {
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (mounted && _profileData != null) {
            ShowCaseWidget.of(context).startShowCase([
              _xpKey,
              _rankKey,
              _emailKey,
              if (_profileData!['constituency'] != null) _deputyKey,
              if (_profileData!['constituency']?['deputyEmail'] != null) _deputyEmailKey,
            ]);
          }
        });
      }
    });
  }

  Future<void> _fetchGamificationProgress() async {
    final progress = await _gamificationService.getProgress();
    setState(() {
      _gamificationProgress = progress;
    });
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Mon profil',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Avatar / Badge
            DemokShowcase(
              key: _xpKey,
              description: "Cumulez des points d'Engagement Citoyen (XP) en votant et en débattant. Touchez le badge pour voir votre progression détaillée.",
              child: GestureDetector(
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
                          Icons.person,
                          size: 50,
                          color: AppColors.primaryBlue,
                        ),
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
            const SizedBox(height: 32),

            // User Info Cards
            _buildInfoTile(Icons.cake, 'Année de naissance', _profileData!['birthYear']?.toString() ?? 'Non renseignée'),
            
            Divider(color: Colors.grey[200]),
            
            // Constituency Section (New)
            if (consti != null) ...[
               _buildInfoTile(
                 Icons.map, 
                 'Circonscription', 
                 '${consti['name']}',
                 onEdit: _showEditConstituencyDialog,
               ),
               _buildDeputyInfoTile('${consti['deputy']}', consti['deputyEmail'] ?? ''),
            ] else ...[
               _buildInfoTile(
                 Icons.map, 
                 'Circonscription', 
                 'Non assignée',
                 onEdit: _showEditConstituencyDialog,
               ),
            ],

            Divider(color: Colors.grey[200]),
            
            DemokShowcase(
              key: _emailKey,
              description: "Vos données sont chiffrées et protégées. Votre email n'est utilisé que pour les notifications importantes.",
              child: _buildInfoTile(
                Icons.email, 
                'Email', 
                _profileData!['email'] ?? 'Email masqué',
                onEdit: _showEditEmailDialog,
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Stats (Votes and Status)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem('Votes', '${_profileData!['voteCount'] ?? 0}'),
                  DemokShowcase(
                    key: _rankKey,
                    description: "Votre statut évolue avec votre implication. Devenez un acteur majeur de la vie politique, jusqu'au rang suprême !",
                    child: _buildStatItem(
                      'Statut',
                      _gamificationProgress?.levelName ?? 'Observateur',
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Logout Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await UserSession().clearSession();
                  if (context.mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (context) => const LandingScreen()),
                      (route) => false,
                    );
                  }
                },
                icon: Icon(Icons.logout, color: AppColors.voteContre),
                label: Text(
                  'Déconnexion',
                  style: TextStyle(color: AppColors.voteContre),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: AppColors.voteContre),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Legal Section
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Informations légales',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.description_outlined, size: 20),
                    title: const Text('Conditions Générales d\'Utilisation', style: TextStyle(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => LegalDialogs.showCGU(context),
                  ),
                  Divider(height: 1, color: Colors.grey[100]),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.security_outlined, size: 20),
                    title: const Text('Politique de confidentialité', style: TextStyle(fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => LegalDialogs.showPrivacyPolicy(context),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: () => _confirmDeleteAccount(),
                icon: const Icon(Icons.delete_forever, color: Colors.redAccent),
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

  Widget _buildInfoTile(IconData icon, String title, String value, {VoidCallback? onEdit}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey[600], size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          if (onEdit != null)
            IconButton(
              icon: Icon(Icons.edit, size: 18, color: Colors.grey[400]),
              onPressed: onEdit,
              constraints: const BoxConstraints(),
              padding: EdgeInsets.zero,
            ),
        ],
      ),
    );
  }

  Future<void> _updateProfile(Map<String, dynamic> data) async {
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
          Navigator.of(context).pop(); // Close dialog
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

  void _showEditEmailDialog() {
    final controller = TextEditingController(text: _profileData!['email'] == 'Email masqué' ? '' : _profileData!['email']);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Modifier l\'email'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            hintText: 'votre@email.com',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                _updateProfile({'email': controller.text.trim()});
              }
            },
            child: const Text('Sauvegarder'),
          ),
        ],
      ),
    );
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
        UserSession().clearSession();
        if (mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
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
                        _updateProfile({'constituencyId': c['id']});
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
    return DemokShowcase(
      key: _deputyKey,
      description: "Retrouvez ici votre député référent. Vous pouvez le contacter directement par email pour faire entendre votre voix.",
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Icon(Icons.person_pin_circle, color: Colors.grey[600], size: 22),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Député',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                  Text(
                    deputyName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (deputyEmail != null && deputyEmail.isNotEmpty)
              DemokShowcase(
                key: _deputyEmailKey,
                description: "Interpellez-le directement : un clic ici ouvre votre application mail pour lui écrire.",
                child: IconButton(
                  icon: const Icon(Icons.email, color: AppColors.primaryBlue),
                  onPressed: () => _sendEmailToDeputy(deputyEmail),
                  tooltip: 'Envoyer un email',
                ),
              )
            else
              Icon(Icons.edit, size: 18, color: Colors.grey[400]),
          ],
        ),
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
