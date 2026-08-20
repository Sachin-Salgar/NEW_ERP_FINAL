import 'package:flutter/material.dart';
import '../../widgets/app_shell.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final user = auth.currentUser;
    final tenant = auth.currentTenantId;

    return AppShell(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Welcome, ${user != null ? (user['username'] ?? user['email'] ?? '') : 'User'}', style: Theme.of(context).textTheme.headline5),
            SizedBox(height: 8),
            Text('Tenant: ${tenant ?? 'Unknown'}'),
            SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CORE-01 Modules (placeholders)', style: Theme.of(context).textTheme.subtitle1),
                    SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        ActionChip(label: Text('Organizations'), onPressed: () => Navigator.of(context).pushNamed('/organizations')),
                        Chip(label: Text('Branches')),
                        Chip(label: Text('Users')),
                        Chip(label: Text('RBAC')),
                      ],
                    )
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
