import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../modules/auth/login_screen.dart';
import '../modules/branch/create_screen.dart';
import '../modules/branch/details_screen.dart';
import '../modules/branch/edit_screen.dart';
import '../modules/branch/list_screen.dart';
import '../modules/customer/create_screen.dart';
import '../modules/customer/details_screen.dart';
import '../modules/customer/edit_screen.dart';
import '../modules/customer/list_screen.dart';
import '../modules/sales/create_screen.dart';
import '../modules/sales/details_screen.dart';
import '../modules/sales/edit_screen.dart';
import '../modules/sales/list_screen.dart';
import '../modules/sales/invoice_list_screen.dart';
import '../modules/sales/invoice_details_screen.dart';
import '../modules/sales/invoice_create_screen.dart';
import '../modules/sales/boundary_list_screen.dart';
import '../modules/sales/boundary_details_screen.dart';
import '../modules/sales/report_screen.dart';
import '../modules/sales/sales_admin_list_screen.dart';
import '../modules/sales/boundary_create_screen.dart';
import '../modules/sales/sales_admin_create_screen.dart';
import '../modules/dashboard/dashboard_screen.dart';
import '../modules/organization/create_screen.dart';
import '../modules/organization/details_screen.dart';
import '../modules/organization/edit_screen.dart';
import '../modules/organization/list_screen.dart';
import '../modules/permission/permission_detail_screen.dart';
import '../modules/permission/permission_list_screen.dart';
import '../modules/permission/role_permission_screen.dart';
import '../modules/role/create_screen.dart';
import '../modules/role/edit_screen.dart';
import '../modules/role/list_screen.dart';
import '../modules/user/create_screen.dart';
import '../modules/user/details_screen.dart';
import '../modules/user/list_screen.dart';
import 'route_config.dart';

class AppRouter {
  static const Map<String, String?> routePermissions =
      AppRoutes.routePermissions;

  static String _lastPathSegment(String route) {
    final segments = route
        .split('/')
        .where((segment) => segment.isNotEmpty)
        .toList();
    if (segments.isEmpty) return '';
    return segments.last;
  }

  static String _customerId(String path, Object? arguments) {
    if (arguments is String && arguments.isNotEmpty) return arguments;
    if (arguments is Map && arguments['id'] is String) {
      return arguments['id'] as String;
    }

    final segments = path
        .split('/')
        .where((segment) => segment.isNotEmpty)
        .toList();
    return segments.length > 1 ? segments[1] : '';
  }

  static String _quotationId(String path, Object? arguments) =>
      _extractDetailId(path, arguments) ?? '';

  static String? _extractDetailId(
    String routeName,
    Object? arguments, [
    String? expectedKey,
  ]) {
    if (arguments is String && arguments.isNotEmpty) return arguments;
    if (arguments is Map) {
      final key = expectedKey ?? 'id';
      final value = arguments[key];
      if (value is String && value.isNotEmpty) return value;
      final alternative = arguments['${key}Id'];
      if (alternative is String && alternative.isNotEmpty) return alternative;
    }
    final segment = _lastPathSegment(routeName);
    return segment.isEmpty ? null : segment;
  }

  static Route<dynamic>? generateRoute(RouteSettings settings) {
    final auth = GetIt.instance.get<AuthService>();
    final path = AppRoutes.normalize(settings.name ?? '/');

    if (auth.isAuthenticated &&
        auth.requiresOrganizationSelection &&
        path != '/login' &&
        path != '/organization-selection') {
      return MaterialPageRoute(
        settings: const RouteSettings(name: '/organization-selection'),
        builder: (_) => const _OrganizationSelectionScreen(),
      );
    }

    if (path.startsWith('/settings/organizations/details/')) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: OrganizationDetailsScreen(
            id: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    if (path.startsWith('/customers/') &&
        path.endsWith('/edit') &&
        path != '/customers/create') {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/customers/edit',
          child: EditCustomerScreen(id: _customerId(path, settings.arguments)),
        ),
      );
    }
    if (path.startsWith('/customers/') && path != '/customers/create') {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/customers/details',
          child: CustomerDetailsScreen(
            id: _customerId(path, settings.arguments),
          ),
        ),
      );
    }
    if (path.startsWith('/sales/quotations/') &&
        path.endsWith('/edit') &&
        path != '/sales/quotations/create') {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/sales/quotations/edit',
          child: EditSalesQuotationScreen(
            id: _quotationId(
              path.substring(0, path.length - 5),
              settings.arguments,
            ),
          ),
        ),
      );
    }
    if (path.startsWith('/sales/invoices/') &&
        path != '/sales/invoices/create') {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/sales/invoices/details',
          child: SalesInvoiceDetailsScreen(
            id: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }
    if (path == '/sales/returns') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesBoundaryListScreen(kind: 'returns', permission: 'sales.return.read', title: 'Sales Returns')));
    if (path == '/sales/credit-notes') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesBoundaryListScreen(kind: 'credit-notes', permission: 'sales.credit_note.read', title: 'Credit Notes')));
    if (path == '/sales/returns/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesBoundaryCreateScreen(kind: 'returns', sourceLabel: 'Issued invoice ID', title: 'Create Sales Return')));
    if (path == '/sales/credit-notes/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesBoundaryCreateScreen(kind: 'credit-notes', sourceLabel: 'Processed return ID', title: 'Create Credit Note')));
    if (path == '/sales/reports') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesReportScreen()));
    if (path == '/sales/pricing') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesAdminListScreen(kind: 'price-lists', title: 'Sales Pricing')));
    if (path == '/sales/discounts') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesAdminListScreen(kind: 'discount-rules', title: 'Sales Discounts')));
    if (path == '/sales/pricing/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesAdminCreateScreen(kind: 'price-lists', title: 'Create Price List')));
    if (path == '/sales/discounts/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: path, child: const SalesAdminCreateScreen(kind: 'discount-rules', title: 'Create Discount Rule')));
    if (path.startsWith('/sales/returns/') && path != '/sales/returns/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/sales/returns/details', child: SalesBoundaryDetailsScreen(kind: 'returns', id: _extractDetailId(path, settings.arguments) ?? '', title: 'Sales Return')));
    if (path.startsWith('/sales/credit-notes/') && path != '/sales/credit-notes/create') return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/sales/credit-notes/details', child: SalesBoundaryDetailsScreen(kind: 'credit-notes', id: _extractDetailId(path, settings.arguments) ?? '', title: 'Credit Note')));
    if (path.startsWith('/sales/quotations/') &&
        path != '/sales/quotations/create') {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/sales/quotations/details',
          child: SalesQuotationDetailsScreen(
            id: _quotationId(path, settings.arguments),
          ),
        ),
      );
    }

    if (path.startsWith('/settings/organizations/edit/')) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: EditOrganizationScreen(
            id: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    if (path.startsWith('/settings/branches/details/')) {
      final organizationId =
          (settings.arguments is Map
                  ? (settings.arguments as Map)['organizationId']
                  : null)
              as String? ??
          auth.currentOrganizationId ??
          auth.selectedOrganizationId ??
          '';
      final branchId = _extractDetailId(path, settings.arguments) ?? '';
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: BranchDetailsScreen(
            organizationId: organizationId,
            branchId: branchId,
          ),
        ),
      );
    }

    if (path.startsWith('/settings/branches/edit/')) {
      final organizationId =
          (settings.arguments is Map
                  ? (settings.arguments as Map)['organizationId']
                  : null)
              as String? ??
          auth.currentOrganizationId ??
          auth.selectedOrganizationId ??
          '';
      final branchId = _extractDetailId(path, settings.arguments) ?? '';
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: EditBranchScreen(
            organizationId: organizationId,
            branchId: branchId,
          ),
        ),
      );
    }

    if (path.startsWith('/settings/users/details/')) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: UserDetailsScreen(
            id: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    final userPathSegments = path
        .split('/')
        .where((segment) => segment.isNotEmpty)
        .toList();
    const obsoleteUserRoutes = {
      '/settings/users/edit',
      '/settings/users/roles',
      '/settings/users/access',
    };
    if (path.startsWith('/settings/users/') &&
        userPathSegments.length == 3 &&
        path != '/settings/users/create' &&
        !obsoleteUserRoutes.contains(path)) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: '/settings/users/details',
          child: UserDetailsScreen(
            id: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    if (path.startsWith('/settings/roles/edit/')) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: RoleEditScreen(
            roleId: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    if (path.startsWith('/settings/roles/permissions/')) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => _protected(
          context,
          routeName: path,
          child: RolePermissionScreen(
            roleId: _extractDetailId(path, settings.arguments) ?? '',
          ),
        ),
      );
    }

    switch (path) {
      case '/':
      case '/dashboard':
        return MaterialPageRoute(
          settings: const RouteSettings(name: '/dashboard'),
          builder: (context) => _protected(
            context,
            routeName: '/dashboard',
            child: const DashboardScreen(),
          ),
        );
      case '/customers':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/customers',
            child: const CustomerListScreen(),
          ),
        );
      case '/customers/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/customers/create',
            child: const CreateCustomerScreen(),
          ),
        );
      case '/sales/quotations':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/sales/quotations',
            child: const SalesQuotationListScreen(),
          ),
        );
      case '/sales/invoices':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/sales/invoices',
            child: const SalesInvoiceListScreen(),
          ),
        );
      case '/sales/invoices/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/sales/invoices/create',
            child: const CreateSalesInvoiceScreen(),
          ),
        );
      case '/sales/quotations/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/sales/quotations/create',
            child: const CreateSalesQuotationScreen(),
          ),
        );
      case '/login':
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const LoginScreen(),
        );
      case '/organization-selection':
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const _OrganizationSelectionScreen(),
        );
      case '/settings':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations',
            child: const OrganizationListScreen(),
          ),
        );
      case '/settings/organizations':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations',
            child: const OrganizationListScreen(),
          ),
        );
      case '/settings/organizations/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/create',
            child: const CreateOrganizationScreen(),
          ),
        );
      case '/settings/organizations/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/details',
            child: OrganizationDetailsScreen(
              id: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/settings/organizations/edit':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/edit',
            child: EditOrganizationScreen(
              id: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/settings/branches':
        {
          final organizationId =
              (settings.arguments is String
                  ? settings.arguments as String?
                  : null) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/settings/branches',
              child: BranchListScreen(organizationId: organizationId),
            ),
          );
        }
      case '/settings/branches/create':
        {
          final organizationId =
              (settings.arguments is String
                  ? settings.arguments as String?
                  : null) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/settings/branches/create',
              child: CreateBranchScreen(organizationId: organizationId),
            ),
          );
        }
      case '/settings/branches/details':
        {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final organizationId =
              (args['organizationId'] as String?) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/settings/branches/details',
              child: BranchDetailsScreen(
                organizationId: organizationId,
                branchId: args['branchId'] as String? ?? '',
              ),
            ),
          );
        }
      case '/settings/branches/edit':
        {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final organizationId =
              (args['organizationId'] as String?) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/settings/branches/edit',
              child: EditBranchScreen(
                organizationId: organizationId,
                branchId: args['branchId'] as String? ?? '',
              ),
            ),
          );
        }
      case '/settings/users':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/users',
            child: const UserListScreen(),
          ),
        );
      case '/settings/users/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/users/create',
            child: const UserCreateScreen(),
          ),
        );
      case '/settings/users/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/users/details',
            child: UserDetailsScreen(),
          ),
        );
      case '/settings/roles':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/roles',
            child: const RoleListScreen(),
          ),
        );
      case '/settings/roles/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/roles/create',
            child: const RoleCreateScreen(),
          ),
        );
      case '/settings/roles/permissions':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/roles/permissions',
            child: RolePermissionScreen(
              roleId: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/settings/roles/edit':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/roles/edit',
            child: RoleEditScreen(roleId: settings.arguments as String? ?? ''),
          ),
        );
      case '/settings/permissions':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/permissions',
            child: const PermissionListScreen(),
          ),
        );
      case '/settings/permissions/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/permissions/details',
            child: PermissionDetailScreen(
              permissionKey: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/organizations':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/organizations',
            child: const OrganizationListScreen(),
          ),
        );
      case '/organizations/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/organizations/create',
            child: const CreateOrganizationScreen(),
          ),
        );
      case '/organizations/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/organizations/details',
            child: OrganizationDetailsScreen(
              id: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/organizations/edit':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/organizations/edit',
            child: EditOrganizationScreen(
              id: settings.arguments as String? ?? '',
            ),
          ),
        );
      case '/organizations/branches':
        {
          final organizationId =
              (settings.arguments is String
                  ? settings.arguments as String?
                  : null) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/organizations/branches',
              child: BranchListScreen(organizationId: organizationId),
            ),
          );
        }
      case '/organizations/branches/create':
        {
          final organizationId =
              (settings.arguments is String
                  ? settings.arguments as String?
                  : null) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/organizations/branches/create',
              child: CreateBranchScreen(organizationId: organizationId),
            ),
          );
        }
      case '/organizations/branches/details':
        {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final organizationId =
              (args['organizationId'] as String?) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/organizations/branches/details',
              child: BranchDetailsScreen(
                organizationId: organizationId,
                branchId: args['branchId'] as String? ?? '',
              ),
            ),
          );
        }
      case '/organizations/branches/edit':
        {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final organizationId =
              (args['organizationId'] as String?) ??
              auth.currentOrganizationId ??
              auth.selectedOrganizationId ??
              '';
          return MaterialPageRoute(
            settings: settings,
            builder: (context) => _protected(
              context,
              routeName: '/organizations/branches/edit',
              child: EditBranchScreen(
                organizationId: organizationId,
                branchId: args['branchId'] as String? ?? '',
              ),
            ),
          );
        }
      case '/users':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/users',
            child: const UserListScreen(),
          ),
        );
      case '/users/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/users/create',
            child: const UserCreateScreen(),
          ),
        );
      case '/users/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/users/details',
            child: const UserDetailsScreen(),
          ),
        );
      case '/roles':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/roles',
            child: const RoleListScreen(),
          ),
        );
      case '/roles/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/roles/create',
            child: const RoleCreateScreen(),
          ),
        );
      case '/roles/edit':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/roles/edit',
            child: RoleEditScreen(roleId: settings.arguments as String? ?? ''),
          ),
        );
      case '/permissions':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/permissions',
            child: const PermissionListScreen(),
          ),
        );
      default:
        return MaterialPageRoute(
          settings: settings,
          builder: (_) => const _NotFoundScreen(),
        );
    }
  }

  static Widget _protected(
    BuildContext context, {
    required String routeName,
    required Widget child,
  }) {
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) return const LoginScreen();
    if (auth.requiresOrganizationSelection)
      return const _OrganizationSelectionScreen();
    return _RouteAuthorizationGate(routeName: routeName, child: child);
  }
}

class _OrganizationSelectionScreen extends StatelessWidget {
  const _OrganizationSelectionScreen();

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return Scaffold(
      appBar: AppBar(title: const Text('Select organization')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: auth.availableOrganizations.isEmpty
              ? const Center(child: Text('Select organization'))
              : ListView.separated(
                  itemCount: auth.availableOrganizations.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final org = auth.availableOrganizations[index];
                    final id = (org['id'] ?? '').toString();
                    final name = (org['name'] ?? id).toString();
                    return Card(
                      child: ListTile(
                        title: Text(name),
                        trailing: FilledButton(
                          onPressed: () async {
                            final ok = await auth.selectOrganization(id);
                            if (ok && context.mounted) {
                              Navigator.of(context).pushNamedAndRemoveUntil(
                                '/dashboard',
                                (_) => false,
                              );
                            }
                          },
                          child: const Text('Select'),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _RouteAuthorizationGate extends StatefulWidget {
  final String routeName;
  final Widget child;
  const _RouteAuthorizationGate({required this.routeName, required this.child});
  @override
  State<_RouteAuthorizationGate> createState() =>
      _RouteAuthorizationGateState();
}

class _RouteAuthorizationGateState extends State<_RouteAuthorizationGate> {
  bool _loadingStarted = false;
  AuthService get _auth => GetIt.instance.get<AuthService>();

  @override
  void initState() {
    super.initState();
    _ensurePermissionsLoaded();
  }

  Future<void> _ensurePermissionsLoaded() async {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    if (requiredPermission == null || !_auth.isAuthenticated) return;
    if (_auth.authzService.isLoaded ||
        _auth.authzService.isLoading ||
        _loadingStarted)
      return;
    _loadingStarted = true;
    await _auth.ensureEffectivePermissionsLoaded();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    final requiredModule = AppRoutes.forRoute(widget.routeName).moduleCode;
    if (!_auth.isAuthenticated) return const LoginScreen();
    if (requiredModule != null && !_auth.hasModule(requiredModule)) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'This module is not enabled for the active organization.',
          ),
        ),
      );
    }
    if (requiredPermission != null) {
      if (_auth.authzService.isLoading || !_auth.authzService.isLoaded) {
        return const Center(child: CircularProgressIndicator());
      }
      if (!_auth.hasPermission(requiredPermission)) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Access denied',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'Required permission: $requiredPermission.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }
    }
    return widget.child;
  }
}

class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Page not found'),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () =>
                    Navigator.of(context)
                        .pushNamedAndRemoveUntil('/dashboard', (_) => false),
                child: const Text('Go to Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
