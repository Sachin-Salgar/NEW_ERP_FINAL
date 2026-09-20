import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/network/api_client.dart';

class MfaScreen extends StatefulWidget {
  const MfaScreen({super.key});
  @override State<MfaScreen> createState() => _MfaScreenState();
}

class _MfaScreenState extends State<MfaScreen> {
  late final ApiClient _api;
  final _code = TextEditingController();
  final _label = TextEditingController();
  final _verify = TextEditingController();
  Map<String, dynamic>? _enrollment;
  List<dynamic> _recovery = [];
  String? _message;
  bool _loading = false;

  @override void initState() { super.initState(); _api = GetIt.instance.get<ApiClient>(); }
  @override void dispose() { _code.dispose(); _label.dispose(); _verify.dispose(); super.dispose(); }

  String _error(dynamic response) {
    try {
      final body = jsonDecode(response.body);
      final nested = body['error'];
      return '${body['message'] ?? (nested is Map ? nested['message'] : nested) ?? 'Request failed.'}';
    } catch (_) { return 'Request failed (HTTP ${response.statusCode}).'; }
  }

  Future<void> _begin() async {
    setState(() => _loading = true);
    try {
      final response = await _api.post('/api/v1/auth/mfa/enroll', body: {
        if (_label.text.trim().isNotEmpty) 'accountLabel': _label.text.trim(),
      });
      if (response.statusCode >= 400) throw Exception(_error(response));
      setState(() => _enrollment = Map<String, dynamic>.from(jsonDecode(response.body) as Map));
    } catch (e) { setState(() => _message = e.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    final token = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(token)) { setState(() => _message = 'Enter the 6-digit authenticator code.'); return; }
    setState(() => _loading = true);
    try {
      final response = await _api.post('/api/v1/auth/mfa/enroll/confirm', body: {'token': token});
      if (response.statusCode >= 400) throw Exception(_error(response));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() { _recovery = (body['recoveryCodes'] as List<dynamic>?) ?? []; _enrollment = null; _code.clear(); _message = 'MFA enrollment confirmed. Store the recovery codes securely.'; });
    } catch (e) { setState(() => _message = e.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _verifyMfa() async {
    final token = _verify.text.trim();
    if (token.length < 6) { setState(() => _message = 'Enter an MFA or recovery code.'); return; }
    setState(() => _loading = true);
    try {
      final response = await _api.post('/api/v1/auth/mfa/verify', body: {'token': token});
      if (response.statusCode >= 400) throw Exception(_error(response));
      setState(() => _message = jsonDecode(response.body)['verified'] == true ? 'MFA verification succeeded.' : 'MFA code was not accepted.');
    } catch (e) { setState(() => _message = e.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _disable() async {
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('Disable MFA?'), content: const Text('This removes MFA protection for your current account.'), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Disable'))]));
    if (ok != true) return;
    final response = await _api.post('/api/v1/auth/mfa/disable');
    if (!mounted) return;
    setState(() => _message = response.statusCode < 400 ? 'MFA disabled.' : _error(response));
  }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Multi-Factor Authentication')),
    body: ListView(padding: const EdgeInsets.all(24), children: [
      const Text('Authenticator setup', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      const Text('Generate a TOTP enrollment secret, add it to your authenticator app, then confirm the 6-digit code.'),
      const SizedBox(height: 16),
      TextField(controller: _label, decoration: const InputDecoration(labelText: 'Authenticator account label (optional)')),
      const SizedBox(height: 12),
      FilledButton.icon(onPressed: _loading ? null : _begin, icon: const Icon(Icons.qr_code_2), label: const Text('Begin MFA enrollment')),
      if (_enrollment != null) ...[
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: SelectableText('Secret: ${_enrollment!['secret']}\n\nAuthenticator URI:\n${_enrollment!['otpauthUri']}\n\nExpires: ${_enrollment!['expiresAt']}'))),
        TextField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(labelText: '6-digit enrollment code')),
        FilledButton(onPressed: _loading ? null : _confirm, child: const Text('Confirm enrollment')),
      ],
      if (_recovery.isNotEmpty) Card(child: Padding(padding: const EdgeInsets.all(16), child: SelectableText('Recovery codes:\n${_recovery.join('\n')}'))),
      const Divider(height: 40),
      const Text('Verify MFA', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
      const SizedBox(height: 8),
      TextField(controller: _verify, decoration: const InputDecoration(labelText: 'MFA / recovery code')),
      const SizedBox(height: 12),
      FilledButton(onPressed: _loading ? null : _verifyMfa, child: const Text('Verify')),
      OutlinedButton(onPressed: _loading ? null : _disable, child: const Text('Disable MFA')),
      if (_message != null) Text(_message!),
    ]),
  );
}
