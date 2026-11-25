import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/models/category.dart';
import 'package:demok_mobile/models/law.dart';
import 'package:demok_mobile/models/territory.dart';
import 'package:demok_mobile/widgets/law_filters_bar.dart';

final _categories = [
  Category(id: 1, name: 'Finances', slug: 'finances', color: '#FFD700', icon: '💰'),
  Category(id: 2, name: 'Sécurité', slug: 'securite', color: '#1A535C', icon: '🚨'),
];

void main() {
  group('Territory', () {
    test('hides NATIONAL and redundant OUTRE_MER on a law', () {
      expect(Territory.displayable(['NATIONAL']), isEmpty);
      expect(Territory.displayable(['MAYOTTE', 'OUTRE_MER']).map((t) => t.label), ['Mayotte']);
      expect(Territory.displayable(['OUTRE_MER']).map((t) => t.label), ['Outre-mer']);
      expect(Territory.displayable(['CORSE', 'UE']).map((t) => t.code), ['CORSE', 'UE']);
    });

    test('falls back gracefully on unknown codes', () {
      expect(Territory.of('ATLANTIDE').label, 'ATLANTIDE');
    });

    test('Law parses territories', () {
      final law = Law.fromJson({
        'id': 'l1',
        'externalId': 'X',
        'titleOfficial': 'Projet de loi relatif à Mayotte',
        'status': 'PENDING',
        'source': 'Ass. Nat.',
        'territories': ['MAYOTTE', 'OUTRE_MER'],
      });
      expect(law.territories, ['MAYOTTE', 'OUTRE_MER']);
    });
  });

  group('LawFiltersBar', () {
    testWidgets('toggles a territory and a theme filter', (tester) async {
      int? category;
      String? territory;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => LawFiltersBar(
              selectedCategoryId: category,
              selectedTerritory: territory,
              categoriesLoader: () async => _categories,
              onCategoryChanged: (id) => setState(() => category = id),
              onTerritoryChanged: (code) => setState(() => territory = code),
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('territory-OUTRE_MER')));
      await tester.pump();
      expect(territory, 'OUTRE_MER');

      await tester.tap(find.byKey(const Key('territory-OUTRE_MER')));
      await tester.pump();
      expect(territory, isNull);

      await tester.ensureVisible(find.byKey(const Key('category-securite')));
      await tester.tap(find.byKey(const Key('category-securite')));
      await tester.pump();
      expect(category, 2);
    });
  });

  group('LawClassificationChips', () {
    testWidgets('shows themes and specific territories only', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: LawClassificationChips(categories: _categories, territories: const ['NOUVELLE_CALEDONIE', 'OUTRE_MER']),
        ),
      ));
      expect(find.text('💰 Finances'), findsOneWidget);
      expect(find.text('🏝️ Nouvelle-Calédonie'), findsOneWidget);
      expect(find.byKey(const Key('place-OUTRE_MER')), findsNothing);
    });

    testWidgets('renders nothing for an unclassified national law', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: LawClassificationChips(categories: [], territories: ['NATIONAL'])),
      ));
      expect(find.byType(Wrap), findsNothing);
    });
  });
}
