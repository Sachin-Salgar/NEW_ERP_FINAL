import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../routing/app_router_delegate.dart';
import '../themes/theme_controller.dart';

/// Profile menu containing user profile actions.
/// Tenant context is established by the authenticated backend session.
class ProfileContextMenu extends StatelessWidget {
  const ProfileContextMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final themeController = GetIt.instance.get<ThemeController>();
    return AnimatedBuilder(
      animation: Listenable.merge([auth, themeController]),
      builder: (context, _) {
        final user = auth.currentUser ?? const <String, dynamic>{};
        final name =
            (user['displayName'] ??
                    user['name'] ??
                    user['username'] ??
                    user['email'] ??
                    'User')
                .toString();
        final email = (user['email'] ?? '').toString();
        return PopupMenuButton<String>(
          tooltip: 'Profile',
          offset: const Offset(0, 48),
          onSelected: (value) async {
            if (value == 'theme') {
              await themeController.toggle();
            } else if (value == 'logout') {
              await auth.logout();
              if (context.mounted) {
                final delegate = Router.of(context).routerDelegate;
                if (delegate is AppRouterDelegate) {
                  await delegate.setNewRoutePath('/login');
                }
              }
            } else if (value == 'profile') {
              // Profile page will be wired here when the user-profile module is implemented.
            }
          },
          itemBuilder: (context) => [
            PopupMenuItem<String>(
              enabled: false,
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            const PopupMenuDivider(),
            PopupMenuItem<String>(
              value: 'theme',
              child: Row(
                children: [
                  Icon(
                    themeController.isDark
                        ? Icons.light_mode_outlined
                        : Icons.dark_mode_outlined,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Text(themeController.isDark ? 'Light mode' : 'Dark mode'),
                ],
              ),
            ),
            const PopupMenuDivider(),
            const PopupMenuItem<String>(
              value: 'profile',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.manage_accounts_outlined),
                title: Text('My Profile'),
              ),
            ),
            const PopupMenuItem<String>(
              value: 'logout',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.logout),
                title: Text('Logout'),
              ),
            ),
          ],
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: Theme.of(context).dividerColor.withValues(alpha: .6),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircleAvatar(
                  radius: 16,
                  child: Icon(Icons.person_outline, size: 18),
                ),
                if (MediaQuery.sizeOf(context).width >= 600) ...[
                  const SizedBox(width: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 150),
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
                const Icon(Icons.keyboard_arrow_down),
              ],
            ),
          ),
        );
      },
    );
  }
}
