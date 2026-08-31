import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'permission_metadata.dart';
import 'permission_service.dart';

class PermissionListScreen extends StatefulWidget {
  const PermissionListScreen({Key? key}) : super(key: key);

  @override
  State<PermissionListScreen> createState() => _PermissionListScreenState();
}

class _PermissionListScreenState extends State<PermissionListScreen> {
  late final AuthService _auth;
  late final PermissionService _service;
  final TextEditingController _searchController = TextEditingController();

  void _onServiceChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _auth = GetIt.instance.get<AuthService>();
    final apiClient = GetIt.instance.isRegistered<ApiClient>()
        ? GetIt.instance.get<ApiClient>()
        : ApiClient(baseUrl: 'http://localhost:3000');
    _service = PermissionService(apiClient: apiClient);
    _service.addListener(_onServiceChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_auth.hasPermission('permission.read')) return;
      if (!_service.isLoading && !_service.fetchedOnce && _service.error == null) {
        _service.fetchPermissions();
      }
    });
  }

  @override
  void dispose() {
    _service.removeListener(_onServiceChanged);
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_auth.hasPermission('permission.read')) {
      return const Scaffold(
        body: Center(
          child: Text('You do not have permission to view permissions.'),
        ),
      );
    }

    return ChangeNotifierProvider<PermissionService>.value(
      value: _service,
      child: Consumer<PermissionService>(
        builder: (context, svc, _) {
          final isSettingsRoute =
              ModalRoute.of(context)?.settings.name?.startsWith('/settings') ?? false;
          final breadcrumbs = <ErpBreadcrumbItem>[
            ErpBreadcrumbItem(
              label: isSettingsRoute ? 'Settings' : 'Dashboard',
              route: isSettingsRoute ? '/settings' : '/dashboard',
            ),
            const ErpBreadcrumbItem(label: 'Permissions'),
          ];

          final permissions = svc.permissionDetails.isNotEmpty
              ? svc.permissionDetails
              : svc.permissions
                    .map(PermissionDescriptor.fromJson)
                    .toList(growable: false);
          final filtered = permissions.where((item) {
            final query = _searchController.text.trim().toLowerCase();
            if (query.isEmpty) return true;
            final haystack = '${item.displayName} ${item.permissionKey} ${item.moduleName}'.toLowerCase();
            return haystack.contains(query);
          }).toList(growable: false);
          final groups = PermissionDescriptor.groupByModule(filtered);

          return Scaffold(
            body: CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: ErpPageHeader(
                      title: 'Permissions',
                      subtitle: 'Browse and inspect available system permissions',
                      breadcrumbs: breadcrumbs,
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search permissions',
                        prefixIcon: Icon(Icons.search_outlined),
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                ),
                if (svc.isLoading)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (svc.error != null)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Text('Unable to load permissions: ${svc.error}'),
                    ),
                  )
                else if (permissions.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: Text('No permissions found.')),
                  )
                else if (filtered.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: Text('No permissions match your search.')),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate((context, index) {
                        final moduleName = groups.keys.toList()[index];
                        final modulePermissions = groups[moduleName]!;

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 18),
                          child: Card(
                            clipBehavior: Clip.antiAlias,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                                  child: Text(
                                    moduleName,
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                ...modulePermissions.map((permission) {
                                  return ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                                    leading: CircleAvatar(
                                      radius: 16,
                                      child: Icon(
                                        permission.action == 'read'
                                            ? Icons.visibility_outlined
                                            : permission.action == 'create'
                                                ? Icons.add_circle_outline
                                                : permission.action == 'update'
                                                    ? Icons.edit_outlined
                                                    : permission.action == 'delete'
                                                        ? Icons.delete_outline
                                                        : Icons.lock_outline,
                                        size: 18,
                                      ),
                                    ),
                                    title: Text(
                                      permission.displayName,
                                      style: const TextStyle(fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: permission.description != null && permission.description!.isNotEmpty
                                        ? Text(permission.description!)
                                        : Text(permission.permissionKey),
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () => Navigator.of(context).pushNamed(
                                      '/settings/permissions/details',
                                      arguments: permission.permissionKey,
                                    ),
                                  );
                                }),
                              ],
                            ),
                          ),
                        );
                      }, childCount: groups.length),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
