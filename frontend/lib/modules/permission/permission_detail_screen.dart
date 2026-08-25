import 'package:flutter/material.dart';

class PermissionDetailScreen extends StatelessWidget {
  final String permissionKey;
  const PermissionDetailScreen({Key? key, required this.permissionKey}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Permission')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(permissionKey, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            const Text('Description: (Provided by server if available)'),
            const SizedBox(height: 8),
            const Text('No further metadata available.'),
          ],
        ),
      ),
    );
  }
}
