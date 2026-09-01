import 'package:flutter/material.dart';

import '../../presentation/ui/components/back_button.dart';
import 'permission_metadata.dart';

class PermissionDetailScreen extends StatelessWidget {
  final String permissionKey;
  const PermissionDetailScreen({Key? key, required this.permissionKey}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final descriptor = PermissionDescriptor.fromJson(permissionKey);

    return Scaffold(
      appBar: AppBar(
        leading: SettingsBackButton(
          parentRoute: '/settings/permissions',
          label: 'Back',
        ),
        title: Text(descriptor.displayName),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(descriptor.displayName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Chip(label: Text(descriptor.moduleName)),
            const SizedBox(height: 16),
            Text('Permission key', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            SelectableText(descriptor.permissionKey),
            const SizedBox(height: 16),
            Text('Action', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(descriptor.action.toUpperCase()),
            const SizedBox(height: 16),
            Text('Description', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(descriptor.description ?? 'No description provided for this permission.'),
          ],
        ),
      ),
    );
  }
}
