import 'package:flutter_test/flutter_test.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';

void main() {
  test('sanity', () {
    expect(1 + 1, 2);
  });

  test('does not expose module navigation before accessible modules load', () {
    final auth = AuthService(authzService: AuthZService());

    expect(auth.hasModule('crm'), isFalse);
    expect(auth.hasModule('sales'), isFalse);
  });
}
