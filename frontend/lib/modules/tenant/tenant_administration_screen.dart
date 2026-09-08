import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';

class TenantAdministrationScreen extends StatefulWidget {
  const TenantAdministrationScreen({super.key});
  @override
  State<TenantAdministrationScreen> createState() =>
      _TenantAdministrationScreenState();
}

class _TenantAdministrationScreenState
    extends State<TenantAdministrationScreen> {
  late final ApiClient _api;
  Map<String, dynamic>? _tenant;
  List<dynamic> _members = [];
  List<dynamic> _branches = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = GetIt.instance.get<ApiClient>();
    _load();
  }

  Future<void> _load() async {
    try {
      final tenant = await _api.get('/api/v1/tenants/current');
      final members = await _api.get('/api/v1/tenants/current/members');
      final branches = await _api.get('/api/v1/branches');
      if (mounted)
        setState(() {
          _tenant = jsonDecode(tenant.body)['tenant'] as Map<String, dynamic>;
          _members =
              (jsonDecode(members.body)['members'] as List<dynamic>?) ?? [];
          _branches =
              (jsonDecode(branches.body)['branches'] as List<dynamic>?) ??
              [];
        });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _transition(String action) async {
    final response = await _api.post('/api/v1/tenants/current/$action');
    if (response.statusCode >= 400) throw Exception(response.body);
    await _load();
  }

  Future<void> _updateTenant() async {
    final name = TextEditingController(text: _tenant?['name']?.toString());
    final displayName = TextEditingController(
      text: _tenant?['displayName']?.toString(),
    );
    final updated = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit tenant'),
        content: Column(
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
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _api.patch(
                '/api/v1/tenants/current',
                body: {'name': name.text, 'displayName': displayName.text},
              );
              if (!context.mounted) return;
              if (response.statusCode >= 400) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(response.body)));
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (updated == true) await _load();
  }

  Future<void> _deleteTenant() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete tenant?'),
        content: const Text(
          'Deletion is allowed only when the backend confirms that no protected tenant data remains.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final response = await _api.delete('/api/v1/tenants/current');
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          response.statusCode < 400
              ? 'Tenant deleted.'
              : 'Tenant deletion failed: ${response.body}',
        ),
      ),
    );
    if (response.statusCode < 400) await _load();
  }

  Future<void> _memberAction(String userId, String action) async {
    final response = await _api.post(
      '/api/v1/tenants/current/members/$userId/$action',
    );
    if (response.statusCode >= 400) throw Exception(response.body);
    await _load();
  }

  Future<void> _editMember(Map<String, dynamic> member) async {
    final username = TextEditingController(
      text: member['username']?.toString(),
    );
    final email = TextEditingController(text: member['email']?.toString());
    final updated = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit tenant member'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: username,
              decoration: const InputDecoration(labelText: 'Username'),
            ),
            TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _api.patch(
                '/api/v1/tenants/current/members/${member['id']}',
                body: {'username': username.text, 'email': email.text},
              );
              if (!context.mounted) return;
              if (response.statusCode >= 400) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(response.body)));
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (updated == true) await _load();
  }

  Future<void> _showAccess(Map<String, dynamic> member) async {
    final response = await _api.get(
      '/api/v1/tenants/current/access/${member['id']}',
    );
    if (!mounted) return;
    if (response.statusCode >= 400) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(response.body)));
      return;
    }
    final access =
        (jsonDecode(response.body)['access'] as Map<String, dynamic>?) ?? {};
    final branches = (access['branches'] as List<dynamic>?) ?? [];
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Access: ${member['username']}'),
        content: branches.isEmpty
            ? const Text('No branch access assigned.')
            : SizedBox(
                width: 420,
                child: ListView(
                  shrinkWrap: true,
                  children: branches
                      .map(
                        (branch) => ListTile(
                          title: Text(
                            branch['name']?.toString() ??
                                branch['id'].toString(),
                          ),
                          trailing: IconButton(
                            tooltip: 'Revoke access',
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () async {
                              final revoke = await _api.delete(
                                '/api/v1/users/${member['id']}/branches/${branch['id']}/access',
                              );
                              if (context.mounted && revoke.statusCode < 400) {
                                Navigator.pop(context);
                                await _load();
                              }
                            },
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _grantAccess(String userId, String branchId) async {
    final response = await _api.post(
      '/api/v1/users/$userId/branches/$branchId/access',
    );
    if (response.statusCode >= 400) throw Exception(response.body);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Access granted')));
    }
  }

  Future<void> _showCreateMember() async {
    final username = TextEditingController();
    final email = TextEditingController();
    final password = TextEditingController();
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add tenant member'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: username,
              decoration: const InputDecoration(labelText: 'Username'),
            ),
            TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final response = await _api.post(
                '/api/v1/tenants/current/members',
                body: {
                  'username': username.text,
                  'email': email.text,
                  'password': password.text,
                },
              );
              if (!context.mounted) return;
              if (response.statusCode >= 400) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(response.body)));
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (created == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null)
      return Scaffold(
        body: Center(
          child: Text('Unable to load tenant administration: $_error'),
        ),
      );
    if (_tenant == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: const Text('Tenant Administration')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _tenant!['displayName']?.toString() ??
                    _tenant!['name']?.toString() ??
                    'Tenant',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Wrap(
                children: [
                  IconButton(
                    tooltip: 'Edit tenant',
                    onPressed: _updateTenant,
                    icon: const Icon(Icons.edit_outlined),
                  ),
                  IconButton(
                    tooltip: 'Delete tenant',
                    onPressed: _deleteTenant,
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
            ],
          ),
          Text('Status: ${_tenant!['status']}'),
          Wrap(
            spacing: 8,
            children: [
              if (_tenant!['status'] == 'active')
                FilledButton.tonal(
                  onPressed: () => _transition('suspend'),
                  child: const Text('Suspend'),
                ),
              if (_tenant!['status'] == 'suspended')
                FilledButton.tonal(
                  onPressed: () => _transition('reactivate'),
                  child: const Text('Reactivate'),
                ),
              if (_tenant!['status'] != 'cancelled')
                FilledButton.tonal(
                  onPressed: () => _transition('deactivate'),
                  child: const Text('Deactivate'),
                ),
              if (_tenant!['status'] == 'cancelled')
                FilledButton.tonal(
                  onPressed: () => _transition('activate'),
                  child: const Text('Activate'),
                ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tenant Members',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              FilledButton.icon(
                onPressed: _showCreateMember,
                icon: const Icon(Icons.person_add),
                label: const Text('Add'),
              ),
            ],
          ),
          ..._members.map(
            (member) => ListTile(
              title: Text(member['username']?.toString() ?? ''),
              subtitle: Text(member['email']?.toString() ?? ''),
              trailing: Wrap(
                children: [
                  Text(member['status']?.toString() ?? ''),
                  if (member['status'] == 'active')
                    IconButton(
                      tooltip: 'Deactivate',
                      onPressed: () =>
                          _memberAction(member['id'].toString(), 'deactivate'),
                      icon: const Icon(Icons.pause_circle_outline),
                    ),
                  if (member['status'] != 'active')
                    IconButton(
                      tooltip: 'Activate',
                      onPressed: () =>
                          _memberAction(member['id'].toString(), 'activate'),
                      icon: const Icon(Icons.play_circle_outline),
                    ),
                  IconButton(
                    tooltip: 'Edit member',
                    onPressed: () => _editMember(member),
                    icon: const Icon(Icons.edit_outlined),
                  ),
                  IconButton(
                    tooltip: 'Remove member',
                    onPressed: () =>
                        _memberAction(member['id'].toString(), 'delete'),
                    icon: const Icon(Icons.person_remove_outlined),
                  ),
                  IconButton(
                    tooltip: 'View access',
                    onPressed: () => _showAccess(member),
                    icon: const Icon(Icons.business_outlined),
                  ),
                  if (_branches.isNotEmpty)
                    PopupMenuButton<String>(
                      tooltip: 'Grant branch access',
                      onSelected: (branchId) =>
                          _grantAccess(member['id'].toString(), branchId),
                      itemBuilder: (context) => _branches
                          .map(
                            (branch) => PopupMenuItem<String>(
                              value: branch['id'].toString(),
                              child: Text(branch['name'].toString()),
                            ),
                          )
                          .toList(),
                      icon: const Icon(Icons.add_business_outlined),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
