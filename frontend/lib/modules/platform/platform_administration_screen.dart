import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/network/api_client.dart';

class PlatformAdministrationScreen extends StatefulWidget {
  const PlatformAdministrationScreen({super.key});
  @override
  State<PlatformAdministrationScreen> createState() => _PlatformAdministrationScreenState();
}

class _PlatformAdministrationScreenState extends State<PlatformAdministrationScreen>
    with SingleTickerProviderStateMixin {
  final _client = GetIt.instance.get<ApiClient>();
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _tenants = [];
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _identities = [];
  List<Map<String, dynamic>> _roles = [];
  List<Map<String, dynamic>> _permissions = [];
  List<Map<String, dynamic>> _audit = [];
  Map<String, dynamic> _policy = {};

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 6, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _list(Map<String, dynamic> value, String key) =>
      (value[key] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().toList();

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client.get(path);
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await Future.wait([
        _get('/api/v1/platform/tenants'),
        _get('/api/v1/platform/members'),
        _get('/api/v1/platform/identities'),
        _get('/api/v1/platform/roles'),
        _get('/api/v1/platform/permissions'),
        _get('/api/v1/platform/security-policy'),
        _get('/api/v1/platform/audit'),
      ]);
      if (!mounted) return;
      setState(() {
        _tenants = _list(r[0], 'tenants');
        _members = _list(r[1], 'members');
        _identities = _list(r[2], 'identities');
        _roles = _list(r[3], 'roles');
        _permissions = _list(r[4], 'permissions');
        _policy = Map<String, dynamic>.from((r[5]['policy'] as Map?) ?? const {});
        _audit = _list(r[6], 'events');
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  InputDecoration _input(String label) => InputDecoration(
        labelText: label, border: const OutlineInputBorder(), isDense: true);
  Widget _field(TextEditingController c, String label, {bool password = false}) =>
      Padding(padding: const EdgeInsets.only(bottom: 12),
        child: TextField(controller: c, obscureText: password, decoration: _input(label)));

  Future<void> _createTenant() async {
    final name = TextEditingController();
    final display = TextEditingController();
    final subdomain = TextEditingController();
    final slug = TextEditingController();
    final branch = TextEditingController(text: 'Head Office');
    final username = TextEditingController();
    final email = TextEditingController();
    final password = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Create tenant'),
        content: SizedBox(width: 560, child: SingleChildScrollView(child: Column(children: [
          _field(name, 'Tenant name *'), _field(display, 'Display name'),
          _field(subdomain, 'Subdomain *'), _field(slug, 'Slug *'),
          _field(branch, 'Default branch *'), const Divider(height: 24),
          const Align(alignment: Alignment.centerLeft,
              child: Text('Initial administrator', style: TextStyle(fontWeight: FontWeight.bold))),
          const SizedBox(height: 12), _field(username, 'Username *'),
          _field(email, 'Email *'), _field(password, 'Password *', password: true),
        ]))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                final response = await _client.post('/api/v1/platform/tenants', body: {
                  'name': name.text.trim(),
                  'displayName': display.text.trim().isEmpty ? null : display.text.trim(),
                  'subdomain': subdomain.text.trim(), 'slug': slug.text.trim(),
                  'branch': {'name': branch.text.trim()},
                  'administrator': {'username': username.text.trim(), 'email': email.text.trim(), 'password': password.text},
                });
                if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                if (dialog.mounted) Navigator.pop(dialog, true);
              } catch (e) {
                if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    for (final c in [name, display, subdomain, slug, branch, username, email, password]) c.dispose();
    if (result == true) await _load();
  }

  Future<void> _editTenant(Map<String, dynamic> tenant) async {
    final name = TextEditingController(text: tenant['name']?.toString() ?? '');
    final display = TextEditingController(text: tenant['displayName']?.toString() ?? '');
    final timezone = TextEditingController(text: tenant['timezone']?.toString() ?? '');
    final currency = TextEditingController(text: tenant['currency']?.toString() ?? '');
    final locale = TextEditingController(text: tenant['locale']?.toString() ?? '');
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Edit tenant'),
        content: SizedBox(width: 520, child: Column(mainAxisSize: MainAxisSize.min, children: [
          _field(name, 'Name'), _field(display, 'Display name'), _field(timezone, 'Timezone'),
          _field(currency, 'Currency'), _field(locale, 'Locale'),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                final response = await _client.patch('/api/v1/platform/tenants/' + tenant['id'], body: {
                  'name': name.text.trim(),
                  'displayName': display.text.trim().isEmpty ? null : display.text.trim(),
                  'timezone': timezone.text.trim().isEmpty ? null : timezone.text.trim(),
                  'currency': currency.text.trim().isEmpty ? null : currency.text.trim(),
                  'locale': locale.text.trim().isEmpty ? null : locale.text.trim(),
                });
                if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                if (dialog.mounted) Navigator.pop(dialog, true);
              } catch (e) {
                if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    for (final c in [name, display, timezone, currency, locale]) c.dispose();
    if (result == true) await _load();
  }

  Future<void> _manageModules(Map<String, dynamic> tenant) async {
    try {
      final data = await _get('/api/v1/platform/tenants/' + tenant['id'] + '/modules');
      var modules = _list(data, 'modules');
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text('Module entitlements • ' + (tenant['displayName']?.toString() ?? tenant['name']?.toString() ?? 'Tenant')),
            content: SizedBox(width: 700, height: 540, child: ListView(children: [
              const Text('Core modules are mandatory. Optional modules can be enabled or disabled for this tenant.'),
              const SizedBox(height: 12),
              for (final module in modules)
                Card(child: SwitchListTile(
                  value: module['enabled'] == true,
                  onChanged: module['isCore'] == true ? null : (enabled) async {
                    try {
                      final response = await _client.patch(
                        '/api/v1/platform/tenants/' + tenant['id'] + '/modules/' + module['code'],
                        body: {'enabled': enabled});
                      if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                      modules = _list(await _get('/api/v1/platform/tenants/' + tenant['id'] + '/modules'), 'modules');
                      if (dialog.mounted) setDialogState(() {});
                    } catch (e) {
                      if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
                    }
                  },
                  secondary: Icon(module['isCore'] == true ? Icons.lock_outline : Icons.extension_outlined),
                  title: Text(module['name']?.toString() ?? ''),
                  subtitle: Text((module['code']?.toString() ?? '') + ' • ' + (module['description']?.toString() ?? 'No description')),
                )),
            ])),
            actions: [TextButton(onPressed: () => Navigator.pop(dialog), child: const Text('Done'))],
          ),
        ),
      );
    } catch (e) { _errorSnack(e); }
  }

  Future<void> _tenantActions(Map<String, dynamic> tenant) async {
    final status = tenant['status']?.toString() ?? '';
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (sheet) => SafeArea(child: Wrap(children: [
        ListTile(leading: const Icon(Icons.extension_outlined), title: const Text('Manage modules'), onTap: () => Navigator.pop(sheet, 'modules')),
        ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Edit tenant'), onTap: () => Navigator.pop(sheet, 'edit')),
        if (status == 'active') ListTile(leading: const Icon(Icons.pause_circle_outline), title: const Text('Suspend'), onTap: () => Navigator.pop(sheet, 'suspend')),
        if (status == 'suspended') ListTile(leading: const Icon(Icons.play_circle_outline), title: const Text('Reactivate'), onTap: () => Navigator.pop(sheet, 'reactivate')),
        if (status != 'active' && status != 'cancelled') ListTile(leading: const Icon(Icons.play_arrow_outlined), title: const Text('Activate'), onTap: () => Navigator.pop(sheet, 'activate')),
        if (status == 'active' || status == 'suspended') ListTile(leading: const Icon(Icons.block_outlined), title: const Text('Deactivate'), onTap: () => Navigator.pop(sheet, 'deactivate')),
        ListTile(leading: const Icon(Icons.delete_outline), title: const Text('Delete tenant'), onTap: () => Navigator.pop(sheet, 'delete')),
      ])),
    );
    if (action == null) return;
    try {
      if (action == 'modules') return _manageModules(tenant);
      if (action == 'edit') return _editTenant(tenant);
      if (action == 'delete') {
        final ok = await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
            title: const Text('Delete tenant?'),
            content: Text('Delete ' + (tenant['displayName']?.toString() ?? tenant['name']?.toString() ?? 'this tenant') + '?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Delete')),
            ],
          ),
        );
        if (ok == true) {
          final response = await _client.delete('/api/v1/platform/tenants/' + tenant['id']);
          if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
          await _load();
        }
        return;
      }
      final response = await _client.post('/api/v1/platform/tenants/' + tenant['id'] + '/' + action);
      if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
      await _load();
    } catch (e) { _errorSnack(e); }
  }

  Future<void> _createMember() async {
    if (_identities.isEmpty) {
      _errorSnack('No eligible active identities are available.');
      return;
    }
    final selectedIdentity = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Add platform member'),
        content: SizedBox(
          width: 560,
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final identity in _identities)
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(identity['username']?.toString() ??
                      identity['email']?.toString() ??
                      identity['id'].toString()),
                  subtitle: Text(identity['email']?.toString() ?? identity['id'].toString()),
                  onTap: () => Navigator.pop(dialog, identity['id'].toString()),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog), child: const Text('Cancel')),
        ],
      ),
    );
    if (selectedIdentity == null) return;
    try {
      final response = await _client.post(
        '/api/v1/platform/members',
        body: {
          'identityId': selectedIdentity,
          'roleIds': _roles.where((r) => r['isSystem'] == true).map((r) => r['id']).toList(),
        },
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(response.body);
      }
      await _load();
    } catch (e) {
      _errorSnack(e);
    }
  }

  Future<void> _editMember(Map<String, dynamic> member) async {
    var status = member['status']?.toString() ?? 'active';
    final selectedRoles = <String>{
      for (final role in (member['roleDetails'] as List<dynamic>? ?? const []))
        if (role is Map && role['id'] != null) role['id'].toString(),
    };
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Platform membership'),
          content: SizedBox(
            width: 620,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: _input('Status'),
                  items: const [
                    DropdownMenuItem(value: 'active', child: Text('Active')),
                    DropdownMenuItem(value: 'suspended', child: Text('Suspended')),
                    DropdownMenuItem(value: 'revoked', child: Text('Revoked')),
                  ],
                  onChanged: (value) => setDialogState(() => status = value ?? status),
                ),
                const SizedBox(height: 12),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Platform roles', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                SizedBox(
                  height: 280,
                  child: ListView(
                    children: [
                      for (final role in _roles)
                        CheckboxListTile(
                          value: selectedRoles.contains(role['id']?.toString()),
                          title: Text(role['name']?.toString() ?? ''),
                          subtitle: Text(role['code']?.toString() ?? ''),
                          onChanged: (value) {
                            final id = role['id']?.toString();
                            if (id == null) return;
                            setDialogState(() {
                              if (value == true) {
                                selectedRoles.add(id);
                              } else {
                                selectedRoles.remove(id);
                              }
                            });
                          },
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  final response = await _client.patch(
                    '/api/v1/platform/members/' + member['id'],
                    body: {'status': status, 'roleIds': selectedRoles.toList()},
                  );
                  if (response.statusCode < 200 || response.statusCode >= 300) {
                    throw Exception(response.body);
                  }
                  if (dialog.mounted) Navigator.pop(dialog, true);
                } catch (e) {
                  if (dialog.mounted) {
                    ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (result == true) await _load();
  }

  Future<void> _createRole() async {
    final code = TextEditingController();
    final name = TextEditingController();
    final description = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Create platform role'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [_field(code, 'Code'), _field(name, 'Name'), _field(description, 'Description')]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                final response = await _client.post('/api/v1/platform/roles', body: {
                  'code': code.text.trim(), 'name': name.text.trim(),
                  'description': description.text.trim().isEmpty ? null : description.text.trim(),
                });
                if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                if (dialog.mounted) Navigator.pop(dialog, true);
              } catch (e) {
                if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    code.dispose(); name.dispose(); description.dispose();
    if (result == true) await _load();
  }

  Future<void> _editRole(Map<String, dynamic> role) async {
    if (role['isSystem'] == true) { _errorSnack('System role permissions are protected.'); return; }
    final selected = <String>{
      for (final p in (role['permissions'] as List<dynamic>? ?? const []))
        if (p is Map && p['id'] != null) p['id'].toString(),
    };
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Permissions • ' + (role['name']?.toString() ?? 'Role')),
          content: SizedBox(width: 760, height: 560, child: ListView(children: [
            for (final p in _permissions)
              CheckboxListTile(
                value: selected.contains(p['id']?.toString()),
                title: Text(p['displayName']?.toString() ?? p['permissionKey']?.toString() ?? ''),
                subtitle: Text(p['permissionKey']?.toString() ?? ''),
                onChanged: (value) {
                  final id = p['id']?.toString();
                  if (id == null) return;
                  setDialogState(() { if (value == true) selected.add(id); else selected.remove(id); });
                },
              ),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  final response = await _client.put('/api/v1/platform/roles/' + role['id'] + '/permissions', body: {'permissionIds': selected.toList()});
                  if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                  if (dialog.mounted) Navigator.pop(dialog, true);
                } catch (e) {
                  if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
                }
              },
              child: const Text('Save permissions'),
            ),
          ],
        ),
      ),
    );
    if (result == true) await _load();
  }

  Future<void> _editPolicy() async {
    final session = TextEditingController(text: '\${_policy['sessionLifetimeMinutes'] ?? 60}');
    final failed = TextEditingController(text: '\${_policy['maxFailedLoginAttempts'] ?? 5}');
    final lockout = TextEditingController(text: '\${_policy['lockoutMinutes'] ?? 15}');
    var mfa = _policy['mfaRequired'] == true;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Platform security policy'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            SwitchListTile(value: mfa, title: const Text('Require MFA'), onChanged: (v) => setDialogState(() => mfa = v)),
            _field(session, 'Session lifetime (minutes)'),
            _field(failed, 'Maximum failed logins'),
            _field(lockout, 'Lockout duration (minutes)'),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  final response = await _client.patch('/api/v1/platform/security-policy', body: {
                    'mfaRequired': mfa,
                    'sessionLifetimeMinutes': int.tryParse(session.text),
                    'maxFailedLoginAttempts': int.tryParse(failed.text),
                    'lockoutMinutes': int.tryParse(lockout.text),
                  });
                  if (response.statusCode < 200 || response.statusCode >= 300) throw Exception(response.body);
                  if (dialog.mounted) Navigator.pop(dialog, true);
                } catch (e) {
                  if (dialog.mounted) ScaffoldMessenger.of(dialog).showSnackBar(SnackBar(content: Text(e.toString())));
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    session.dispose(); failed.dispose(); lockout.dispose();
    if (result == true) await _load();
  }

  void _errorSnack(Object e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
  }

  Widget _stat(String label, String value, IconData icon) => SizedBox(
    width: 210,
    child: Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [
      Icon(icon, size: 28), const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)), Text(label),
      ])),
    ]))),
  );

  Widget _section({required String title, required String subtitle, required Widget child, Widget? action}) =>
      ListView(padding: const EdgeInsets.all(24), children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4), Text(subtitle),
          ])),
          if (action != null) ...[const SizedBox(width: 16), action],
        ]),
        const SizedBox(height: 20), child,
      ]);

  Widget _tenants() => _section(
    title: 'Tenant administration',
    subtitle: 'Create, configure, activate, suspend and manage tenant entitlements.',
    action: FilledButton.icon(onPressed: _createTenant, icon: const Icon(Icons.add_business_outlined), label: const Text('Create tenant')),
    child: Column(children: [
      for (final tenant in _tenants)
        Card(child: ListTile(
          leading: const Icon(Icons.business_outlined),
          title: Text(tenant['displayName']?.toString() ?? tenant['name']?.toString() ?? 'Tenant'),
          subtitle: Text((tenant['slug']?.toString() ?? '') + ' • ' + (tenant['subdomain']?.toString() ?? '') + '\nStatus: ' + (tenant['status']?.toString() ?? 'unknown')),
          isThreeLine: true,
          trailing: FilledButton.tonalIcon(onPressed: () => _tenantActions(tenant), icon: const Icon(Icons.settings_outlined), label: const Text('Manage')),
        )),
      if (_tenants.isEmpty) const _Empty(message: 'No tenants found.'),
    ]),
  );

  Widget _modules() => _section(
    title: 'Module entitlements',
    subtitle: 'Control the business modules each tenant is entitled to use.',
    child: Column(children: [
      for (final tenant in _tenants)
        Card(child: ListTile(
          leading: const Icon(Icons.extension_outlined),
          title: Text(tenant['displayName']?.toString() ?? tenant['name']?.toString() ?? 'Tenant'),
          subtitle: const Text('Configure enabled modules'),
          trailing: FilledButton.tonal(onPressed: () => _manageModules(tenant), child: const Text('Manage modules')),
        )),
      if (_tenants.isEmpty) const _Empty(message: 'Create a tenant before configuring modules.'),
    ]),
  );

  Widget _members() => _section(
    title: 'Platform members',
    subtitle: 'Manage identities that are allowed to enter platform context.',
    action: FilledButton.icon(onPressed: _createMember, icon: const Icon(Icons.person_add_outlined), label: const Text('Add member')),
    child: Column(children: [
      for (final member in _members)
        Card(child: ListTile(
          leading: const Icon(Icons.admin_panel_settings_outlined),
          title: Text(member['identityId']?.toString() ?? ''),
          subtitle: Text('Status: ' + (member['status']?.toString() ?? '') + ' • Roles: ' + (member['roles']?.toString() ?? 'none')),
          trailing: IconButton(onPressed: () => _editMember(member), icon: const Icon(Icons.edit_outlined)),
        )),
      if (_members.isEmpty) const _Empty(message: 'No platform members found.'),
    ]),
  );

  Widget _roles() => _section(
    title: 'Platform roles & permissions',
    subtitle: 'Control which platform administration capabilities are available to each role.',
    action: FilledButton.icon(onPressed: _createRole, icon: const Icon(Icons.add), label: const Text('New role')),
    child: Column(children: [
      for (final role in _roles)
        Card(child: ListTile(
          leading: Icon(role['isSystem'] == true ? Icons.lock_outline : Icons.admin_panel_settings_outlined),
          title: Text(role['name']?.toString() ?? ''),
          subtitle: Text((role['code']?.toString() ?? '') + ' • ' + ((role['permissions'] as List<dynamic>? ?? const []).length.toString()) + ' permissions'),
          trailing: TextButton.icon(onPressed: () => _editRole(role), icon: const Icon(Icons.tune_outlined), label: const Text('Permissions')),
        )),
      if (_roles.isEmpty) const _Empty(message: 'No platform roles found.'),
    ]),
  );

  Widget _securityAudit() => ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Platform security'),
                    SizedBox(height: 4),
                    Text('Global platform authentication policy.'),
                  ],
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: _editPolicy,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit policy'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _stat(
                'MFA required',
                _policy['mfaRequired'] == true ? 'Yes' : 'No',
                Icons.verified_user_outlined,
              ),
              _stat(
                'Session lifetime',
                (_policy['sessionLifetimeMinutes']?.toString() ?? '-') + ' min',
                Icons.timer_outlined,
              ),
              _stat(
                'Failed login limit',
                _policy['maxFailedLoginAttempts']?.toString() ?? '-',
                Icons.lock_clock_outlined,
              ),
              _stat(
                'Lockout duration',
                (_policy['lockoutMinutes']?.toString() ?? '-') + ' min',
                Icons.lock_outline,
              ),
            ],
          ),
          const SizedBox(height: 28),
          const Text(
            'Platform audit',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text('Recent platform administrative activity.'),
          const SizedBox(height: 16),
          for (final event in _audit.take(100))
            Card(
              child: ListTile(
                leading: const Icon(Icons.history_outlined),
                title: Text(event['action']?.toString() ?? ''),
                subtitle: Text(
                  (event['resourceType']?.toString() ?? '') +
                      ' • ' +
                      (event['resourceId']?.toString() ?? '') +
                      '\n' +
                      (event['createdAt']?.toString() ?? ''),
                ),
                isThreeLine: true,
              ),
            ),
          if (_audit.isEmpty)
            const _Empty(message: 'No platform audit events found.'),
        ],
      );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Platform Administration'),
      actions: [IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh))],
      bottom: TabBar(controller: _tabs, isScrollable: true, tabs: const [
        Tab(icon: Icon(Icons.dashboard_outlined), text: 'Overview'),
        Tab(icon: Icon(Icons.business_outlined), text: 'Tenants'),
        Tab(icon: Icon(Icons.extension_outlined), text: 'Modules'),
        Tab(icon: Icon(Icons.people_outline), text: 'Members'),
        Tab(icon: Icon(Icons.admin_panel_settings_outlined), text: 'Roles'),
        Tab(icon: Icon(Icons.security_outlined), text: 'Security & Audit'),
      ]),
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(_error!, textAlign: TextAlign.center), const SizedBox(height: 12),
                FilledButton(onPressed: _load, child: const Text('Retry')),
              ]))
            : TabBarView(controller: _tabs, children: [
                _section(
                  title: 'Platform overview',
                  subtitle: 'Central administration for tenants, module entitlements, platform identities, roles, security and audit.',
                  child: Wrap(spacing: 12, runSpacing: 12, children: [
                    _stat('Tenants', _tenants.length.toString(), Icons.business_outlined),
                    _stat('Platform members', _members.length.toString(), Icons.people_outline),
                    _stat('Platform roles', _roles.length.toString(), Icons.admin_panel_settings_outlined),
                    _stat('Permissions', _permissions.length.toString(), Icons.lock_outline),
                    _stat('Audit events', _audit.length.toString(), Icons.history_outlined),
                  ]),
                ),
                _tenants(), _modules(), _members(), _roles(), _securityAudit(),
              ]),
  );
}

class _Empty extends StatelessWidget {
  final String message;
  const _Empty({required this.message});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: const EdgeInsets.all(32), child: Center(child: Text(message))),
  );
}
