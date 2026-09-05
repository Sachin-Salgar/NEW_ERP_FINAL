import 'package:flutter_test/flutter_test.dart';

import 'package:new_erp_final_frontend/routing/route_config.dart';

void main() {
  test('defines the Sales quotation route contract', () {
    expect(AppRoutes.salesQuotations.path, '/sales/quotations');
    expect(AppRoutes.salesQuotations.moduleCode, 'sales');
    expect(AppRoutes.salesQuotations.permissionKey, 'sales.quotation.read');
    expect(AppRoutes.routePermissions['/sales/quotations/create'], 'sales.quotation.create');
    expect(AppRoutes.routePermissions['/sales/quotations/details'], 'sales.quotation.read');
    expect(AppRoutes.routePermissions['/sales/quotations/edit'], 'sales.quotation.update');
  });

  test('normalizes and canonicalizes Sales quotation deep links', () {
    expect(AppRoutes.normalize('/sales/quotations/'), '/sales/quotations');
    expect(AppRoutes.canonicalTopLevel('/sales/quotations/create'), '/sales/quotations');
    expect(AppRoutes.salesQuotations.matches('/sales/quotations/details'), isTrue);
  });
}
