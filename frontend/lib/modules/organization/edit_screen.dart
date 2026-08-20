import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'organization_service.dart';

class EditOrganizationScreen extends StatefulWidget {
  final String id;
  const EditOrganizationScreen({Key? key, required this.id}) : super(key: key);

  @override
  State<EditOrganizationScreen> createState() => _EditOrganizationScreenState();
}

class _EditOrganizationScreenState extends State<EditOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _legalName = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  late OrganizationService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    final data = await service.getOrganization(widget.id);
    if (data == null) {
      setState(() { _error = 'Not found'; _loading = false; });
      return;
    }
    _code.text = data['code'] ?? '';
    _name.text = data['name'] ?? '';
    _legalName.text = data['legalName'] ?? '';
    setState(() { _loading = false; });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final payload = {
      'code': _code.text.trim(),
      'name': _name.text.trim(),
      'legalName': _legalName.text.trim(),
    };
    final success = await service.updateOrganization(widget.id, payload);
    setState(() => _submitting = false);
    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() => _error = 'Failed to update');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(body: Center(child: CircularProgressIndicator()));
    final permitted = auth.hasPermission('organization.manage');
    if (!permitted) return Scaffold(body: Center(child: Text('Not permitted')));

    return Scaffold(
      appBar: AppBar(title: Text('Edit Organization')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(children: [
            TextFormField(controller: _code, decoration: InputDecoration(labelText: 'Code'), validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
            TextFormField(controller: _name, decoration: InputDecoration(labelText: 'Name'), validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
            TextFormField(controller: _legalName, decoration: InputDecoration(labelText: 'Legal Name')),
            SizedBox(height: 12),
            if (_error != null) Text(_error!, style: TextStyle(color: Colors.red)),
            ElevatedButton(onPressed: _submitting ? null : _submit, child: _submitting ? CircularProgressIndicator() : Text('Save'))
          ]),
        ),
      ),
    );
  }
}
