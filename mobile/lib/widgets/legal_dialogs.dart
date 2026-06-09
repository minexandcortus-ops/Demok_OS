import 'package:flutter/material.dart';

class LegalDialogs {
  static void showCGU(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text(
            'Conditions Générales d\'Utilisation',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Démok - Version 1.1 - Juin 2026\n\n',
                  style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
                ),
                _buildSection('1. Objet et Indépendance', 
                  'Démok est une plateforme citoyenne d\'information et de débat. Elle est développée par une initiative indépendante et n\'est aucunement affiliée, approuvée ou liée au Gouvernement français, à l\'Assemblée nationale ou à toute institution publique.'),
                _buildSection('2. Sources et Données', 
                  'Les données législatives relatives aux textes de lois et amendements proviennent de l\'Open Data de l\'Assemblée nationale. Les données spécifiques aux députés (votes, statistiques parlementaires) ainsi que les résumés générés par IA sont fournis par le service tiers Clair (clair.vote). Bien que nous fassions de notre mieux pour assurer la fiabilité de ces informations, elles ont une valeur purement informative et ne remplacent pas les textes officiels consultables sur legifrance.gouv.fr.'),
                _buildSection('3. Nature des Votes et Sondages', 
                  'Les votes exprimés sur Démok sont CONSULTATIFS et n\'ont aucune valeur légale, électorale ou contraignante. Ils servent à mesurer l\'opinion citoyenne au sein de la communauté Démok.'),
                _buildSection('4. Règles de Participation et Débats', 
                  'La participation aux débats nécessite un engagement minimal (300 XP). L\'utilisateur s\'engage à :\n'
                  '• Respecter les autres citoyens et leurs opinions.\n'
                  '• Ne pas publier de contenus haineux, racistes, sexistes ou incitant à la violence.\n'
                  '• Tout manquement peut entraîner une suppression du contenu et un bannissement définitif du compte.'),
                _buildSection('5. Inscription et Accès', 
                  'L\'inscription est réservée aux personnes de 18 ans et plus. L\'utilisateur est responsable de la sécurité de son mot de passe et de son compte.'),
                _buildSection('6. Responsabilité', 
                  'Démok ne saurait être tenu pour responsable en cas d\'interruption du service, de perte de données ou d\'erreur dans le traitement des informations législatives externes.'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Fermer'),
            ),
          ],
        );
      },
    );
  }

  static void showPrivacyPolicy(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text(
            'Politique de Confidentialité',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Démok - Version 1.1 - Juin 2026\n\n',
                  style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
                ),
                _buildSection('1. Données Collectées (RGPD)', 
                  'Conformément au RGPD, nous limitons la collecte aux données strictement nécessaires :\n'
                  '• Pseudo (identifiant public)\n'
                  '• Année de naissance (vérification de la majorité)\n'
                  '• Code postal (affectation à votre circonscription et votre député)\n'
                  '• Email (sécurisation OTP, notifications et connexion)\n'
                  '• Votes, Opinions et XP (statistiques de participation).'),
                _buildSection('2. Confidentialité et Secret des Votes (Urne Anonyme)', 
                  'Le secret du vote est le pilier de Démok. Nous utilisons un système technique de "Double Registre" :\n'
                  '• Vos données d\'identité (pseudo, email) sont stockées séparément de vos choix de vote.\n'
                  '• Le lien entre vous et votre vote est protégé par une "Urne Anonyme" utilisant un hachage cryptographique (HMAC) sécurisé par une clé secrète serveur.\n'
                  '• Même en cas d\'accès non autorisé à notre base de données, il est mathématiquement impossible de relier rétrospectivement un choix de vote ("Pour", "Contre") à un utilisateur spécifique sans cette clé secrète.'),
                _buildSection('3. Finalités du Traitement', 
                  'Vos données servent uniquement à :\n'
                  '• Gérer votre compte et votre progression (XP).\n'
                  '• Afficher les tendances politiques globales.\n'
                  '• Vous permettre d\'interpeller votre député directement.'),
                _buildSection('4. Sécurité et Hébergement', 
                  'Vos données sont hébergées au sein de l\'Union Européenne (Scaleway / Firebase) et protégées par des protocoles de sécurité standards.'),
                _buildSection('5. Vos Droits d’Accès et d’Oubli', 
                  'Vous pouvez à tout moment :\n'
                  '• Modifier votre email ou circonscription dans le profil.\n'
                  '• Supprimer votre compte définitivement. Notez qu\'en cas de suppression, vos données identifiables (email, pseudo) sont effacées immédiatement. Vos votes passés seront conservés sous forme totalement anonyme pour l\'intégrité des statistiques historiques.'),
                _buildSection('6. Contact DPO', 
                  'Pour toute question relative à vos données : contact@demok.fr'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Fermer'),
            ),
          ],
        );
      },
    );
  }

  static Widget _buildSection(String title, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 4),
        Text(content),
        const SizedBox(height: 16),
      ],
    );
  }
}
