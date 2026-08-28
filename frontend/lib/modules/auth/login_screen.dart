import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../themes/theme_controller.dart';

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
      Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (route) => false);
      return;
    }
    setState(() { _isSubmitting = false; _errorMessage = 'Incorrect username or password. Please try again.'; });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final themeController = GetIt.instance.get<ThemeController>();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      floatingActionButton: AnimatedBuilder(
        animation: themeController,
        builder: (context, _) => FloatingActionButton(
          mini: true,
          tooltip: themeController.isDark ? 'Switch to light mode' : 'Switch to dark mode',
          onPressed: () => themeController.toggle(),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: Icon(
              themeController.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
              key: ValueKey(themeController.isDark),
            ),
          ),
        ),
      ),
      body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: Container(
          padding: const EdgeInsets.fromLTRB(44, 34, 44, 26),
          decoration: BoxDecoration(
            color: colors.surface,
            border: Border.all(color: colors.outlineVariant, width: 1.2),
            borderRadius: BorderRadius.circular(26),
          ),
          child: Form(key: _formKey, child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 84, height: 84, decoration: BoxDecoration(color: colors.secondaryContainer, borderRadius: BorderRadius.circular(22)), alignment: Alignment.center, child: Text('ERP', style: theme.textTheme.headlineSmall?.copyWith(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: .6, color: colors.onSecondaryContainer))),
            const SizedBox(height: 28),
            Text('Welcome back', textAlign: TextAlign.center, style: theme.textTheme.headlineMedium?.copyWith(fontSize: 34, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text('Sign in to continue to your ERP workspace.', textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(fontSize: 16, color: colors.onSurfaceVariant)),
              ),
            ),
            const SizedBox(height: 28),
            TextFormField(key: const ValueKey('login_identifier_field'), controller: _identifierController, textInputAction: TextInputAction.next, validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your email or username.' : null, decoration: _inputDecoration(theme, 'Email or username', 'you@company.com', Icons.person_outline_rounded)),
            const SizedBox(height: 18),
            TextFormField(key: const ValueKey('login_password_field'), controller: _passwordController, obscureText: _obscurePassword, textInputAction: TextInputAction.done, onFieldSubmitted: (_) => _submit(), validator: (v) => (v ?? '').isEmpty ? 'Enter your password.' : null, decoration: _inputDecoration(theme, 'Password', null, Icons.lock_outline_rounded).copyWith(suffixIcon: IconButton(onPressed: () => setState(() => _obscurePassword = !_obscurePassword), icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined)))),
            const SizedBox(height: 14),
            Row(
              children: [
                Checkbox(value: _rememberMe, visualDensity: VisualDensity.compact, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap, onChanged: _isSubmitting ? null : (v) => setState(() => _rememberMe = v ?? false)),
                const SizedBox(width: 4),
                const Flexible(child: Text('Remember me', maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
                const SizedBox(width: 8),
                TextButton(style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 40), tapTargetSize: MaterialTapTargetSize.shrinkWrap), onPressed: _isSubmitting ? null : () {}, child: const Text('Forgot password?', maxLines: 1, style: TextStyle(fontSize: 14))),
              ],
            ),
            if (_errorMessage != null) ...[const SizedBox(height: 8), Text(_errorMessage!, style: TextStyle(color: Colors.red))],
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 56, child: FilledButton(key: const ValueKey('login_submit_button'), onPressed: _isSubmitting ? null : _submit, child: _isSubmitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2)) : const Text('Sign in', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)))),
            const SizedBox(height: 24),
            Row(children: const [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('OR')), Expanded(child: Divider())]),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 52, child: OutlinedButton.icon(onPressed: _isSubmitting ? null : () {}, icon: const Icon(Icons.account_circle_outlined), label: const Text('Continue with SSO', style: TextStyle(fontSize: 17)))),
            const SizedBox(height: 26),
            Text('Need help? Contact your ERP administrator.', textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant, fontSize: 14)),
          ])),
        ),
      )))),
    );
  }

  InputDecoration _inputDecoration(ThemeData theme, String label, String? hint, IconData icon) => InputDecoration(labelText: label, hintText: hint, prefixIcon: Icon(icon), filled: true, fillColor: theme.colorScheme.surfaceContainerHighest, border: OutlineInputBorder(borderRadius: BorderRadius.circular(18)), contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18));

  @override void dispose() { _identifierController.dispose(); _passwordController.dispose(); super.dispose(); }
}
