import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'organization_service.dart';

class CreateOrganizationScreen extends StatefulWidget {
  const CreateOrganizationScreen({Key? key}) : super(key: key);

  @override
  State<CreateOrganizationScreen> createState() =>
      _CreateOrganizationScreenState();
}

class _CreateOrganizationScreenState extends State<CreateOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _legalName = TextEditingController();
  bool _submitting = false;
  String? _error;

  late OrganizationService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    // Use DI-registered OrganizationService instance
    service = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
  }

  @override
  Widget build(BuildContext context) {
    // Service is provided via DI; use registered instance
    service = GetIt.instance.get<OrganizationService>();

    final permitted = auth.hasPermission('organization.manage');
    if (!permitted) return Scaffold(body: Center(child: Text('Not permitted')));

    return Scaffold(
      appBar: AppBar(title: const Text('Create Organization')),
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
                controller: _legalName,
                decoration: InputDecoration(labelText: 'Legal Name'),
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
                          'legalName': _legalName.text.trim(),
                        };
                        final success = await service.createOrganization(
                          payload,
                        );
                        setState(() => _submitting = false);
                        if (success) {
                          Navigator.of(context).pop();
                        } else {
                          setState(
                            () => _error = 'Failed to create organization',
                          );
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
