import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'branch_service.dart';

class EditBranchScreen extends StatefulWidget {
  final String organizationId;
  final String branchId;
  const EditBranchScreen({Key? key, required this.organizationId, required this.branchId}) : super(key: key);

  @override
  State<EditBranchScreen> createState() => _EditBranchScreenState();
}

class _EditBranchScreenState extends State<EditBranchScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _city = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  late BranchService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<BranchService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    final data = await service.getBranch(widget.organizationId, widget.branchId);
    if (data == null) {
      setState(() { _error = 'Not found'; _loading = false; });
      return;
    }
    _code.text = data['code'] ?? '';
    _name.text = data['name'] ?? '';
    _city.text = data['city'] ?? '';
    setState(() { _loading = false; });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final payload = {
      'code': _code.text.trim(),
      'name': _name.text.trim(),
      'city': _city.text.trim(),
    };
    final success = await service.updateBranch(widget.organizationId, widget.branchId, payload);
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
    final permitted = auth.hasPermission('branch.manage');
    if (!permitted) return Scaffold(body: Center(child: Text('Not permitted')));

    return Scaffold(
      appBar: AppBar(title: Text('Edit Branch')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(children: [
            TextFormField(controller: _code, decoration: InputDecoration(labelText: 'Code'), validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
            TextFormField(controller: _name, decoration: InputDecoration(labelText: 'Name'), validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
            TextFormField(controller: _city, decoration: InputDecoration(labelText: 'City')),
            SizedBox(height: 12),
            if (_error != null) Text(_error!, style: TextStyle(color: Colors.red)),
            ElevatedButton(onPressed: _submitting ? null : _submit, child: _submitting ? CircularProgressIndicator() : Text('Save'))
          ]),
        ),
      ),
    );
  }
}
