import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';

class LocationSelectionScreen extends StatelessWidget {
  const LocationSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final locations = auth.availableLocations;

    if (locations.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Location access')),
        body: const Center(
          child: Text('No authorized locations were returned by the backend.'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Select location'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: ListView.separated(
          itemCount: locations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final location = locations[index];
            final id = (location['id'] ?? '').toString();
            final name = (location['name'] ?? 'Location').toString();
            final code = (location['code'] ?? '').toString();
            final isActive = auth.selectedLocationId == id;

            return Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: isActive ? Colors.green.shade100 : Colors.grey.shade200,
                  child: Icon(
                    isActive ? Icons.location_on : Icons.pin_drop_outlined,
                    color: isActive ? Colors.green : Colors.grey.shade700,
                  ),
                ),
                title: Text(name),
                subtitle: code.isEmpty ? null : Text(code),
                trailing: isActive ? const Icon(Icons.check) : const Icon(Icons.chevron_right),
                onTap: () async {
                  final ok = await auth.selectLocation(id);
                  if (!context.mounted) return;
                  if (ok) {
                    Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (_) => false);
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
