import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/models/group_vote.dart';
import 'package:demok_mobile/widgets/group_votes_section.dart';

final _json = {
  'scrutinId': 'VT1',
  'groups': [
    {
      'organeRef': 'PO1',
      'label': 'Rassemblement National',
      'pour': 120,
      'contre': 2,
      'abstention': 0,
      'nonVotants': 1,
      'position': 'FOR',
      'dissidents': [
        {'deputyId': 'd1', 'fullName': 'Alice Martin', 'choice': 'AGAINST'},
        {'deputyId': 'd2', 'fullName': 'Bruno Petit', 'choice': 'AGAINST'},
      ],
    },
    {'organeRef': 'PO2', 'label': 'La France insoumise', 'pour': 0, 'contre': 70, 'abstention': 0, 'nonVotants': 0, 'position': 'AGAINST', 'dissidents': []},
    {'organeRef': 'PO3', 'label': 'Libertés', 'pour': 3, 'contre': 3, 'abstention': 0, 'nonVotants': 0, 'position': 'MIXED'},
  ],
};

List<GroupVote> _groups() =>
    (_json['groups'] as List).map((g) => GroupVote.fromJson(g as Map<String, dynamic>)).toList();

Future<void> _pump(WidgetTester tester, Future<List<GroupVote>> Function(String) loader) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: GroupVotesSection(lawId: 'law-1', loader: loader))),
  ));
  await tester.pumpAndSettle();
}

void main() {
  group('GroupVote', () {
    test('parses counts, position and dissidents', () {
      final g = _groups().first;
      expect(g.label, 'Rassemblement National');
      expect(g.expressed, 122);
      expect(g.positionLabel, 'Pour');
      expect(g.dissidents.map((d) => d.choiceLabel), ['contre', 'contre']);
    });

    test('labels ties and missing dissidents', () {
      final mixed = _groups().last;
      expect(mixed.positionLabel, 'Partagé');
      expect(mixed.dissidents, isEmpty);
    });
  });

  group('GroupVotesSection', () {
    testWidgets('lists every group with its position', (tester) async {
      String? requested;
      await _pump(tester, (id) async {
        requested = id;
        return _groups();
      });

      expect(requested, 'law-1');
      expect(find.text('Vote des groupes politiques'), findsOneWidget);
      expect(find.text('Rassemblement National'), findsOneWidget);
      expect(find.text('La France insoumise'), findsOneWidget);
      expect(find.text('120 pour · 2 contre · 0 abst. · 1 non-votant(s)'), findsOneWidget);
      expect(find.text('Partagé'), findsOneWidget);
    });

    testWidgets('reveals dissidents on demand', (tester) async {
      await _pump(tester, (_) async => _groups());

      expect(find.text('2 député(s) ont voté différemment du groupe'), findsOneWidget);
      expect(find.textContaining('Alice Martin'), findsNothing);

      await tester.tap(find.byKey(const Key('dissidents-PO1')));
      await tester.pumpAndSettle();

      expect(find.text('• Alice Martin — contre'), findsOneWidget);
      expect(find.text('• Bruno Petit — contre'), findsOneWidget);
    });

    testWidgets('renders nothing when no group vote is available or loading fails', (tester) async {
      await _pump(tester, (_) async => []);
      expect(find.text('Vote des groupes politiques'), findsNothing);

      await _pump(tester, (_) async => throw Exception('network'));
      expect(find.text('Vote des groupes politiques'), findsNothing);
    });
  });
}
