import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../modules/organization/organization_service.dart';
import '../../modules/user/user_service.dart';
import '../../presentation/ui/components/dashboard/storage_details_card.dart';
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
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                final columns = width < 520 ? 1 : width < 850 ? 2 : width < 1200 ? 3 : 4;
                final ratio = width < 520 ? 2.15 : width < 850 ? 1.65 : width < 1200 ? 1.55 : 1.65;

                return GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: cards.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: ratio,
                  ),
                  itemBuilder: (context, index) => cards[index],
                );
              },
            ),
            const SizedBox(height: 20),
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
                    TextButton(
                      onPressed: _refreshDashboard,
                      child: const Text('Retry'),
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
              ),
            const SizedBox(height: 20),
            const StorageDetailsCard(),
          ],
        ),
      ),
    );
  }
}
