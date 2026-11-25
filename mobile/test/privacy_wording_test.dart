import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:demok_mobile/widgets/legal_dialogs.dart';

Future<void> _open(WidgetTester tester, void Function(BuildContext) opener) async {
  tester.view.physicalSize = const Size(1200, 2400);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(MaterialApp(
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(child: ElevatedButton(onPressed: () => opener(context), child: const Text('open'))),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the privacy policy explains that votes are pseudonymised', (tester) async {
    await _open(tester, LegalDialogs.showPrivacyPolicy);
    expect(find.textContaining('Urne Pseudonymisée'), findsOneWidget);
    expect(find.textContaining('pseudonymisés'), findsOneWidget);
    expect(find.textContaining('mathématiquement impossible'), findsNothing);
    expect(find.textContaining('totalement anonyme'), findsNothing);
  });
}
