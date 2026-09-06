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
            const Text(
              'Platform Members',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
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
                        subtitle: Text(member['status']?.toString() ?? ''),
                      ),
                    if (members.isEmpty)
                      const Text('No platform members found.'),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'Platform Roles',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
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
                return Text('Policy: ${overview['policy'] ?? 'loading'}');
              },
            ),
            const SizedBox(height: 12),
            const Text(
              'Platform Audit',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Audit visibility is restricted to platform context and platform audit permission.',
            ),
          ],
        );
      },
    ),
  );
}
