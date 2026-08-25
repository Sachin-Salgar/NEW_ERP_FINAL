import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';

class OrganizationSelectionScreen extends StatelessWidget {
  const OrganizationSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final organizations = auth.availableOrganizations;

    if (organizations.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Organization access')),
        body: const Center(
          child: Text('No authorized organizations were returned by the backend.'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Select organization'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: ListView.separated(
          itemCount: organizations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final organization = organizations[index];
            final id = (organization['id'] ?? '').toString();
            final name = (organization['name'] ?? 'Organization').toString();
            final code = (organization['code'] ?? '').toString();
            final isActive = auth.selectedOrganizationId == id;

            return Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: isActive ? Colors.blue.shade100 : Colors.grey.shade200,
                  child: Icon(
                    isActive ? Icons.check_circle : Icons.business,
                    color: isActive ? Colors.blue : Colors.grey.shade700,
                  ),
                ),
                title: Text(name),
                subtitle: code.isEmpty ? null : Text(code),
                trailing: isActive ? const Icon(Icons.check) : const Icon(Icons.chevron_right),
                onTap: () async {
                  final ok = await auth.selectOrganization(id);
                  if (!context.mounted) return;
                  if (ok) {
                    final nextRoute = auth.requiresLocationSelection
                        ? '/location-selection'
                        : '/dashboard';
                    Navigator.of(context).pushNamedAndRemoveUntil(nextRoute, (_) => false);
                  }
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
