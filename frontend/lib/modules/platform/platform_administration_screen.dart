import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';

class PlatformAdministrationScreen extends StatefulWidget {
  const PlatformAdministrationScreen({super.key});
  @override
  State<PlatformAdministrationScreen> createState() =>
      _PlatformAdministrationScreenState();
}

class _PlatformAdministrationScreenState
    extends State<PlatformAdministrationScreen> {
  late Future<List<Map<String, dynamic>>> _tenants;
  late Future<Map<String, dynamic>> _overview;
  final _client = GetIt.instance.get<ApiClient>();

  @override
  void initState() {
    super.initState();
    _tenants = _loadTenants();
    _overview = _loadOverview();
  }

  Future<Map<String, dynamic>> _loadOverview() async {
    final client = GetIt.instance.get<ApiClient>();
    Future<List<Map<String, dynamic>>> list(String path, String key) async {
      final response = await client.get(path);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Platform access denied (${response.statusCode}).');
      }
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      return (decoded[key] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }

    final members = await list('/api/v1/platform/members', 'members');
    final roles = await list('/api/v1/platform/roles', 'roles');
    final policyResponse = await client.get('/api/v1/platform/security-policy');
    final policy =
        policyResponse.statusCode >= 200 && policyResponse.statusCode < 300
        ? ((jsonDecode(policyResponse.body) as Map<String, dynamic>)['policy']
                  as Map<String, dynamic>? ??
              const {})
        : <String, dynamic>{};
    return {'members': members, 'roles': roles, 'policy': policy};
  }

  Future<List<Map<String, dynamic>>> _loadTenants() async {
    final response = await GetIt.instance.get<ApiClient>().get(
      '/api/v1/platform/tenants',
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Platform tenant access denied (${response.statusCode}).',
      );
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['tenants'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Platform Administration')),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: _tenants,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError)
          return Center(child: Text(snapshot.error.toString()));
        final tenants = snapshot.data ?? const [];
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text(
              'Tenants',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            for (final tenant in tenants)
              Card(
                child: ListTile(
                  title: Text('${tenant['name'] ?? ''}'),
                  subtitle: Text('${tenant['status'] ?? ''}'),
                  trailing: Text('${tenant['slug'] ?? ''}'),
                ),
              ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Platform Members',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(onPressed: _reload, icon: const Icon(Icons.refresh)),
              ],
            FutureBuilder<Map<String, dynamic>>(
              future: _overview,
              builder: (context, memberSnapshot) {
                if (memberSnapshot.connectionState != ConnectionState.done)
                  return const LinearProgressIndicator();
                if (memberSnapshot.hasError)
                  return Text(memberSnapshot.error.toString());
                final members =
                    (memberSnapshot.data?['members'] as List<dynamic>? ??
                    const []);
                return Column(
                  children: [
                    for (final member
                        in members.whereType<Map<String, dynamic>>())
                      ListTile(
                        title: Text(member['identityId']?.toString() ?? ''),
                        subtitle: Text(
                          '${member['status'] ?? ''} • Roles: ${member['roles'] ?? ''}',
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.edit_outlined),
                          onPressed: () => _updateMember(member),
                        ),
                      ),
                    if (members.isEmpty)
                      const Text('No platform members found.'),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Platform Roles',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                FilledButton.icon(
                  onPressed: _createRole,
                  icon: const Icon(Icons.add),
                  label: const Text('New Role'),
                ),
              ],
            ),
            FutureBuilder<Map<String, dynamic>>(
              future: _overview,
              builder: (context, overviewSnapshot) {
                final overview =
                    overviewSnapshot.data ?? const <String, dynamic>{};
                return Text(
                  '${(overview['roles'] as List<dynamic>? ?? const []).length} platform roles available.',
                );
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'Platform Security',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            FutureBuilder<Map<String, dynamic>>(
              future: _overview,
              builder: (context, overviewSnapshot) {
                final overview =
                    overviewSnapshot.data ?? const <String, dynamic>{};
                final policy = Map<String, dynamic>.from((overview['policy'] as Map?) ?? const {}); return Row(children:[Expanded(child:Text('Policy: $policy')),TextButton(onPressed:()=>_editPolicy(policy),child:const Text('Edit'))]);
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'Platform Audit',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _loadAudit(),
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const LinearProgressIndicator();
                }
                if (snapshot.hasError) return Text(snapshot.error.toString());
                final events = snapshot.data ?? const [];
                return Column(
                  children: [
                    for (final event in events.take(50))
                      ListTile(
                        dense: true,
                        title: Text('${event['action'] ?? ''}'),
                        subtitle: Text(
                          '${event['resourceType'] ?? ''} • ${event['resourceId'] ?? ''} • ${event['createdAt'] ?? ''}',
                        ),
                      ),
                    if (events.isEmpty) const Text('No platform audit events found.'),
                  ],
                );
              },
            ),
          ],
        );
      },
    ),
  );
  Future<void> _reload() async {
    setState(() {
      _tenants = _loadTenants();
      _overview = _loadOverview();
    });
  }

  Future<void> _createRole() async {
    final code = TextEditingController();
    final name = TextEditingController();
    final description = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Create Platform Role'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: code, decoration: const InputDecoration(labelText: 'Code')),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
            TextField(controller: description, decoration: const InputDecoration(labelText: 'Description')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              final response = await _client.post(
                '/api/v1/platform/roles',
                body: {
                  'code': code.text.trim(),
                  'name': name.text.trim(),
                  'description': description.text.trim().isEmpty ? null : description.text.trim(),
                },
              );
              if (!dialogContext.mounted) return;
              if (response.statusCode == 201) {
                Navigator.pop(dialogContext, true);
              } else {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  SnackBar(content: Text(response.body)),
                );
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    code.dispose();
    name.dispose();
    description.dispose();
    if (result == true) _reload();
  }

  Future<void> _updateMember(Map<String, dynamic> member) async {
    var status = member['status']?.toString() ?? 'active';
    final selected = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Platform Membership'),
        content: DropdownButtonFormField<String>(
          initialValue: status,
          items: const [
            DropdownMenuItem(value: 'active', child: Text('Active')),
            DropdownMenuItem(value: 'suspended', child: Text('Suspended')),
            DropdownMenuItem(value: 'revoked', child: Text('Revoked')),
          ],
          onChanged: (value) => status = value ?? status,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, status), child: const Text('Save')),
        ],
      ),
    );
    if (selected == null) return;
    final response = await _client.patch(
      '/api/v1/platform/members/${member['id']}',
      body: {'status': selected},
    );
    if (response.statusCode >= 400 && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response.body)),
      );
    }
    _reload();
  }

  Future<void> _editPolicy(Map<String, dynamic> policy) async {
    final session = TextEditingController(text: '${policy['sessionLifetimeMinutes'] ?? 60}');
    final failed = TextEditingController(text: '${policy['maxFailedLoginAttempts'] ?? 5}');
    final lockout = TextEditingController(text: '${policy['lockoutMinutes'] ?? 15}');
    var mfa = policy['mfaRequired'] == true;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Platform Security Policy'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                value: mfa,
                title: const Text('Require MFA'),
                onChanged: (value) => setState(() => mfa = value),
              ),
              TextField(controller: session, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Session lifetime (minutes)')),
              TextField(controller: failed, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Maximum failed logins')),
              TextField(controller: lockout, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Lockout duration (minutes)')),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (result != true) return;
    final response = await _client.patch(
      '/api/v1/platform/security-policy',
      body: {
        'mfaRequired': mfa,
        'sessionLifetimeMinutes': int.tryParse(session.text),
        'maxFailedLoginAttempts': int.tryParse(failed.text),
        'lockoutMinutes': int.tryParse(lockout.text),
      },
    );
    session.dispose();
    failed.dispose();
    lockout.dispose();
    if (response.statusCode >= 400 && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(response.body)));
    }
    _reload();
  }

  Future<List<Map<String, dynamic>>> _loadAudit() async {
    final response = await _client.get('/api/v1/platform/audit');
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Platform audit access denied (${response.statusCode}).');
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['events'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

}
