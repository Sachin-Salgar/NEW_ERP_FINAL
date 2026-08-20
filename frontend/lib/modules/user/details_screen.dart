import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'user_service.dart';

class UserDetailsScreen extends StatefulWidget {
  const UserDetailsScreen({Key? key}) : super(key: key);

  @override
  State<UserDetailsScreen> createState() => _UserDetailsScreenState();
}

class _UserDetailsScreenState extends State<UserDetailsScreen> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();

  Map<String, dynamic>? user;
  bool loading = true;
  String? error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = ModalRoute.of(context)!.settings.arguments as String?;
    if (id != null) {
      _load(id);
    }
  }

  Future<void> _load(String id) async {
    setState(() {
      loading = true;
      error = null;
    });
    final u = await service.getUser(id);
    setState(() {
      user = u;
      loading = false;
    });
  }

  Future<void> _activate() async {
    if (user == null) return;
    final ok = await service.activateUser(user!['id']);
    if (ok) await _load(user!['id']);
  }

  Future<void> _deactivate() async {
    if (user == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Confirm'),
        content: const Text('Deactivate this user?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Deactivate')),
        ],
      ),
    );
    if (confirmed == true) {
      final ok = await service.deactivateUser(user!['id']);
      if (ok) await _load(user!['id']);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('User Details')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : user == null
              ? const Center(child: Text('User not found'))
              : Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Username: ${user!['username'] ?? ''}', style: Theme.of(context).textTheme.subtitle1),
                      const SizedBox(height: 8),
                      Text('Email: ${user!['email'] ?? ''}'),
                      const SizedBox(height: 8),
                      Text('Status: ${user!['status'] ?? ''}'),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          if (auth.hasPermission('user.manage'))
                            ElevatedButton(
                              onPressed: () => Navigator.pushNamed(context, '/users/edit', arguments: user!['id']),
                              child: const Text('Edit'),
                            ),
                          const SizedBox(width: 8),
                          if (auth.hasPermission('user.manage') && user!['status'] != 'active')
                            ElevatedButton(onPressed: _activate, child: const Text('Activate')),
                          const SizedBox(width: 8),
                          if (auth.hasPermission('user.manage') && user!['status'] == 'active')
                            ElevatedButton(onPressed: _deactivate, child: const Text('Deactivate')),
                          const SizedBox(width: 8),
                          if (auth.hasPermission('user.manage'))
                            ElevatedButton(
                                onPressed: () => Navigator.pushNamed(context, '/users/access', arguments: user!['id']),
                                child: const Text('Access')),
                        ],
                      ),
                    ],
                  ),
                ),
    );
  }
}
