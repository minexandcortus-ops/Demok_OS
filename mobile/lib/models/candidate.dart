import '../config/env.dart';

class Candidate {
  final String id;
  final String name;
  final String party;
  final String? photoUrl;
  final String? partyLogoUrl;
  final String? description;
  final String? programUrl;

  Candidate({
    required this.id,
    required this.name,
    required this.party,
    this.photoUrl,
    this.partyLogoUrl,
    this.description,
    this.programUrl,
  });

  factory Candidate.fromJson(Map<String, dynamic> json) {
    return Candidate(
      id: json['id'],
      name: json['name'],
      party: json['party'],
      photoUrl: json['photoUrl'],
      partyLogoUrl: json['partyLogoUrl'],
      description: json['description'],
      programUrl: json['programUrl'],
    );
  }

  bool get isNetworkLogo => partyLogoUrl != null && (partyLogoUrl!.startsWith('http') || partyLogoUrl!.startsWith('/api'));

  String? get logoPath {
    if (isNetworkLogo) {
      if (partyLogoUrl!.startsWith('/api')) {
        final base = Env.apiUrl.replaceAll(RegExp(r'/api$'), '');
        return base + partyLogoUrl!;
      }
      return partyLogoUrl;
    }

    final Map<String, String> partyLogos = {
      "L'Après / Divers Gauche": 'assets/images/logos_partis/l_apres.svg',
      "Parti Socialiste": 'assets/images/logos_partis/Parti_Socialiste_logo.png',
      "Nouvelle Énergie / LR": 'assets/images/logos_partis/nouvelle_energie.svg',
      "Debout !": 'assets/images/logos_partis/debout.png',
      "Horizons": 'assets/images/logos_partis/horizons.svg',
      "Les Écologistes": 'assets/images/logos_partis/les_ecologistes.svg',
      "Les Républicains": 'assets/images/logos_partis/les_republicains.svg',
      "Rassemblement National": 'assets/images/logos_partis/Rassemblement_National_logo.svg',
      "La France Insoumise": 'assets/images/logos_partis/La_France_Insoumise_logo.png',
      "Parti Communiste Français": 'assets/images/logos_partis/parti_communiste_francais.png',
      "La France Humaniste": 'assets/images/logos_partis/la_france_humaniste.png',
      "Lutte Ouvrière": 'assets/images/logos_partis/Lutte_Ouvriere_logo.svg',
      "Place Publique": 'assets/images/logos_partis/Place_Publique_logo.png',
      "Renaissance": 'assets/images/logos_partis/Renaissance_logo.svg',
      "Debout la France": 'assets/images/logos_partis/Debout_la_France_logo.png',
      "Reconquête !": 'assets/images/logos_partis/Reconquete_logo.svg',
      "Nouveau Parti Anticapitaliste": 'assets/images/logos_partis/Nouveau_Parti_Anticapitaliste_logo.png',
      "Révolution Permanente": 'assets/images/logos_partis/Revolution_Permanente_logo.svg',
      "Union populaire républicaine": 'assets/images/logos_partis/Union_Populaire_Republicaine_logo.jpg',
    };

    return partyLogos[party];
  }

  bool get isSvgLogo => logoPath?.endsWith('.svg') ?? false;

  String? get fullPhotoUrl {
    if (photoUrl == null) return null;
    if (photoUrl!.startsWith('http')) return photoUrl;
    if (photoUrl!.startsWith('/api')) {
      final base = Env.apiUrl.replaceAll(RegExp(r'/api$'), '');
      return base + photoUrl!;
    }
    return photoUrl;
  }
}
