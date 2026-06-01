import 'package:flutter/material.dart';
import 'dart:async';
import '../services/user_session.dart';
import '../theme/app_colors.dart';

/// Bannière d'installation PWA pour iOS.
/// Apple ne permettant pas le prompt natif, ce widget affiche un guide visuel
/// qui explique à l'utilisateur comment ajouter l'app à son écran d'accueil
/// via le bouton Partager de Safari.
class IosInstallBanner extends StatefulWidget {
  final VoidCallback onDismiss;

  const IosInstallBanner({super.key, required this.onDismiss});

  @override
  State<IosInstallBanner> createState() => _IosInstallBannerState();
}

class _IosInstallBannerState extends State<IosInstallBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _arrowController;
  late Animation<double> _arrowAnimation;

  @override
  void initState() {
    super.initState();
    _arrowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _arrowAnimation = Tween<double>(begin: 0, end: 6).animate(
      CurvedAnimation(parent: _arrowController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _arrowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryBlue.withValues(alpha: 0.18),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(
          color: AppColors.primaryBlue.withValues(alpha: 0.2),
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ---- En-tête ----
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Icône app
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primaryBlue.withValues(alpha: 0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(4.0),
                    child: Image.asset(
                      'assets/images/logo_demok_vf.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Titre + subtitle
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Installez Démok',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E293B),
                          letterSpacing: -0.3,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Accédez à l\'app comme sur votre téléphone',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                // Bouton fermer
                GestureDetector(
                  onTap: () async {
                    await UserSession().setPwaBannerSoftDismissed();
                    widget.onDismiss();
                  },
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // ---- Séparateur ----
          Container(
            height: 1,
            color: AppColors.primaryBlue.withValues(alpha: 0.08),
          ),

          // ---- Instructions ----
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              children: [
                // Étape 1
                _buildStep(
                  number: '1',
                  icon: Icons.more_horiz,
                  iconColor: AppColors.primaryBlue,
                  text: 'Appuyez sur le menu',
                  highlight: '"..."',
                  highlightColor: AppColors.primaryBlue,
                  extra: ' en bas du navigateur',
                ),
                const SizedBox(height: 10),
                // Étape 2
                _buildStep(
                  number: '2',
                  icon: Icons.ios_share,
                  iconColor: AppColors.primaryBlue,
                  text: 'Appuyez sur le bouton',
                  highlight: 'Partager',
                  highlightColor: AppColors.primaryBlue,
                  extra: '',
                ),
                const SizedBox(height: 10),
                // Étape 3
                _buildStep(
                  number: '3',
                  icon: Icons.add_box_outlined,
                  iconColor: AppColors.primaryBlue,
                  text: 'Sélectionnez',
                  highlight: '"Sur l\'écran d\'accueil"',
                  highlightColor: AppColors.primaryBlue,
                  extra: '',
                ),
              ],
            ),
          ),

          // ---- Bouton "Pas maintenant" ----
          GestureDetector(
            onTap: () async {
              await UserSession().setPwaBannerHardDismissed();
              widget.onDismiss();
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
                border: Border(
                  top: BorderSide(
                    color: AppColors.primaryBlue.withValues(alpha: 0.08),
                  ),
                ),
              ),
              child: const Text(
                'Pas maintenant',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep({
    required String number,
    required IconData icon,
    required Color iconColor,
    required String text,
    required String highlight,
    required Color highlightColor,
    required String extra,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Numéro d'étape
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: AppColors.primaryBlue,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        // Icône
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 8),
        // Texte avec highlight
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF334155),
                height: 1.3,
              ),
              children: [
                TextSpan(text: text),
                TextSpan(text: ' '),
                TextSpan(
                  text: highlight,
                  style: TextStyle(
                    color: highlightColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                TextSpan(text: extra),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
