import '../config/env.dart';

class Candidate {
  final String id;
  final String name;
  final String party;
  final String? photoUrl;
  final String? partyLogoUrl;
  final String? description;
  /// Fiche de synthèse tierce (pas le programme officiel)
  final String? programUrl;
  final String status;
  final String? officialSiteUrl;
  final String? officialProgramUrl;
  final String programStatus;
  final DateTime? programPublishedAt;
  final DateTime? linksCheckedAt;

  Candidate({
    required this.id,
    required this.name,
    required this.party,
    this.photoUrl,
    this.partyLogoUrl,
    this.description,
    this.programUrl,
    this.status = 'DECLARE',
    this.officialSiteUrl,
    this.officialProgramUrl,
    this.programStatus = 'NON_PUBLIE',
    this.programPublishedAt,
    this.linksCheckedAt,
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
      status: json['status'] ?? 'DECLARE',
      officialSiteUrl: _nonEmpty(json['officialSiteUrl']),
      officialProgramUrl: _nonEmpty(json['officialProgramUrl']),
      programStatus: json['programStatus'] ?? 'NON_PUBLIE',
      programPublishedAt: _date(json['programPublishedAt']),
      linksCheckedAt: _date(json['linksCheckedAt']),
    );
  }

  static String? _nonEmpty(dynamic value) =>
      value is String && value.trim().isNotEmpty ? value.trim() : null;

  static DateTime? _date(dynamic value) => value is String ? DateTime.tryParse(value) : null;

  /// Libellé du statut de candidature (null = rien à afficher).
  String? get statusLabel => switch (status) {
        'OFFICIEL' => 'Candidature officielle',
        'PRESSENTI' => 'Candidature pressentie',
        'RETIRE' => 'Candidature retirée',
        _ => null,
      };

  bool get hasOfficialProgram => officialProgramUrl != null;

  /// Libellé de l'état du programme lorsqu'aucun lien officiel n'est disponible.
  String get programStatusLabel => switch (programStatus) {
        'PUBLIE' => 'Programme publié',
        'PARTIEL' => 'Programme partiel',
        _ => 'Programme non publié',
      };

  /// Domaine de la fiche de synthèse tierce, affiché pour la transparence de la source.
  String? get summarySourceHost {
    if (programUrl == null || programUrl!.isEmpty) return null;
    final host = Uri.tryParse(programUrl!)?.host ?? '';
    return host.isEmpty ? null : host.replaceFirst(RegExp(r'^www\.'), '');
  }

  /// Résout un lien éventuellement relatif à l'API (fichiers déposés via l'admin).
  static String resolveLink(String url) {
    if (url.startsWith('/api')) {
      return Env.apiUrl.replaceAll(RegExp(r'/api$'), '') + url;
    }
    return url;
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

    final normalized = party
        .toLowerCase()
        .replaceAll('é', 'e')
        .replaceAll('è', 'e')
        .replaceAll('ê', 'e')
        .replaceAll('ë', 'e')
        .replaceAll('à', 'a')
        .trim();

    final Map<String, String> partyLogos = {
      "l'apres / divers gauche": 'assets/images/logos_partis/l_apres.svg',
      "l'apres": 'assets/images/logos_partis/l_apres.svg',
      "parti socialiste": 'assets/images/logos_partis/Parti_Socialiste_logo.png',
      "nouvelle energie / lr": 'assets/images/logos_partis/nouvelle_energie.svg',
      "nouvelle energie": 'assets/images/logos_partis/nouvelle_energie.svg',
      "debout !": 'assets/images/logos_partis/debout.png',
      "horizons": 'assets/images/logos_partis/horizons.svg',
      "les ecologistes": 'assets/images/logos_partis/les_ecologistes.svg',
      "les republicains": 'assets/images/logos_partis/les_republicains.svg',
      "rassemblement national": 'assets/images/logos_partis/Rassemblement_National_logo.svg',
      "la france insoumise": 'assets/images/logos_partis/La_France_Insoumise_logo.png',
      "parti communiste francais": 'assets/images/logos_partis/parti_communiste_francais.png',
      "la france humaniste": 'assets/images/logos_partis/la_france_humaniste.png',
      "lutte ouvriere": 'assets/images/logos_partis/Lutte_Ouvriere_logo.svg',
      "place publique": 'assets/images/logos_partis/Place_Publique_logo.png',
      "renaissance": 'assets/images/logos_partis/Renaissance_logo.svg',
      "debout la france": 'assets/images/logos_partis/Debout_la_France_logo.png',
      "reconquete !": 'assets/images/logos_partis/Reconquete_logo.svg',
      "reconquete": 'assets/images/logos_partis/Reconquete_logo.svg',
      "nouveau parti anticapitaliste": 'assets/images/logos_partis/Nouveau_Parti_Anticapitaliste_logo.png',
      "revolution permanente": 'assets/images/logos_partis/Revolution_Permanente_logo.svg',
      "union populaire republicaine": 'assets/images/logos_partis/Union_Populaire_Republicaine_logo.jpg',
      "modem": 'assets/images/logos_partis/Modem.svg',
      "generation ecologie": 'assets/images/logos_partis/Generation_ecologie.png',
      "les patriotes": 'assets/images/logos_partis/Les_Patriotes.png',
      "resistons": 'assets/images/logos_partis/Resistons.png',
      "parti animaliste": 'assets/images/logos_partis/Parti_animaliste.png',
      "union democratique bretonne": 'assets/images/logos_partis/Union_democratique_bretonne.svg',
      "udb": 'assets/images/logos_partis/Union_democratique_bretonne.svg',
      "gauche republicaine et socialiste": 'assets/images/logos_partis/Gauche_Republicaine_et_Socialiste.png',
      "grs": 'assets/images/logos_partis/Gauche_Republicaine_et_Socialiste.png',
      "equinoxe": 'assets/images/logos_partis/Equinoxe.webp',
      "la convention": 'assets/images/logos_partis/La_Convention.png',
      "les ruches": 'assets/images/logos_partis/Les_Ruches.svg',
      "france libre": 'assets/images/logos_partis/France_Libre.png',
      "solution democratique": 'assets/images/logos_partis/Solution_Democratique.webp',
      "nous sommes la france": 'assets/images/logos_partis/Nous_Sommes_la_France.svg',
      "trajectoire": 'assets/images/logos_partis/Trajectoire.png',
      "sans etiquette": 'assets/images/logos_partis/sans_etiquette.svg',
      "sans-etiquette": 'assets/images/logos_partis/sans_etiquette.svg',
      "sans parti": 'assets/images/logos_partis/sans_etiquette.svg',
      "independant": 'assets/images/logos_partis/sans_etiquette.svg',
      "divers": 'assets/images/logos_partis/sans_etiquette.svg',
      "citoyen": 'assets/images/logos_partis/sans_etiquette.svg',
      "": 'assets/images/logos_partis/sans_etiquette.svg',
    };

    return partyLogos[normalized];
  }

  static const String sansEtiquetteLogoPath = 'assets/images/logos_partis/sans_etiquette.svg';

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
