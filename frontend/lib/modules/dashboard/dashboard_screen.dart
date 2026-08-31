import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../../modules/organization/organization_service.dart';
import '../../modules/user/user_service.dart';
import '../../presentation/ui/components/dashboard/storage_details_card.dart';
import '../../presentation/ui/components/responsive.dart';
import '../../presentation/ui/components/stat_card/erp_stat_card.dart';

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
    final apiClient = GetIt.instance.isRegistered<ApiClient>()
        ? GetIt.instance.get<ApiClient>()
        : ApiClient(baseUrl: 'http://localhost:3000');
    _organizationService = GetIt.instance.isRegistered<OrganizationService>()
        ? GetIt.instance.get<OrganizationService>()
        : OrganizationService(apiClient: apiClient);
    _userService = GetIt.instance.isRegistered<UserService>()
        ? GetIt.instance.get<UserService>()
        : UserService(apiClient: apiClient);
    _refreshDashboard();
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
        title: 'Location',
        value: currentLocation,
        icon: Icons.location_on_outlined,
        subtitle: 'Active authorized location',
        accentColor: Colors.green,
      ),
    ];

    final hasNoData =
        !_isLoading &&
        _organizationService.organizations.isEmpty &&
        _userService.users.isEmpty;

    Widget statusContent() {
      if (_error != null) {
        return Container(
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
        );
      }

      if (hasNoData) {
        return Container(
          padding: const EdgeInsets.all(20),
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
                const SizedBox(height: 10),
                Text('No data available', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'There are no organizations or users to summarize yet.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.textTheme.bodySmall?.color,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }

      return const SizedBox.shrink();
    }

    Widget statGrid() {
      return LayoutBuilder(
        builder: (context, constraints) {
          // This follows the upstream template's actual behavior:
          // four cards until the mobile layout becomes narrow enough for
          // two columns (<650px).
          final columns = constraints.maxWidth < 650 ? 2 : 4;
          final gap = 16.0;
          final cardWidth =
              (constraints.maxWidth - (columns - 1) * gap) / columns;

          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (final card in cards)
                SizedBox(width: cardWidth, child: card),
            ],
          );
        },
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshDashboard,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          // Upstream dashboard behavior:
          //   >= 850px: main content + storage side-by-side.
          //   <  850px: storage moves below the main content.
          if (!ErpResponsive.isMobile(context))
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      statGrid(),
                      if (_error != null || hasNoData) ...[
                        const SizedBox(height: 16),
                        statusContent(),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  flex: 2,
                  child: StorageDetailsCard(),
                ),
              ],
            )
          else ...[
            statGrid(),
            if (_error != null || hasNoData) ...[
              const SizedBox(height: 16),
              statusContent(),
            ],
            const SizedBox(height: 16),
            const StorageDetailsCard(),
          ],
        ],
      ),
    );
  }
}