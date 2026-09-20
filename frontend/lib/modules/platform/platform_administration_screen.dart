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
  final _client = GetIt.instance.get<ApiClient>();
  late Future<List<Map<String, dynamic>>> _tenants;
  late Future<Map<String, dynamic>> _overview;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    _tenants = _loadTenants();
    _overview = _loadOverview();
  }

  Future<List<Map<String, dynamic>>> _loadTenants() async {
    final response = await _client.get('/api/v1/platform/tenants');
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

  Future<Map<String, dynamic>> _loadOverview() async {
    Future<List<Map<String, dynamic>>> list(String path, String key) async {
      final response = await _client.get(path);
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
    final policyResponse = await _client.get(
      '/api/v1/platform/security-policy',
    );
    final policy =
        policyResponse.statusCode >= 200 && policyResponse.statusCode < 300
        ? ((jsonDecode(policyResponse.body) as Map<String, dynamic>)['policy']
                  as Map<String, dynamic>? ??
              const {})
        : <String, dynamic>{};
    return {'members': members, 'roles': roles, 'policy': policy};
  }

  Future<void> _runTenantAction(
    Map<String, dynamic> tenant,
    String action,
  ) async {
    final id = tenant['id']?.toString();
    if (id == null || id.isEmpty) return;
    final response = await _client.post(
      '/api/v1/platform/tenants/\$id/\$action',
    );
    if (response.statusCode >= 400 && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(response.body)));
      return;
    }
    if (mounted) {
      setState(_reload);
    }
  }

  Future<void> _deleteTenant(Map<String, dynamic> tenant) async {
    final id = tenant['id']?.toString();
    if (id == null || id.isEmpty) return;
    final name =
        tenant['displayName']?.toString() ?? tenant['name']?.toString() ?? id;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete tenant?'),
        content: Text(
          'This permanently invokes the guarded platform tenant deletion for "$name". Continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final response = await _client.delete('/api/v1/platform/tenants/\$id');
    if (!mounted) return;
    if (response.statusCode >= 400) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(response.body)));
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Tenant deleted.')));
    setState(_reload);
  }

  Future<void> _editTenant(Map<String, dynamic> tenant) async {
    final id = tenant['id']?.toString();
    if (id == null || id.isEmpty) return;
    final name = TextEditingController(text: tenant['name']?.toString() ?? '');
    final displayName = TextEditingController(
      text: tenant['displayName']?.toString() ?? '',
    );
    final timezone = TextEditingController(
      text: tenant['timezone']?.toString() ?? '',
    );
    final currency = TextEditingController(
      text: tenant['currency']?.toString() ?? '',
    );
    final locale = TextEditingController(
      text: tenant['locale']?.toString() ?? '',
    );

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit platform tenant'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: displayName,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
              TextField(
                controller: timezone,
                decoration: const InputDecoration(labelText: 'Timezone'),
              ),
              TextField(
                controller: currency,
                decoration: const InputDecoration(labelText: 'Currency'),
              ),
              TextField(
                controller: locale,
                decoration: const InputDecoration(labelText: 'Locale'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _client.patch(
                '/api/v1/platform/tenants/\$id',
                body: {
                  'name': name.text.trim(),
                  'displayName': displayName.text.trim().isEmpty
                      ? null
                      : displayName.text.trim(),
                  'timezone': timezone.text.trim().isEmpty
                      ? null
                      : timezone.text.trim(),
                  'currency': currency.text.trim().isEmpty
                      ? null
                      : currency.text.trim(),
                  'locale': locale.text.trim().isEmpty
                      ? null
                      : locale.text.trim(),
                },
              );
              if (!dialogContext.mounted) return;
              if (response.statusCode >= 400) {
                ScaffoldMessenger.of(dialogContext)
                    .showSnackBar(SnackBar(content: Text(response.body)));
                return;
              }
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    name.dispose();
    displayName.dispose();
    timezone.dispose();
    currency.dispose();
    locale.dispose();
    if (saved == true && mounted) setState(_reload);
  }

  Future<void> _createTenant() async {
    final name = TextEditingController();
    final displayName = TextEditingController();
    final subdomain = TextEditingController();
    final slug = TextEditingController();
    final branch = TextEditingController();
    final username = TextEditingController();
    final email = TextEditingController();
    final password = TextEditingController();
    final roleCode = TextEditingController(text: 'tenant_admin');
    final roleName = TextEditingController(text: 'Tenant Administrator');

    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Create tenant'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Tenant name *'),
                ),
                TextField(
                  controller: displayName,
                  decoration: const InputDecoration(labelText: 'Display name'),
                ),
                TextField(
                  controller: subdomain,
                  decoration: const InputDecoration(labelText: 'Subdomain *'),
                ),
                TextField(
                  controller: slug,
                  decoration: const InputDecoration(labelText: 'Slug *'),
                ),
                TextField(
                  controller: branch,
                  decoration: const InputDecoration(
                    labelText: 'Default branch *',
                  ),
                ),
                const Divider(),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Initial administrator',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                TextField(
                  controller: username,
                  decoration: const InputDecoration(labelText: 'Username *'),
                ),
                TextField(
                  controller: email,
                  decoration: const InputDecoration(labelText: 'Email *'),
                ),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password *'),
                ),
                const Divider(),
                TextField(
                  controller: roleCode,
                  decoration: const InputDecoration(
                    labelText: 'Administrator role code',
                  ),
                ),
                TextField(
                  controller: roleName,
                  decoration: const InputDecoration(
                    labelText: 'Administrator role name',
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _client.post(
                '/api/v1/platform/tenants',
                body: {
                  'name': name.text.trim(),
                  'displayName': displayName.text.trim().isEmpty
                      ? null
                      : displayName.text.trim(),
                  'subdomain': subdomain.text.trim(),
                  'slug': slug.text.trim(),
                  'administrator': {
                    'username': username.text.trim(),
                    'email': email.text.trim(),
                    'password': password.text,
                  },
                  'branch': {'name': branch.text.trim()},
                  'role': {
                    'code': roleCode.text.trim(),
                    'name': roleName.text.trim(),
                  },
                },
              );
              if (!dialogContext.mounted) return;
              if (response.statusCode < 200 || response.statusCode >= 300) {
                ScaffoldMessenger.of(dialogContext)
                    .showSnackBar(SnackBar(content: Text(response.body)));
                return;
              }
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    for (final controller in [
      name,
      displayName,
      subdomain,
      slug,
      branch,
      username,
      email,
      password,
      roleCode,
      roleName,
    ]) {
      controller.dispose();
    }
    if (created == true && mounted) setState(_reload);
  }

  Future<void> _createRole() async {
    final code = TextEditingController();
    final name = TextEditingController();
    final description = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Create platform role'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: code,
              decoration: const InputDecoration(labelText: 'Code'),
            ),
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: description,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _client.post(
                '/api/v1/platform/roles',
                body: {
                  'code': code.text.trim(),
                  'name': name.text.trim(),
                  'description': description.text.trim().isEmpty
                      ? null
                      : description.text.trim(),
                },
              );
              if (!dialogContext.mounted) return;
              if (response.statusCode == 201) {
                Navigator.pop(dialogContext, true);
              } else {
                ScaffoldMessenger.of(dialogContext)
                    .showSnackBar(SnackBar(content: Text(response.body)));
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
    if (result == true && mounted) setState(_reload);
  }

  Future<void> _updateMember(Map<String, dynamic> member) async {
    var status = member['status']?.toString() ?? 'active';
    final selected = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Platform membership'),
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
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, status),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (selected == null) return;
    final response = await _client.patch(
      '/api/v1/platform/members/${member['id']}',
      body: {'status': selected},
    );
    if (response.statusCode >= 400 && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(response.body)));
    }
    if (mounted) setState(_reload);
  }

  Future<void> _editPolicy(Map<String, dynamic> policy) async {
    final session = TextEditingController(
      text: '${policy['sessionLifetimeMinutes'] ?? 60}',
    );
    final failed = TextEditingController(
      text: '${policy['maxFailedLoginAttempts'] ?? 5}',
    );
    final lockout = TextEditingController(
      text: '${policy['lockoutMinutes'] ?? 15}',
    );
    var mfa = policy['mfaRequired'] == true;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Platform security policy'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                value: mfa,
                title: const Text('Require MFA'),
                onChanged: (value) => setDialogState(() => mfa = value),
              ),
              TextField(
                controller: session,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Session lifetime (minutes)',
                ),
              ),
              TextField(
                controller: failed,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Maximum failed logins',
                ),
              ),
              TextField(
                controller: lockout,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Lockout duration (minutes)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Save'),
            ),
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
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(response.body)));
    }
    if (mounted) setState(_reload);
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

  Widget _tenantCard(Map<String, dynamic> tenant) {
    final status = tenant['status']?.toString() ?? 'unknown';
    final name =
        tenant['displayName']?.toString() ??
        tenant['name']?.toString() ??
        tenant['id']?.toString() ??
        'Tenant';
    return Card(
      child: ListTile(
        title: Text(name),
        subtitle: Text(
          '${tenant['slug'] ?? ''} • ${tenant['subdomain'] ?? ''} • Status: $status',
        ),
        isThreeLine: true,
        trailing: PopupMenuButton<String>(
          tooltip: 'Tenant actions',
          onSelected: (action) {
            if (action == 'edit') {
              _editTenant(tenant);
            } else if (action == 'delete') {
              _deleteTenant(tenant);
            } else {
              _runTenantAction(tenant, action);
            }
          },
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'edit',
              child: ListTile(
                leading: Icon(Icons.edit_outlined),
                title: Text('Edit'),
              ),
            ),
            if (status == 'active')
              const PopupMenuItem(
                value: 'suspend',
                child: ListTile(
                  leading: Icon(Icons.pause_circle_outline),
                  title: Text('Suspend'),
                ),
              ),
            if (status == 'suspended')
              const PopupMenuItem(
                value: 'reactivate',
                child: ListTile(
                  leading: Icon(Icons.play_circle_outline),
                  title: Text('Reactivate'),
                ),
              ),
            if (status != 'active' && status != 'cancelled')
              const PopupMenuItem(
                value: 'activate',
                child: ListTile(
                  leading: Icon(Icons.play_circle_outline),
                  title: Text('Activate'),
                ),
              ),
            if (status == 'active' || status == 'suspended')
              const PopupMenuItem(
                value: 'deactivate',
                child: ListTile(
                  leading: Icon(Icons.block_outlined),
                  title: Text('Deactivate'),
                ),
              ),
            const PopupMenuItem(
              value: 'delete',
              child: ListTile(
                leading: Icon(Icons.delete_outline),
                title: Text('Delete'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Platform Administration'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => setState(_reload),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _tenants,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text(snapshot.error.toString()));
          }
          final tenants = snapshot.data ?? const [];
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Tenants',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _createTenant,
                    icon: const Icon(Icons.add_business_outlined),
                    label: const Text('Create tenant'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (tenants.isEmpty) const Text('No tenants found.'),
              ...tenants.map(_tenantCard),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Platform Members',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(_reload),
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
              FutureBuilder<Map<String, dynamic>>(
                future: _overview,
                builder: (context, memberSnapshot) {
                  if (memberSnapshot.connectionState != ConnectionState.done) {
                    return const LinearProgressIndicator();
                  }
                  if (memberSnapshot.hasError) {
                    return Text(memberSnapshot.error.toString());
                  }
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
                  const Expanded(
                    child: Text(
                      'Platform Roles',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _createRole,
                    icon: const Icon(Icons.add),
                    label: const Text('New role'),
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
                  final policy = Map<String, dynamic>.from(
                    (overview['policy'] as Map?) ?? const {},
                  );
                  return Row(
                    children: [
                      Expanded(child: Text('Policy: \$policy')),
                      TextButton(
                        onPressed: () => _editPolicy(policy),
                        child: const Text('Edit'),
                      ),
                    ],
                  );
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
                  if (snapshot.hasError) {
                    return Text(snapshot.error.toString());
                  }
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
                      if (events.isEmpty)
                        const Text('No platform audit events found.'),
                    ],
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
