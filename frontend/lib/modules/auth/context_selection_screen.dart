import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../routing/app_router_delegate.dart';

class ContextSelectionScreen extends StatefulWidget {
  const ContextSelectionScreen({super.key});

  @override
  State<ContextSelectionScreen> createState() => _ContextSelectionScreenState();
}

class _ContextSelectionScreenState extends State<ContextSelectionScreen> {
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _select(PendingLoginContext context) async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    final auth = GetIt.instance.get<AuthService>();
    final baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    );
    final selected = await auth.selectContext(baseUrl, context.contextRef);
    if (!mounted) return;
    if (selected) {
      final delegate = Router.of(this.context).routerDelegate;
      if (delegate is AppRouterDelegate) {
        await delegate.setNewRoutePath(auth.nextPostAuthRoute);
      }
      return;
    }
    setState(() {
      _isSubmitting = false;
      _errorMessage =
          auth.lastLoginError ??
          'This login choice is no longer available. Please sign in again.';
    });
  }

  void _returnToLogin() {
    GetIt.instance.get<AuthService>().cancelPendingSelection();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final auth = GetIt.instance.get<AuthService>();

    if (!auth.hasPendingSelection) {
      return const SizedBox.shrink();
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Card(
              margin: const EdgeInsets.all(20),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Choose your workspace',
                      style: theme.textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'This account can access more than one ERP context. Choose where to continue.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    ...auth.pendingContexts.asMap().entries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: OutlinedButton(
                          key: ValueKey('context_option_${entry.key}'),
                          onPressed: _isSubmitting
                              ? null
                              : () => _select(entry.value),
                          style: OutlinedButton.styleFrom(
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 16,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                entry.value.type == 'platform'
                                    ? Icons.admin_panel_settings_outlined
                                    : Icons.business_outlined,
                              ),
                              const SizedBox(width: 12),
                              Expanded(child: Text(entry.value.label)),
                              if (_isSubmitting)
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              else
                                const Icon(Icons.arrow_forward),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        _errorMessage!,
                        key: const ValueKey('context_selection_error'),
                        style: TextStyle(color: colors.error),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: 8),
                    TextButton(
                      key: const ValueKey('context_selection_back_button'),
                      onPressed: _isSubmitting ? null : _returnToLogin,
                      child: const Text('Back to sign in'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
