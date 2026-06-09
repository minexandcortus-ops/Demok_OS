import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_client.dart';

class DesktopWrapper extends StatefulWidget {
  final Widget child;

  const DesktopWrapper({super.key, required this.child});

  @override
  State<DesktopWrapper> createState() => _DesktopWrapperState();
}

class _DesktopWrapperState extends State<DesktopWrapper> {
  bool _isDialogOpen = false;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Mode Mobile pur (en dessous de 800px)
        if (constraints.maxWidth < 800) {
          return widget.child;
        }

        // Mode Desktop (Tablette paysage ou PC)
        return Scaffold(
          body: Container(
            // Un dégradé très subtil et institutionnel en arrière-plan
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFF8FAFC), // Blanc cassé/Gris très clair
                  Color(0xFFE2E8F0), // Gris légèrement plus sombre (slate)
                ],
              ),
            ),
            child: Row(
              children: [
                // Partie Gauche : Présentation (Vitrine)
                // On n'affiche le texte que s'il y a VRAIMENT de la place (> 1000px)
                if (constraints.maxWidth > 1000)
                  Expanded(
                    flex: 5,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 80.0, vertical: 60.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Titre accrocheur
                          const Text(
                            "Une application citoyenne\nqui rend la politique\nsimple et accessible.",
                            style: TextStyle(
                              fontSize: 48,
                              fontWeight: FontWeight.w900,
                              height: 1.1,
                              color: Color(0xFF1E293B), // Bleu nuit très foncé
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Paragraphe descriptif
                          const Text(
                            "Suivez l'activité de vos députés, comprenez les lois en cours et participez au débat démocratique en temps réel depuis votre ordinateur ou votre smartphone.",
                            style: TextStyle(
                              fontSize: 18,
                              height: 1.5,
                              color: Color(0xFF475569), // Gris ardoise
                            ),
                          ),
                          const SizedBox(height: 40),
                          // Petits "Plus" (Badges ou texte)
                          Wrap(
                            spacing: 16,
                            runSpacing: 16,
                            children: [
                              _buildFeatureBadge(Icons.verified, "Données officielles (AN)"),
                              _buildFeatureBadge(Icons.how_to_vote, "Votes en temps réel"),
                              _buildFeatureBadge(Icons.people, "Activité des députés"),
                              _buildFeatureBadge(Icons.poll, "Sondages d'actualité"),
                            ],
                          ),
                          const SizedBox(height: 60),
                          // Bouton de transparence et sécurité
                          OutlinedButton.icon(
                            onPressed: _toggleTransparencyDialog,
                            icon: const Icon(Icons.info_outline, size: 18),
                            label: const Text("Sécurité & Source de données"),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF475569), // Gris ardoise
                              side: const BorderSide(color: Color(0xFFCBD5E1)), // Bordure subtile
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Partie Droite : L'application Mobile Démok
                Expanded(
                  flex: constraints.maxWidth > 1000 ? 5 : 10,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40.0),
                      child: Container(
                        width: 420, // Largeur idéale d'un smartphone récent
                        // Hauteur contrainte pour laisser de la marge en haut et en bas si possible
                        height: constraints.maxHeight > 900 ? 850 : constraints.maxHeight - 80,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(40), // Bords très arrondis style iPhone
                          border: Border.all(color: Colors.white.withOpacity(0.5), width: 8), // "Coque" blanche épaisse
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF007AFF).withOpacity(0.15), // Ombre portée légèrement bleue
                              blurRadius: 40,
                              spreadRadius: 5,
                              offset: const Offset(0, 20),
                            ),
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05), // Ombre plus dure pour le contour
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(32), // Bords arrondis de l'écran (à l'intérieur de la coque)
                          child: widget.child, // L'application Démok 100% fonctionnelle
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // Petit widget Helper pour générer les badges
  Widget _buildFeatureBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: const Color(0xFF007AFF), size: 20),
          const SizedBox(width: 8),
          Text(
            text,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: Color(0xFF1E293B),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  // Boîte de dialogue pour la transparence (avec effet "Toggle")
  void _toggleTransparencyDialog() {
    final navContext = navigatorKey.currentContext;
    if (navContext == null) return;

    if (_isDialogOpen) {
      Navigator.pop(navContext);
    } else {
      setState(() {
        _isDialogOpen = true;
      });
      showDialog(
        context: navContext,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Row(
            children: [
              Icon(Icons.policy, color: Color(0xFF007AFF)),
              SizedBox(width: 10),
              Expanded(
                child: Text("Sécurité & Source de données", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
              ),
            ],
          ),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDialogItem(Icons.dns, "Hébergement Local", description: "Serveurs souverains hébergés en France (Data Center de Paris)."),
                const SizedBox(height: 20),
                _buildDialogItem(Icons.auto_awesome, "Intelligence Artificielle", description: "Modèles européens (Mistral AI) utilisés pour générer des résumés neutres des textes de loi."),
                const SizedBox(height: 20),
                _buildDialogItem(
                  Icons.account_balance,
                  "Sources des données",
                  contentWidget: RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 14, color: Color(0xFF475569), height: 1.4),
                      children: [
                        const TextSpan(text: "Contenus issus de données ouvertes et officielles : "),
                        TextSpan(
                          text: "CLAIR",
                          style: const TextStyle(color: Color(0xFF007AFF), fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                          recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('https://clair.vote/')),
                        ),
                        const TextSpan(text: " et "),
                        TextSpan(
                          text: "Assemblée Nationale",
                          style: const TextStyle(color: Color(0xFF007AFF), fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                          recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('https://data.assemblee-nationale.fr/')),
                        ),
                        const TextSpan(text: "."),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Mention légale / Sécurité intégrée à la modale
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.lock_outline, color: Color(0xFF94A3B8), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Vos votes et données personnelles sont sécurisés et chiffrés. Démok s'engage formellement à ne jamais les exploiter ni les revendre à des tiers.",
                        style: TextStyle(
                          fontSize: 13,
                          fontStyle: FontStyle.italic,
                          height: 1.4,
                          color: const Color(0xFF94A3B8), // Gris discret
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Fermer", style: TextStyle(color: Color(0xFF007AFF), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ).then((_) {
        // Appelé quand le dialogue est fermé (par le bouton, un clic en dehors, ou le toggle)
        if (mounted) {
          setState(() {
            _isDialogOpen = false;
          });
        }
      });
    }
  }

  Widget _buildDialogItem(IconData icon, String title, {String? description, Widget? contentWidget}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xFF475569), size: 24),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B))),
              const SizedBox(height: 4),
              if (description != null)
                Text(description, style: const TextStyle(fontSize: 14, color: Color(0xFF475569), height: 1.4)),
              if (contentWidget != null)
                contentWidget,
            ],
          ),
        ),
      ],
    );
  }
}
