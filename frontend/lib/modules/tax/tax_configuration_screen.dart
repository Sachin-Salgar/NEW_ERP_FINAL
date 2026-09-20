import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class TaxConfigurationScreen extends StatefulWidget {
  const TaxConfigurationScreen({super.key});
  @override
  State<TaxConfigurationScreen> createState() => _TaxConfigurationScreenState();
}

class _TaxConfigurationScreenState extends State<TaxConfigurationScreen> {
  late final ApiClient _api;
  late final AuthService _auth;
  List<dynamic> _rules = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _api = GetIt.instance.get<ApiClient>();
    _auth = GetIt.instance.get<AuthService>();
    _load();
  }

  String _message(dynamic r) {
    try {
      final b = jsonDecode(r.body);
      final e = b['error'];
      return '${b['message'] ?? (e is Map ? e['message'] : e) ?? 'Request failed.'}';
    } catch (_) {
      return 'Request failed (HTTP ${r.statusCode}).';
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await _api.get('/api/v1/tax/rules');
      if (r.statusCode >= 400) throw Exception(_message(r));
      setState(
        () => _rules = (jsonDecode(r.body)['rules'] as List<dynamic>?) ?? [],
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save([Map<String, dynamic>? existing]) async {
    final code = TextEditingController(text: '${existing?['code'] ?? ''}');
    final name = TextEditingController(text: '${existing?['name'] ?? ''}');
    final rate = TextEditingController(text: '${existing?['rate'] ?? 0}');
    final from = TextEditingController(
      text: '${existing?['effectiveFrom'] ?? ''}',
    );
    final to = TextEditingController(text: '${existing?['effectiveTo'] ?? ''}');
    final key = GlobalKey<FormState>();
    final result = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(existing == null ? 'Create Tax Rule' : 'Edit Tax Rule'),
        content: Form(
          key: key,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (existing == null)
                  TextFormField(
                    controller: code,
                    decoration: const InputDecoration(labelText: 'Code'),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name'),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                TextFormField(
                  controller: rate,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: 'Rate (%)'),
                  validator: (v) =>
                      num.tryParse(v ?? '') == null ? 'Enter a number' : null,
                ),
                if (existing == null)
                  TextFormField(
                    controller: from,
                    decoration: const InputDecoration(
                      labelText: 'Effective from (YYYY-MM-DD)',
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                if (existing != null)
                  TextFormField(
                    controller: to,
                    decoration: const InputDecoration(
                      labelText: 'Effective to (optional)',
                    ),
                  ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (key.currentState!.validate()) Navigator.pop(c, true);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != true) return;
    final body = {
      'name': name.text.trim(),
      'rate': num.parse(rate.text.trim()),
      if (to.text.trim().isNotEmpty) 'effectiveTo': to.text.trim(),
      if (existing == null) ...{
        'code': code.text.trim(),
        'effectiveFrom': from.text.trim(),
      },
    };
    final r = existing == null
        ? await _api.post('/api/v1/tax/rules', body: body)
        : await _api.patch(
            '/api/v1/tax/rules/${existing['id']}',
            body: {...body, 'expectedVersion': existing['version'] ?? 1},
          );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(r.statusCode < 400 ? 'Tax rule saved.' : _message(r)),
      ),
    );
    if (r.statusCode < 400) await _load();
  }

  Future<void> _transition(Map<String, dynamic> rule, String action) async {
    final r = await _api.post(
      '/api/v1/tax/rules/${rule['id']}/$action',
      body: {'expectedVersion': rule['version'] ?? 1},
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(r.statusCode < 400 ? 'Tax rule updated.' : _message(r)),
      ),
    );
    if (r.statusCode < 400) return;
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (!_auth.hasPermission('tax.configuration.read'))
      return const Scaffold(
        body: Center(
          child: Text('You do not have permission to view tax configuration.'),
        ),
      );
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tax Configuration'),
        actions: [
          if (_auth.hasPermission('tax.configuration.create'))
            IconButton(onPressed: () => _save(), icon: const Icon(Icons.add)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const Text(
                    'Tax Rules',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_rules.isEmpty) const Text('No tax rules configured.'),
                  ..._rules.map((raw) {
                    final r = Map<String, dynamic>.from(raw as Map);
                    final active = '${r['status']}'.toUpperCase() == 'ACTIVE';
                    return Card(
                      child: ListTile(
                        title: Text('${r['code'] ?? ''} — ${r['name'] ?? ''}'),
                        subtitle: Text(
                          'Rate: ${r['rate']}% • ${r['status'] ?? ''} • v${r['version'] ?? ''}',
                        ),
                        trailing: Wrap(
                          children: [
                            if (_auth.hasPermission('tax.configuration.update'))
                              IconButton(
                                onPressed: () => _save(r),
                                icon: const Icon(Icons.edit),
                              ),
                            if (active &&
                                _auth.hasPermission(
                                  'tax.configuration.deactivate',
                                ))
                              IconButton(
                                onPressed: () => _transition(r, 'deactivate'),
                                icon: const Icon(Icons.pause_circle_outline),
                              ),
                            if (!active &&
                                _auth.hasPermission(
                                  'tax.configuration.activate',
                                ))
                              IconButton(
                                onPressed: () => _transition(r, 'activate'),
                                icon: const Icon(Icons.play_circle_outline),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
