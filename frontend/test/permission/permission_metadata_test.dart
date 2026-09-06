import 'package:flutter_test/flutter_test.dart';

import 'package:new_erp_final_frontend/modules/permission/permission_metadata.dart';

void main() {
  test('buildMatrix derives modules, resources, and heterogeneous actions', () {
    final matrix = PermissionDescriptor.buildMatrix([
      PermissionDescriptor.fromJson({
        'permissionKey': 'production.work_order.release',
        'moduleCode': 'production',
        'resource': 'work_order',
        'action': 'release',
        'displayName': 'Release Work Orders',
      }),
      PermissionDescriptor.fromJson({
        'permissionKey': 'production.work_order.complete',
        'moduleCode': 'production',
        'resource': 'work_order',
        'action': 'complete',
        'displayName': 'Complete Work Orders',
      }),
      PermissionDescriptor.fromJson({
        'permissionKey': 'production.machine.read',
        'moduleCode': 'production',
        'resource': 'machine',
        'action': 'read',
        'displayName': 'Read Machines',
      }),
      PermissionDescriptor.fromJson({
        'permissionKey': 'finance.invoice.approve',
        'moduleCode': 'finance',
        'resource': 'invoice',
        'action': 'approve',
        'displayName': 'Approve Invoices',
      }),
    ]);

    expect(matrix.map((module) => module.moduleCode), ['finance', 'production']);
    final production = matrix.last;
    expect(production.resources.map((resource) => resource.resourceCode), [
      'machine',
      'work_order',
    ]);
    expect(production.resources.last.actions, ['complete', 'release']);
    expect(production.resources.first.permissionFor('release'), isNull);
  });

  test('buildMatrix suppresses duplicate permission keys and cells', () {
    final descriptor = PermissionDescriptor.fromJson({
      'permissionKey': 'production.work_order.release',
      'moduleCode': 'production',
      'resource': 'work_order',
      'action': 'release',
      'displayName': 'Release Work Orders',
    });

    final matrix = PermissionDescriptor.buildMatrix([
      descriptor,
      descriptor,
    ]);

    final resource = matrix.single.resources.single;
    expect(resource.actions, ['release']);
    expect(resource.permissionFor('release')?.permissionKey, descriptor.permissionKey);
  });

  test('does not invent a module from an unstructured two-part key', () {
    final descriptor = PermissionDescriptor.fromJson('user.read');

    expect(descriptor.moduleCode, 'general');
    expect(descriptor.resource, 'user');
    expect(descriptor.action, 'read');
  });
}
