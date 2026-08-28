import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../modules/organization/organization_service.dart';
import '../../modules/user/user_service.dart';
import '../../presentation/ui/components/page_header.dart';
import '../../presentation/ui/components/stat_card/erp_stat_card.dart';
import '../../widgets/app_shell.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final AuthService _authService;
  late final OrganizationService _organizationService;
  late final UserService _userService;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _authService = GetIt.instance.get<AuthService>();
    _organizationService = GetIt.instance.get<OrganizationService>();
    _userService = GetIt.instance.get<UserService>();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshDashboard());
  }

  Future<void> _refreshDashboard() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      await Future.wait([
        _organizationService.fetchOrganizations(),
        _userService.fetchUsers(),
      ]);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = _authService.currentUser;
    final tenant = _authService.currentTenantId;
    final currentLocation = _authService.currentLocationId ?? 'Not selected';
    final username = user != null
        ? (user['username'] ?? user['email'] ?? 'User')
        : 'User';

    final cards = [
      ErpStatCard(
        title: 'Organizations',
        value: _isLoading
            ? 'Loading…'
            : _organizationService.organizations.length.toString(),
        icon: Icons.apartment_outlined,
        subtitle: 'Active organizations in ERP',
        accentColor: theme.colorScheme.primary,
        loading: _isLoading,
        onTap: () => Navigator.of(context).pushNamed('/organizations'),
      ),
      ErpStatCard(
        title: 'Users',
        value: _isLoading ? 'Loading…' : _userService.users.length.toString(),
        icon: Icons.people_alt_outlined,
        subtitle: 'Registered user accounts',
        accentColor: Colors.indigo,
        loading: _isLoading,
        onTap: () => Navigator.of(context).pushNamed('/users'),
      ),
      ErpStatCard(
        title: 'Current user',
        value: username,
        icon: Icons.person_outline,
        subtitle: _authService.isAuthenticated
            ? 'Authenticated identity'
            : 'Signed out',
        accentColor: Colors.teal,
        onTap: _authService.isAuthenticated
            ? null
            : () => Navigator.of(context).pushReplacementNamed('/login'),
      ),
      ErpStatCard(
        title: 'Tenant',
        value: tenant ?? 'Unknown',
        icon: Icons.business_outlined,
        subtitle: 'Active tenant workspace',
        accentColor: Colors.orange,
      ),
      ErpStatCard(
        title: 'Location',
        value: currentLocation,
        icon: Icons.location_on_outlined,
        subtitle: 'Active authorized location',
        accentColor: Colors.green,
      ),
    ];

    final hasNoData = !_isLoading &&
        _organizationService.organizations.isEmpty &&
        _userService.users.isEmpty;

    return AppShell(
      child: RefreshIndicator(
        onRefresh: _refreshDashboard,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ErpPageHeader(
              title: 'Dashboard',
              subtitle: 'Overview of your ERP environment',
              breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard')],
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final int columns;
                final double aspectRatio;

                // Match the upstream template's grid behaviour:
                // mobile uses two cards when practical, while tablet and
                // desktop use a four-column card grid.
                if (width < 650) {
                  columns = width < 360 ? 1 : 2;
                  aspectRatio = width > 350 ? 1.3 : 1.0;
                } else if (width < 1100) {
                  columns = 4;
                  aspectRatio = 1.0;
                } else {
                  columns = 4;
                  aspectRatio = width < 1400 ? 1.1 : 1.4;
                }

                return GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: cards.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: aspectRatio,
                  ),
                  itemBuilder: (context, index) => cards[index],
                );
              },
            ),
            const SizedBox(height: 24),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: theme.colorScheme.error.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.error),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Unable to load dashboard data.\n$_error',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onErrorContainer,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _refreshDashboard,
                        child: const Text('Retry'),
                      ),
                    ),
                  ],
                ),
              )
            else if (hasNoData)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: theme.dividerColor.withValues(alpha: 0.75),
                  ),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.inbox_outlined,
                        size: 32,
                        color: theme.colorScheme.primary.withValues(alpha: 0.7),
                      ),
                      const SizedBox(height: 12),
                      Text('No data available', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text(
                        'There are no organizations or users to summarize yet.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              Card(
                margin: const EdgeInsets.only(top: 24),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ERP Modules', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ActionChip(
                            label: const Text('Organizations'),
                            onPressed: () => Navigator.of(context).pushNamed('/organizations'),
                          ),
                          ActionChip(
                            label: const Text('Branches'),
                            onPressed: () => Navigator.of(context).pushNamed('/organizations'),
                          ),
                          ActionChip(
                            label: const Text('Users'),
                            onPressed: () => Navigator.of(context).pushNamed('/users'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
