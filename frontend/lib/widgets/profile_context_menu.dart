import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../core/auth/auth_service.dart';

/// Profile menu containing user profile actions and working-context switches.
/// Tenant is never selectable here; it is fixed by authentication.
class ProfileContextMenu extends StatelessWidget {
  const ProfileContextMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        final user = auth.currentUser ?? const <String, dynamic>{};
        final name = (user['displayName'] ?? user['name'] ?? user['username'] ?? user['email'] ?? 'User').toString();
        final email = (user['email'] ?? '').toString();
        final currentOrg = auth.currentOrganizationId;
        final currentLocation = auth.currentLocationId;
        final orgLabel = auth.availableOrganizations.where((o) => (o['id'] ?? '').toString() == currentOrg).map((o) => (o['name'] ?? o['code'] ?? currentOrg).toString()).firstOrNull;
        final locationLabel = auth.availableLocations.where((l) => (l['id'] ?? '').toString() == currentLocation).map((l) => (l['name'] ?? l['code'] ?? currentLocation).toString()).firstOrNull;

        return PopupMenuButton<String>(
          tooltip: 'Profile and working context',
          offset: const Offset(0, 48),
          onSelected: (value) async {
            if (value.startsWith('org:')) {
              await auth.selectOrganization(value.substring(4));
            } else if (value.startsWith('location:')) {
              await auth.selectLocation(value.substring(9));
            } else if (value == 'logout') {
              await auth.logout();
              if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
            } else if (value == 'profile') {
              // Profile page will be wired here when the user-profile module is implemented.
            }
          },
          itemBuilder: (context) => [
            PopupMenuItem<String>(enabled: false, child: ListTile(contentPadding: EdgeInsets.zero, leading: const CircleAvatar(child: Icon(Icons.person_outline)), title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis), subtitle: Text(email, maxLines: 1, overflow: TextOverflow.ellipsis))),
            const PopupMenuDivider(),
            const PopupMenuItem<String>(enabled: false, child: Text('WORKING CONTEXT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
            if (auth.availableOrganizations.isNotEmpty)
              PopupMenuItem<String>(enabled: false, child: Text('Organisation: ${orgLabel ?? 'Not selected'}')),
            ...auth.availableOrganizations.map((org) {
              final id = (org['id'] ?? '').toString();
              final label = (org['name'] ?? org['code'] ?? id).toString();
              return PopupMenuItem<String>(value: 'org:$id', child: Row(children: [Icon(id == currentOrg ? Icons.check : Icons.business_outlined, size: 19), const SizedBox(width: 10), Expanded(child: Text(label, overflow: TextOverflow.ellipsis))]));
            }),
            const PopupMenuDivider(),
            if (auth.availableLocations.isNotEmpty)
              PopupMenuItem<String>(enabled: false, child: Text('Location: ${locationLabel ?? 'Not selected'}')),
            ...auth.availableLocations.map((location) {
              final id = (location['id'] ?? '').toString();
              final label = (location['name'] ?? location['code'] ?? id).toString();
              return PopupMenuItem<String>(value: 'location:$id', child: Row(children: [Icon(id == currentLocation ? Icons.check : Icons.location_on_outlined, size: 19), const SizedBox(width: 10), Expanded(child: Text(label, overflow: TextOverflow.ellipsis))]));
            }),
            const PopupMenuDivider(),
            const PopupMenuItem<String>(value: 'profile', child: ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.manage_accounts_outlined), title: Text('My Profile'))),
            const PopupMenuItem<String>(value: 'logout', child: ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.logout), title: Text('Logout'))),
          ],
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: Row(mainAxisSize: MainAxisSize.min, children: [const CircleAvatar(radius: 16, child: Icon(Icons.person_outline, size: 18)), const SizedBox(width: 7), Flexible(child: Text(name, overflow: TextOverflow.ellipsis)), const SizedBox(width: 4), const Icon(Icons.keyboard_arrow_down)])),
        );
      },
    );
  }
}
