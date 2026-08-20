import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'user_service.dart';

class UserListScreen extends StatefulWidget {
  const UserListScreen({Key? key}) : super(key: key);

  @override
  State<UserListScreen> createState() => _UserListScreenState();
}

class _UserListScreenState extends State<UserListScreen> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();

  @override
  void initState() {
    super.initState();
    service.fetchUsers();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      body: AnimatedBuilder(
        animation: service,
        builder: (context, _) {
          if (service.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (service.error != null) {
            return Center(child: Text('Error: ${service.error}'));
          }
          if (service.users.isEmpty) {
            return Center(child: Text('No users found'));
          }

          return ListView.separated(
            itemCount: service.users.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final u = service.users[index];
              return ListTile(
                title: Text(u['username'] ?? u['email'] ?? 'Unnamed'),
                subtitle: Text(u['email'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (auth.hasPermission('user.manage'))
                      IconButton(
                        icon: const Icon(Icons.edit),
                        onPressed: () {
                          Navigator.pushNamed(context, '/users/edit', arguments: u['id']);
                        },
                      ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () {
                        Navigator.pushNamed(context, '/users/details', arguments: u['id']);
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: auth.hasPermission('user.manage')
          ? FloatingActionButton(
              child: const Icon(Icons.add),
              onPressed: () => Navigator.pushNamed(context, '/users/create'),
            )
          : null,
    );
  }
}
