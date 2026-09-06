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
      if (mounted)
        setState(() {
          _tenant = jsonDecode(tenant.body)['tenant'] as Map<String, dynamic>;
          _members =
              (jsonDecode(members.body)['members'] as List<dynamic>?) ?? [];
        });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
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
          const SizedBox(height: 24),
          const Text(
            'Tenant Members',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          ..._members.map(
            (member) => ListTile(
              title: Text(member['username']?.toString() ?? ''),
              subtitle: Text(member['email']?.toString() ?? ''),
              trailing: Text(member['status']?.toString() ?? ''),
            ),
          ),
        ],
      ),
    );
  }
}
