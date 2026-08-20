import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    final auth = GetIt.instance.get<AuthService>();
    // For now, baseUrl and tenantId should be configured via dart-define or environment
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001');
    final tenantId = const String.fromEnvironment('TENANT_ID', defaultValue: 'local-tenant');
    final ok = await auth.login(baseUrl, tenantId, _identifierController.text.trim(), _passwordController.text);
    setState(() { _loading = false; });
    if (ok) {
      await auth.loadMe(baseUrl);
      Navigator.of(context).pushReplacementNamed('/dashboard');
    } else {
      setState(() { _error = 'Login failed'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(controller: _identifierController, decoration: InputDecoration(labelText: 'Username or email')),
            TextField(controller: _passwordController, decoration: InputDecoration(labelText: 'Password'), obscureText: true),
            SizedBox(height: 12),
            if (_error != null) Text(_error!, style: TextStyle(color: Colors.red)),
            ElevatedButton(onPressed: _loading ? null : _submit, child: _loading ? CircularProgressIndicator() : Text('Login'))
          ],
        ),
      ),
    );
  }
}
