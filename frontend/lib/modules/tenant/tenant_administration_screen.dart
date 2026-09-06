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
  List<dynamic> _organizations = [];
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
      final organizations = await _api.get('/api/v1/organizations');
      if (mounted)
        setState(() {
          _tenant = jsonDecode(tenant.body)['tenant'] as Map<String, dynamic>;
          _members =
              (jsonDecode(members.body)['members'] as List<dynamic>?) ?? [];
          _organizations =
              (jsonDecode(organizations.body)['organizations']
                  as List<dynamic>?) ??
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

  Future<void> _memberAction(String userId, String action) async {
    final response = await _api.post(
      '/api/v1/tenants/current/members/$userId/$action',
    );
    if (response.statusCode >= 400) throw Exception(response.body);
    await _load();
  }

  Future<void> _grantAccess(String userId, String organizationId) async {
    final response = await _api.post(
      '/api/v1/tenants/current/access/$userId/organizations/$organizationId',
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
          Text(
            _tenant!['displayName']?.toString() ??
                _tenant!['name']?.toString() ??
                'Tenant',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
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
                  if (_organizations.isNotEmpty)
                    PopupMenuButton<String>(
                      tooltip: 'Grant organization access',
                      onSelected: (organizationId) =>
                          _grantAccess(member['id'].toString(), organizationId),
                      itemBuilder: (context) => _organizations
                          .map(
                            (organization) => PopupMenuItem<String>(
                              value: organization['id'].toString(),
                              child: Text(organization['name'].toString()),
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
