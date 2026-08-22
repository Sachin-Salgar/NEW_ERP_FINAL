import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'user_service.dart';

class UserEditScreen extends StatefulWidget {
  const UserEditScreen({Key? key}) : super(key: key);

  @override
  State<UserEditScreen> createState() => _UserEditScreenState();
}

class _UserEditScreenState extends State<UserEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  String? _organizationId;
  String? _defaultBranchId;

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
      if (user != null) {
        _username.text = user!['username'] ?? '';
        _email.text = user!['email'] ?? '';
        _organizationId = user!['organizationId'] as String?;
        _defaultBranchId = user!['defaultBranchId'] as String?;
      }
      loading = false;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || user == null) return;
    setState(() {
      error = null;
    });
    final payload = {
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'organizationId': _organizationId,
      'defaultBranchId': _defaultBranchId,
    };
    final ok = await service.updateUser(user!['id'], payload);
    if (ok)
      Navigator.pop(context);
    else
      setState(() => error = 'Failed to update');
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit User')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : user == null
          ? const Center(child: Text('User not found'))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _username,
                      decoration: const InputDecoration(labelText: 'Username'),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Required' : null,
                    ),
                    TextFormField(
                      controller: _email,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Required' : null,
                    ),
                    const Spacer(),
                    if (error != null)
                      Text(error!, style: const TextStyle(color: Colors.red)),
                    ElevatedButton(
                      onPressed: _submit,
                      child: const Text('Save'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
