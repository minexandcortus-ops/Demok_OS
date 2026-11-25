import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/models/candidate.dart';

void main() {
  group('Candidate', () {
    Candidate build({String party = 'Renaissance', String? logo, String? photo}) =>
        Candidate.fromJson({
          'id': 'c1',
          'name': 'Jeanne Dupont',
          'party': party,
          'partyLogoUrl': logo,
          'photoUrl': photo,
          'programUrl': 'https://example.org/programme',
        });

    test('fromJson maps every field', () {
      final c = build();
      expect(c.id, 'c1');
      expect(c.name, 'Jeanne Dupont');
      expect(c.party, 'Renaissance');
      expect(c.programUrl, 'https://example.org/programme');
    });

    test('resolves a local logo from an accented party name', () {
      final c = build(party: 'Les Écologistes'.replaceFirst('É', 'é'));
      expect(c.logoPath, 'assets/images/logos_partis/les_ecologistes.svg');
      expect(c.isSvgLogo, isTrue);
    });

    test('keeps absolute network logos and photos untouched', () {
      final c = build(logo: 'https://cdn.example.org/logo.png', photo: 'https://cdn.example.org/p.jpg');
      expect(c.isNetworkLogo, isTrue);
      expect(c.logoPath, 'https://cdn.example.org/logo.png');
      expect(c.fullPhotoUrl, 'https://cdn.example.org/p.jpg');
    });

    test('prefixes API-relative photos with the API host', () {
      final c = build(photo: '/api/uploads/p.jpg');
      expect(c.fullPhotoUrl, endsWith('/api/uploads/p.jpg'));
      expect(c.fullPhotoUrl, startsWith('http'));
    });
  });
}
