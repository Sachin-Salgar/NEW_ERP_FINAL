import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);
  @override State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  bool _obscurePassword = true;
  bool _rememberMe = true;
  String? _errorMessage;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _isSubmitting = true; _errorMessage = null; });
    final auth = GetIt.instance.get<AuthService>();
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    final ok = await auth.login(baseUrl, _identifierController.text.trim(), _passwordController.text);
    if (!mounted) return;
    if (ok) {
      // AuthService.login already stores the authenticated identity and resolves
      // the user's tenant/default working context. Do not issue a second /auth/me
      // request here; it can race the context initialization completed by login().
      // Organization/location remain working-context controls, never login gates.
      Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
      return;
    }
    setState(() { _isSubmitting = false; _errorMessage = 'Incorrect username or password. Please try again.'; });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFEFEFF2),
      body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: Container(
          padding: const EdgeInsets.fromLTRB(44, 34, 44, 26),
          decoration: BoxDecoration(color: const Color(0xFFF1F3F5), border: Border.all(color: const Color(0xFFD8DDE6), width: 1.2), borderRadius: BorderRadius.circular(26)),
          child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 84, height: 84, decoration: BoxDecoration(color: const Color(0xFFDDE3EA), borderRadius: BorderRadius.circular(22)), alignment: Alignment.center, child: Text('ERP', style: theme.textTheme.headlineSmall?.copyWith(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: .6, color: const Color(0xFF2A5E8E)))),
            const SizedBox(height: 28),
            Text('Welcome back', textAlign: TextAlign.center, style: theme.textTheme.headlineMedium?.copyWith(fontSize: 34, fontWeight: FontWeight.w700, color: const Color(0xFF1B2737))),
            const SizedBox(height: 10),
            Text('Sign in to continue to your ERP workspace.', textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(fontSize: 18, color: const Color(0xFF667085))),
            const SizedBox(height: 28),
            TextFormField(key: const ValueKey('login_identifier_field'), controller: _identifierController, textInputAction: TextInputAction.next, validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your email or username.' : null, decoration: _inputDecoration('Email or username', 'you@company.com', Icons.person_outline_rounded)),
            const SizedBox(height: 18),
            TextFormField(key: const ValueKey('login_password_field'), controller: _passwordController, obscureText: _obscurePassword, textInputAction: TextInputAction.done, onFieldSubmitted: (_) => _submit(), validator: (v) => (v ?? '').isEmpty ? 'Enter your password.' : null, decoration: _inputDecoration('Password', null, Icons.lock_outline_rounded).copyWith(suffixIcon: IconButton(onPressed: () => setState(() => _obscurePassword = !_obscurePassword), icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined)))),
            const SizedBox(height: 14),
            Row(children: [Checkbox(value: _rememberMe, onChanged: _isSubmitting ? null : (v) => setState(() => _rememberMe = v ?? false)), const Expanded(child: Text('Remember me', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500))), TextButton(onPressed: _isSubmitting ? null : () {}, child: const Text('Forgot password?'))]),
            if (_errorMessage != null) ...[const SizedBox(height: 8), Text(_errorMessage!, style: TextStyle(color: Colors.red))],
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 56, child: FilledButton(key: const ValueKey('login_submit_button'), onPressed: _isSubmitting ? null : _submit, child: _isSubmitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white)) : const Text('Sign in', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)))),
            const SizedBox(height: 24),
            Row(children: const [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('OR')), Expanded(child: Divider())]),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 52, child: OutlinedButton.icon(onPressed: _isSubmitting ? null : () {}, icon: const Icon(Icons.account_circle_outlined), label: const Text('Continue with SSO', style: TextStyle(fontSize: 17)))),
            const SizedBox(height: 26),
            Text('Need help? Contact your ERP administrator.', textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(color: const Color(0xFF677184), fontSize: 14)),
          ])),
        ),
      )))),
    );
  }

  InputDecoration _inputDecoration(String label, String? hint, IconData icon) => InputDecoration(labelText: label, hintText: hint, prefixIcon: Icon(icon), filled: true, fillColor: const Color(0xFFE8EBF0), border: OutlineInputBorder(borderRadius: BorderRadius.circular(18)), contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18));
  @override void dispose() { _identifierController.dispose(); _passwordController.dispose(); super.dispose(); }
}
