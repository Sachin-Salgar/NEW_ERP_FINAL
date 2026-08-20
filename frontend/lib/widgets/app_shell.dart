import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../core/auth/auth_service.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({Key? key, required this.child}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return Scaffold(
      appBar: AppBar(
        title: Text('NEW ERP'),
        actions: [
          if (auth.currentUser != null) Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0),
            child: Center(child: Text(auth.currentUser!['username'] ?? '')),
          ),
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await auth.logout();
              Navigator.of(context).pushReplacementNamed('/login');
            },
          )
        ],
      ),
      drawer: Drawer(
        child: ListView(
          children: [
            DrawerHeader(child: Text('Navigation')),
            ListTile(title: Text('Dashboard'), onTap: () => Navigator.of(context).pushReplacementNamed('/dashboard')),
            ListTile(title: Text('Organizations (placeholder)'), onTap: () {}),
            ListTile(title: Text('Branches (placeholder)'), onTap: () {}),
            ListTile(title: Text('Users (placeholder)'), onTap: () {}),
          ],
        ),
      ),
      body: child,
    );
  }
}
