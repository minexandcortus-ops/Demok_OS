import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/models/candidate.dart';
import 'package:demok_mobile/widgets/candidate_links.dart';

Candidate candidate(Map<String, dynamic> extra) => Candidate.fromJson({
      'id': 'c1',
      'name': 'Jeanne Dupont',
      'party': 'Parti A',
      'programUrl': 'https://www.candidatspresidentielles2027.fr/candidats/jeanne-dupont',
      ...extra,
    });

Future<List<Uri>> pump(WidgetTester tester, Candidate c) async {
  final opened = <Uri>[];
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        child: CandidateLinks(candidate: c, openLink: (uri) async => opened.add(uri)),
      ),
    ),
  ));
  return opened;
}

void main() {
  group('Candidate official fields', () {
    test('parse statuses, links and dates', () {
      final c = candidate({
        'status': 'OFFICIEL',
        'officialSiteUrl': ' https://campagne.example.fr ',
        'officialProgramUrl': '',
        'programStatus': 'PARTIEL',
        'programPublishedAt': '2027-02-14',
        'linksCheckedAt': '2027-02-15T09:00:00.000Z',
      });
      expect(c.statusLabel, 'Candidature officielle');
      expect(c.officialSiteUrl, 'https://campagne.example.fr');
      expect(c.officialProgramUrl, isNull);
      expect(c.hasOfficialProgram, isFalse);
      expect(c.programStatusLabel, 'Programme partiel');
      expect(c.programPublishedAt, DateTime(2027, 2, 14));
      expect(c.summarySourceHost, 'candidatspresidentielles2027.fr');
    });

    test('default to a declared candidate with no published program', () {
      final c = Candidate.fromJson({'id': 'x', 'name': 'A', 'party': 'B'});
      expect(c.status, 'DECLARE');
      expect(c.statusLabel, isNull);
      expect(c.programStatusLabel, 'Programme non publié');
      expect(c.summarySourceHost, isNull);
    });
  });

  group('CandidateLinks', () {
    testWidgets('shows "Programme non publié" when no official program exists', (tester) async {
      await pump(tester, candidate({}));
      expect(find.byKey(const Key('official-program')), findsNothing);
      expect(find.text('Programme non publié'), findsOneWidget);
      expect(find.byKey(const Key('candidate-status')), findsNothing);
    });

    testWidgets('labels the third-party summary with its domain', (tester) async {
      final opened = await pump(tester, candidate({}));
      expect(find.text('Fiche de synthèse · candidatspresidentielles2027.fr'), findsOneWidget);
      await tester.tap(find.byKey(const Key('summary-source')));
      expect(opened.single.host, 'www.candidatspresidentielles2027.fr');
    });

    testWidgets('opens the official program and campaign site, resolving uploaded files', (tester) async {
      final opened = await pump(
        tester,
        candidate({
          'status': 'OFFICIEL',
          'officialProgramUrl': '/api/uploads/candidates/programme.pdf',
          'officialSiteUrl': 'https://campagne.example.fr',
          'programStatus': 'PUBLIE',
          'programPublishedAt': '2027-02-14',
          'linksCheckedAt': '2027-02-15T09:00:00.000Z',
        }),
      );

      expect(find.text('Candidature officielle'), findsOneWidget);
      expect(find.text('Programme officiel'), findsOneWidget);
      expect(find.text('Publié le 14/02/2027'), findsOneWidget);
      expect(find.text('Liens officiels vérifiés le 15/02/2027'), findsOneWidget);
      expect(find.text('Programme non publié'), findsNothing);

      await tester.tap(find.byKey(const Key('official-program')));
      await tester.tap(find.byKey(const Key('official-site')));
      expect(opened[0].path, '/api/uploads/candidates/programme.pdf');
      expect(opened[0].scheme, startsWith('http'));
      expect(opened[1].toString(), 'https://campagne.example.fr');
    });

    testWidgets('flags a withdrawn candidacy', (tester) async {
      await pump(tester, candidate({'status': 'RETIRE'}));
      expect(find.text('Candidature retirée'), findsOneWidget);
    });
  });
}
