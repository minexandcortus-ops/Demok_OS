import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:demok_mobile/services/api_client.dart';
import 'package:demok_mobile/services/user_session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late List<http.Request> requests;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await UserSession().init();
    await UserSession().saveSession(userId: 'u1', token: 'expired-access', refreshToken: 'refresh-1');
    requests = [];
  });

  void mock(Future<http.Response> Function(http.Request) handler) {
    ApiClient.client = MockClient((request) async {
      requests.add(request);
      return handler(request);
    });
  }

  test('refreshes an expired access token once and replays the request', () async {
    mock((r) async {
      if (r.url.path.endsWith('/auth/refresh')) {
        expect(jsonDecode(r.body), {'refreshToken': 'refresh-1'});
        return http.Response(jsonEncode({'accessToken': 'fresh-access', 'refreshToken': 'refresh-2'}), 200);
      }
      return r.headers['Authorization'] == 'Bearer fresh-access' ? http.Response('{"ok":true}', 200) : http.Response('', 401);
    });

    final response = await ApiClient.get('/users/profile');

    expect(response.statusCode, 200);
    expect(requests.map((r) => r.url.path.split('/').last), ['profile', 'refresh', 'profile']);
    expect(UserSession().accessToken, 'fresh-access');
    expect(UserSession().refreshToken, 'refresh-2');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('session_refresh_token'), 'refresh-2');
  });

  test('clears the session when the refresh token is rejected', () async {
    mock((r) async => http.Response('', 401));

    final response = await ApiClient.get('/users/profile');

    expect(response.statusCode, 401);
    expect(requests.where((r) => r.url.path.endsWith('/auth/refresh')), hasLength(1));
    expect(UserSession().isLoggedIn, isFalse);
    expect(UserSession().refreshToken, isNull);
  });

  test('concurrent 401s share a single refresh call', () async {
    mock((r) async {
      if (r.url.path.endsWith('/auth/refresh')) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return http.Response(jsonEncode({'accessToken': 'fresh-access', 'refreshToken': 'refresh-2'}), 200);
      }
      return r.headers['Authorization'] == 'Bearer fresh-access' ? http.Response('{}', 200) : http.Response('', 401);
    });

    final results = await Future.wait([ApiClient.get('/a'), ApiClient.get('/b'), ApiClient.post('/c', body: {})]);

    expect(results.map((r) => r.statusCode), [200, 200, 200]);
    expect(requests.where((r) => r.url.path.endsWith('/auth/refresh')), hasLength(1));
  });

  test('does not try to refresh for guests', () async {
    await UserSession().clearSession();
    mock((r) async => http.Response('', 401));

    await ApiClient.get('/votes/check');

    expect(requests.where((r) => r.url.path.endsWith('/auth/refresh')), isEmpty);
  });

  test('logout revokes the refresh token server-side and clears the session', () async {
    mock((r) async => http.Response('{"success":true}', 200));

    await ApiClient.logout();

    expect(requests.single.url.path, endsWith('/auth/logout'));
    expect(jsonDecode(requests.single.body), {'refreshToken': 'refresh-1'});
    expect(UserSession().isLoggedIn, isFalse);
  });

  test('logout still clears the session when offline', () async {
    ApiClient.client = MockClient((_) async => throw Exception('offline'));
    await ApiClient.logout();
    expect(UserSession().isLoggedIn, isFalse);
  });
}
