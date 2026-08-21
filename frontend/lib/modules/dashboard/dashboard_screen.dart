import 'package:flutter/material.dart';

import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import '../../presentation/ui/components/stat_card/erp_stat_card.dart';
import '../../widgets/app_shell.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final user = auth.currentUser;
    final tenant = auth.currentTenantId;
    final username = user != null
        ? (user['username'] ?? user['email'] ?? 'User')
        : 'User';

    final stats = [
      ErpStatCard(
        title: 'Current user',
        value: username,
        icon: Icons.person_outline,
        subtitle: 'Authenticated identity',
        accentColor: Theme.of(context).colorScheme.primary,
      ),
      ErpStatCard(
        title: 'Tenant',
        value: tenant ?? 'Unknown',
        icon: Icons.business_outlined,
        subtitle: 'Active tenant workspace',
        accentColor: Colors.indigo,
      ),
      ErpStatCard(
        title: 'Session',
        value: auth.isAuthenticated ? 'Active' : 'Signed out',
        icon: Icons.verified_user_outlined,
        subtitle: 'Authentication state',
        accentColor: Colors.green,
      ),
    ];

    return AppShell(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ErpPageHeader(
              title: 'Dashboard',
              subtitle: 'Welcome, $username',
              breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard')],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: stats
                  .map((card) => SizedBox(width: 250, child: card))
                  .toList(),
            ),
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ERP Modules',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ActionChip(
                          label: const Text('Organizations'),
                          onPressed: () =>
                              Navigator.of(context).pushNamed('/organizations'),
                        ),
                        ActionChip(
                          label: const Text('Branches'),
                          onPressed: () =>
                              Navigator.of(context).pushNamed('/organizations'),
                        ),
                        ActionChip(
                          label: const Text('Users'),
                          onPressed: () =>
                              Navigator.of(context).pushNamed('/users'),
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
