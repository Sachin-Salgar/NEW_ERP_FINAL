import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../presentation/ui/components/navigation_sidebar.dart';
import '../presentation/ui/components/topbar.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({Key? key, required this.child}) : super(key: key);

  void _handleNavigate(BuildContext context, String route) {
    Navigator.of(context).pushReplacementNamed(route);
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final width = MediaQuery.of(context).size.width;

    // Desktop layout: persistent sidebar + topbar
    if (width >= 800) {
      return Scaffold(
        body: Row(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border(
                  right: BorderSide(
                    color: Theme.of(context).dividerColor,
                    width: 1,
                  ),
                ),
              ),
              child: Sidebar(
                selectedRoute: ModalRoute.of(context)?.settings.name ?? '/',
                onSelect: (r) => _handleNavigate(context, r),
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  TopBar(
                    title: 'NEW ERP',
                    actions: [
                      if (auth.currentUser != null)
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 8.0),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12.0,
                            vertical: 6.0,
                          ),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Theme.of(context).dividerColor,
                            ),
                          ),
                          child: Center(
                            child: Text(auth.currentUser!['username'] ?? ''),
                          ),
                        ),
                      IconButton(
                        icon: const Icon(Icons.logout),
                        onPressed: () async {
                          await auth.logout();
                          Navigator.of(context).pushReplacementNamed('/login');
                        },
                      ),
                    ],
                  ),
                  Expanded(child: child),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Mobile layout: keep existing scaffold with drawer
    return Scaffold(
      appBar: AppBar(
        title: const Text('NEW ERP'),
        actions: [
          if (auth.currentUser != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: Center(child: Text(auth.currentUser!['username'] ?? '')),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await auth.logout();
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          children: [
            const DrawerHeader(child: Text('Navigation')),
            ListTile(
              title: const Text('Dashboard'),
              onTap: () =>
                  Navigator.of(context).pushReplacementNamed('/dashboard'),
            ),
            const ListTile(
              title: Text('Organizations (placeholder)'),
              onTap: null,
            ),
            const ListTile(title: Text('Branches (placeholder)'), onTap: null),
            const ListTile(title: Text('Users (placeholder)'), onTap: null),
          ],
        ),
      ),
      body: child,
    );
  }
}
