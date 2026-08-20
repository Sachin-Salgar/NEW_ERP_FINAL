import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'user_service.dart';

class UserCreateScreen extends StatefulWidget {
  const UserCreateScreen({Key? key}) : super(key: key);

  @override
  State<UserCreateScreen> createState() => _UserCreateScreenState();
}

class _UserCreateScreenState extends State<UserCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _organizationId;
  String? _defaultBranchId;

  final service = GetIt.instance.get<UserService>();
  final orgService = GetIt.instance.get();
  final auth = GetIt.instance.get<AuthService>();

  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // ensure organizations are loaded in organization service
    try {
      final org = GetIt.instance.get<dynamic>();
      // no-op, keeps analyzer quiet
    } catch (_) {}
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final payload = {
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'password': _password.text,
      'organizationId': _organizationId,
      'defaultBranchId': _defaultBranchId,
    };

    final ok = await service.createUser(payload);
    setState(() {
      _loading = false;
    });

    if (ok) {
      Navigator.pop(context);
    } else {
      setState(() {
        _error = 'Failed to create user';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create User')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _username,
                decoration: const InputDecoration(labelText: 'Username'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _password,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (v) => (v == null || v.length < 6) ? 'Min 6 chars' : null,
              ),
              const SizedBox(height: 12),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              const Spacer(),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading ? const CircularProgressIndicator() : const Text('Create'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
