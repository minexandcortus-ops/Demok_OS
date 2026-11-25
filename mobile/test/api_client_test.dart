import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:demok_mobile/services/api_client.dart';
import 'package:demok_mobile/services/user_session.dart';

void main() {
  late List<http.Request> requests;

  setUp(() {
    requests = [];
    UserSession().accessToken = null;
    ApiClient.client = MockClient((request) async {
      requests.add(request);
      return http.Response('{}', 200);
    });
  });

  group('ApiClient.get', () {
    test('does not append a cache-busting query parameter', () async {
      await ApiClient.get('/votes/laws?page=1');
      expect(requests.single.url.queryParameters.keys, ['page']);
      expect(requests.single.url.path, endsWith('/votes/laws'));
    });

    test('sends no header that would force a CORS preflight for anonymous users', () async {
      await ApiClient.get('/categories');
      final headerNames = requests.single.headers.keys.map((h) => h.toLowerCase());
      expect(headerNames, isNot(contains('content-type')));
      expect(headerNames, isNot(contains('cache-control')));
      expect(headerNames, isNot(contains('bypass-tunnel-reminder')));
      expect(headerNames, isNot(contains('authorization')));
    });

    test('adds the bearer token when logged in', () async {
      UserSession().accessToken = 'jwt-token';
      await ApiClient.get('/users/profile');
      expect(requests.single.headers['Authorization'], 'Bearer jwt-token');
    });
  });

  group('ApiClient.post', () {
    test('sends a JSON body with its content type', () async {
      await ApiClient.post('/votes', body: {'lawId': 'l1', 'choice': 'FOR'});
      final request = requests.single;
      expect(request.headers['Content-Type'], startsWith('application/json'));
      expect(request.body, '{"lawId":"l1","choice":"FOR"}');
    });
  });
}
