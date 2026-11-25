/// Axe « territoire » d'une loi, aligné sur `Territory` côté backend (laws/taxonomy.ts).
class Territory {
  final String code;
  final String label;
  final String icon;

  const Territory(this.code, this.label, this.icon);

  static const national = Territory('NATIONAL', 'National', '🇫🇷');

  static const all = <Territory>[
    national,
    Territory('METROPOLE', 'Métropole', '🗺️'),
    Territory('OUTRE_MER', 'Outre-mer', '🌴'),
    Territory('GUADELOUPE', 'Guadeloupe', '🌴'),
    Territory('MARTINIQUE', 'Martinique', '🌴'),
    Territory('GUYANE', 'Guyane', '🌳'),
    Territory('REUNION', 'La Réunion', '🌋'),
    Territory('MAYOTTE', 'Mayotte', '🌴'),
    Territory('NOUVELLE_CALEDONIE', 'Nouvelle-Calédonie', '🏝️'),
    Territory('POLYNESIE', 'Polynésie française', '🏝️'),
    Territory('SPM', 'Saint-Pierre-et-Miquelon', '❄️'),
    Territory('WALLIS_FUTUNA', 'Wallis-et-Futuna', '🏝️'),
    Territory('SAINT_MARTIN', 'Saint-Martin', '🏝️'),
    Territory('SAINT_BARTHELEMY', 'Saint-Barthélemy', '🏝️'),
    Territory('CORSE', 'Corse', '⛰️'),
    Territory('UE', 'Union européenne', '🇪🇺'),
    Territory('INTERNATIONAL', 'International', '🌍'),
  ];

  /// Filtres proposés dans le flux (OUTRE_MER couvre aussi chaque territoire ultramarin côté API).
  static const filterCodes = [
    'OUTRE_MER',
    'CORSE',
    'METROPOLE',
    'UE',
    'INTERNATIONAL'
  ];

  static Territory of(String code) => all.firstWhere((t) => t.code == code,
      orElse: () => Territory(code, code, '📍'));

  /// Territoires à afficher sur une loi : rien pour une loi simplement nationale,
  /// et OUTRE_MER masqué quand un territoire ultramarin précis est déjà indiqué.
  static List<Territory> displayable(List<String> codes) {
    final specific = codes.where((c) => c != 'NATIONAL').toList();
    final hasPreciseOverseas =
        specific.any((c) => c != 'OUTRE_MER' && _overseas.contains(c));
    return specific
        .where((c) => !(c == 'OUTRE_MER' && hasPreciseOverseas))
        .map(of)
        .toList();
  }

  static const _overseas = {
    'GUADELOUPE',
    'MARTINIQUE',
    'GUYANE',
    'REUNION',
    'MAYOTTE',
    'NOUVELLE_CALEDONIE',
    'POLYNESIE',
    'SPM',
    'WALLIS_FUTUNA',
    'SAINT_MARTIN',
    'SAINT_BARTHELEMY',
  };
}
