import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/utils/validators.dart';

void main() {
  group('Validators.password', () {
    test('rejects passwords shorter than the backend minimum', () {
      expect(Validators.password('a' * (Validators.passwordMinLength - 1)), isNotNull);
    });

    test('accepts the minimum length', () {
      expect(Validators.password('a' * Validators.passwordMinLength), isNull);
    });

    test('rejects passwords beyond the bcrypt limit', () {
      expect(Validators.password('a' * (Validators.passwordMaxLength + 1)), isNotNull);
    });
  });

  group('Validators.email', () {
    test('accepts common addresses (trimmed)', () {
      expect(Validators.email('jo@example.org'), isNull);
      expect(Validators.email('  prenom.nom+demok@mairie.gouv.fr '), isNull);
    });

    test('rejects malformed addresses', () {
      for (final value in ['', 'jo', 'jo@', '@example.org', 'jo@example', 'jo @example.org']) {
        expect(Validators.email(value), isNotNull, reason: value);
      }
    });
  });
}
