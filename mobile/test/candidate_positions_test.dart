import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/models/candidate_position.dart';
import 'package:demok_mobile/widgets/candidate_positions.dart';

final _onLaw = [
  {
    'candidateId': 'c1',
    'name': 'Anne Déclarée',
    'party': 'Parti B',
    'position': 'CONTRE',
    'sourceType': 'DECLARATION',
    'sourceLabel': 'Déclaration publique',
    'sourceUrl': 'https://media.example.fr/entretien',
    'quote': 'Je voterais contre.',
    'sourceDate': '2026-10-02',
    'groupPosition': 'POUR',
    'groupLabel': 'Groupe B',
  },
  {
    'candidateId': 'c2',
    'name': 'Claire Groupe',
    'party': 'Parti C',
    'position': 'POUR',
    'sourceType': 'VOTE_GROUPE',
    'sourceLabel': 'Vote du groupe Groupe C (pas une position personnelle)',
    'groupLabel': 'Groupe C',
  },
  {'candidateId': 'c3', 'name': 'David Inconnu', 'party': 'Parti D', 'position': 'INCONNU', 'sourceType': 'INCONNU', 'sourceLabel': 'Position non connue'},
];

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))));
  await tester.pumpAndSettle();
}

void main() {
  group('CandidatePosition', () {
    test('parses a sourced declaration', () {
      final c = CandidateOnLaw.fromJson(_onLaw.first);
      expect(c.position.positionLabel, 'Contre');
      expect(c.position.sourceTypeLabel, 'Déclaration');
      expect(c.position.sourceDate, DateTime(2026, 10, 2));
      expect(c.position.isGroupProxy, isFalse);
    });

    test('flags group proxies and unknown positions', () {
      expect(CandidateOnLaw.fromJson(_onLaw[1]).position.isGroupProxy, isTrue);
      expect(CandidateOnLaw.fromJson(_onLaw[2]).position.isKnown, isFalse);
    });

    test('parses the positions of a candidate with law categories', () {
      final l = LawOfCandidate.fromJson({
        'law': {'id': 'l1', 'titleOfficial': 'Officiel', 'titleVulgarized': 'Vulgarisé', 'categories': [{'slug': 'finances', 'name': 'Finances', 'icon': '💰'}]},
        'position': 'POUR',
        'sourceType': 'VOTE_PERSONNEL',
        'sourceLabel': 'Son vote de député sur ce texte',
      });
      expect(l.title, 'Vulgarisé');
      expect(l.categories.single.slug, 'finances');
    });
  });

  group('CandidatePositionsSection', () {
    testWidgets('shows known positions with their source and counts the unknown ones', (tester) async {
      await _pump(tester, CandidatePositionsSection(
        lawId: 'law-1',
        loader: (_) async => _onLaw.map(CandidateOnLaw.fromJson).toList(),
      ));

      expect(find.text('Ce qu\'en disent les candidats à la présidentielle'), findsOneWidget);
      expect(find.text('Anne Déclarée'), findsOneWidget);
      expect(find.text('Déclaration publique · 02/10/2026'), findsOneWidget);
      expect(find.text('« Je voterais contre. »'), findsOneWidget);
      expect(find.text('Son groupe (Groupe B) : Pour'), findsOneWidget);
      expect(find.text('Vote du groupe Groupe C (pas une position personnelle)'), findsOneWidget);
      expect(find.text('David Inconnu'), findsNothing);
      expect(find.text('1 candidat(s) sans position connue sur ce texte'), findsOneWidget);
      expect(find.textContaining('Aucune position n\'est générée par IA'), findsOneWidget);
    });

    testWidgets('stays hidden when no candidate position is known', (tester) async {
      await _pump(tester, CandidatePositionsSection(
        lawId: 'law-1',
        loader: (_) async => [CandidateOnLaw.fromJson(_onLaw[2])],
      ));
      expect(find.text('Ce qu\'en disent les candidats à la présidentielle'), findsNothing);
    });
  });

  group('CandidateLawPositionsList', () {
    LawOfCandidate law(String id, String title, String slug, String position) => LawOfCandidate.fromJson({
          'law': {'id': id, 'titleOfficial': title, 'categories': [{'slug': slug, 'name': slug, 'icon': ''}]},
          'position': position,
          'sourceType': 'VOTE_PERSONNEL',
          'sourceLabel': 'Son vote de député sur ce texte',
        });

    testWidgets('filters the laws by category', (tester) async {
      await _pump(tester, CandidateLawPositionsList(
        candidateId: 'c1',
        loader: (_) async => [law('l1', 'Budget 2027', 'finances', 'POUR'), law('l2', 'Police municipale', 'securite', 'CONTRE')],
      ));

      expect(find.text('Budget 2027'), findsOneWidget);
      expect(find.text('Police municipale'), findsOneWidget);

      await tester.tap(find.byKey(const Key('category-securite')));
      await tester.pumpAndSettle();

      expect(find.text('Budget 2027'), findsNothing);
      expect(find.text('Police municipale'), findsOneWidget);
    });
  });
}
