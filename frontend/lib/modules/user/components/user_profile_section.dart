import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../user_service.dart';

class UserProfileSection extends StatefulWidget {
  final Map<String, dynamic> user;
  final ValueChanged<Map<String, dynamic>>? onUserChanged;

  const UserProfileSection({super.key, required this.user, this.onUserChanged});

  @override
  State<UserProfileSection> createState() => _UserProfileSectionState();
}

class _UserProfileSectionState extends State<UserProfileSection> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  bool _editing = false;
  bool _saving = false;
  String? _error;
  late Map<String, dynamic> _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _username.text = _user['username']?.toString() ?? '';
    _email.text = _user['email']?.toString() ?? '';
  }

  @override
  void didUpdateWidget(covariant UserProfileSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.user, widget.user)) {
      _user = widget.user;
      _username.text = _user['username']?.toString() ?? '';
      _email.text = _user['email']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final ok = await service.updateUser(_user['id'].toString(), {
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'organizationId': _user['organizationId'],
      'defaultBranchId': _user['defaultBranchId'],
    });
    if (!mounted) return;
    if (ok) {
      Map<String, dynamic> updated = {
        ..._user,
        'username': _username.text.trim(),
        'email': _email.text.trim(),
      };
      final refreshed = await service.getUser(_user['id'].toString());
      if (refreshed != null) updated = refreshed;
      if (!mounted) return;
      setState(() {
        _user = updated;
        _editing = false;
        _saving = false;
        _error = null;
      });
      widget.onUserChanged?.call(updated);
      return;
    }
    setState(() {
      _saving = false;
      _error = 'Failed to update user';
    });
  }

  Future<void> _activate() async {
    if (await service.activateUser(_user['id'].toString())) {
      if (!mounted) return;
      final refreshed = await service.getUser(_user['id'].toString());
      if (!mounted) return;
      if (refreshed != null) {
        setState(() => _user = refreshed);
        widget.onUserChanged?.call(refreshed);
      }
    }
  }

  Future<void> _deactivate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Deactivate user?'),
        content: const Text('This will deactivate the account.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true ||
        !await service.deactivateUser(_user['id'].toString())) {
      return;
    }
    if (!mounted) return;
    final refreshed = await service.getUser(_user['id'].toString());
    if (!mounted) return;
    if (refreshed != null) {
      setState(() => _user = refreshed);
      widget.onUserChanged?.call(refreshed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = auth.hasPermission('user.manage');
    if (_editing) {
      return Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _username,
              decoration: const InputDecoration(labelText: 'Username'),
              validator: (v) => v == null || v.trim().isEmpty
                  ? 'Username is required.'
                  : null,
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Email is required.' : null,
            ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const CircularProgressIndicator()
                      : const Text('Save changes'),
                ),
                OutlinedButton(
                  onPressed: _saving
                      ? null
                      : () => setState(() => _editing = false),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ],
        ),
      );
    }

    final data = [
      _Info(label: 'Username', value: _user['username']),
      _Info(label: 'Email', value: _user['email']),
      _Info(label: 'Status', value: _user['status']),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Account details',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(
          builder: (context, c) => c.maxWidth < 600
              ? Column(children: data)
              : Wrap(spacing: 40, runSpacing: 24, children: data),
        ),
        if (_error != null)
          Text(_error!, style: const TextStyle(color: Colors.red)),
        const SizedBox(height: 28),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (manage)
              FilledButton.icon(
                onPressed: () => setState(() => _editing = true),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit'),
              ),
            if (manage && _user['status'] != 'active')
              FilledButton.icon(
                onPressed: _activate,
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Activate'),
              ),
            if (manage && _user['status'] == 'active')
              FilledButton.icon(
                onPressed: _deactivate,
                icon: const Icon(Icons.block_outlined),
                label: const Text('Deactivate'),
              ),
          ],
        ),
      ],
    );
  }
}

class _Info extends StatelessWidget {
  final String label;
  final dynamic value;

  const _Info({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 220,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        Text(
          value?.toString() ?? '—',
          style: Theme.of(context).textTheme.bodyLarge
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}
