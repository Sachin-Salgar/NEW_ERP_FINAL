import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'branch_service.dart';

class CreateBranchScreen extends StatefulWidget {
  final String organizationId;
  const CreateBranchScreen({Key? key, required this.organizationId})
    : super(key: key);

  @override
  State<CreateBranchScreen> createState() => _CreateBranchScreenState();
}

class _CreateBranchScreenState extends State<CreateBranchScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _city = TextEditingController();
  bool _submitting = false;
  String? _error;

  late BranchService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    service = BranchService(apiClient: GetIt.instance.get());
    auth = GetIt.instance.get<AuthService>();
  }

  @override
  Widget build(BuildContext context) {
    final permitted = auth.hasPermission('branch.manage');
    if (!permitted) return Scaffold(body: Center(child: Text('Not permitted')));

    return Scaffold(
      appBar: AppBar(title: const Text('Create Branch')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _code,
                decoration: InputDecoration(labelText: 'Code'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(labelText: 'Name'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _city,
                decoration: InputDecoration(labelText: 'City'),
              ),
              SizedBox(height: 12),
              if (_error != null)
                Text(_error!, style: TextStyle(color: Colors.red)),
              ElevatedButton(
                onPressed: _submitting
                    ? null
                    : () async {
                        if (!_formKey.currentState!.validate()) return;
                        setState(() => _submitting = true);
                        final payload = {
                          'code': _code.text.trim(),
                          'name': _name.text.trim(),
                          'city': _city.text.trim(),
                        };
                        final success = await service.createBranch(
                          widget.organizationId,
                          payload,
                        );
                        setState(() => _submitting = false);
                        if (success) {
                          Navigator.of(context).pop();
                        } else {
                          setState(() => _error = 'Failed to create branch');
                        }
                      },
                child: _submitting
                    ? CircularProgressIndicator()
                    : Text('Create'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
