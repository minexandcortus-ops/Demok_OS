class Candidate {
  final String id;
  final String name;
  final String party;
  final String? photoUrl;
  final String? description;

  Candidate({
    required this.id,
    required this.name,
    required this.party,
    this.photoUrl,
    this.description,
  });

  factory Candidate.fromJson(Map<String, dynamic> json) {
    return Candidate(
      id: json['id'],
      name: json['name'],
      party: json['party'],
      photoUrl: json['photoUrl'],
      description: json['description'],
    );
  }

  bool get isNetworkLogo => photoUrl != null && photoUrl!.startsWith('http');

  String? get logoPath {
    if (isNetworkLogo) return photoUrl;

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
    };

    return partyLogos[party];
  }

  bool get isSvgLogo => logoPath?.endsWith('.svg') ?? false;
}
