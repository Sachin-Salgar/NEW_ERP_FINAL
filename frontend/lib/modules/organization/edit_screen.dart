import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'organization_service.dart';
import '../../presentation/ui/components/page_header.dart';

class EditOrganizationScreen extends StatefulWidget {
  final String id;
  const EditOrganizationScreen({super.key, required this.id});
  @override State<EditOrganizationScreen> createState() => _EditOrganizationScreenState();
}
class _EditOrganizationScreenState extends State<EditOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController(), _name = TextEditingController(), _legalName = TextEditingController();
  late final OrganizationService service; late final AuthService auth;
  bool _loading = true, _submitting = false; String? _error;
  @override void initState() { super.initState(); service = GetIt.instance.get<OrganizationService>(); auth = GetIt.instance.get<AuthService>(); _load(); }
  @override void dispose() { _code.dispose(); _name.dispose(); _legalName.dispose(); super.dispose(); }
  Future<void> _load() async { final data = await service.getOrganization(widget.id); if (!mounted) return; if (data == null) { setState(() { _error = 'Organization not found'; _loading = false; }); return; } _code.text = data['code'] ?? ''; _name.text = data['name'] ?? ''; _legalName.text = data['legalName'] ?? ''; setState(() => _loading = false); }
  Future<void> _submit() async { if (!_formKey.currentState!.validate()) return; setState(() { _submitting = true; _error = null; }); final ok = await service.updateOrganization(widget.id, {'code': _code.text.trim(), 'name': _name.text.trim(), 'legalName': _legalName.text.trim()}); if (!mounted) return; setState(() => _submitting = false); if (ok) Navigator.of(context).pop(); else setState(() => _error = 'Failed to update organization'); }
  @override Widget build(BuildContext context) { if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator())); if (!auth.hasPermission('organization.manage')) return const Scaffold(body: Center(child: Text('You do not have permission to manage organizations.'))); return Scaffold(body: SafeArea(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(24, 24, 24, 32), child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const ErpPageHeader(title: 'Edit Organization', subtitle: 'Update organization information', breadcrumbs: [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Organizations'), ErpBreadcrumbItem(label: 'Edit')]), const SizedBox(height: 12),
    Card(child: Padding(padding: const EdgeInsets.all(24), child: Form(key: _formKey, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text('Organization information', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)), const SizedBox(height: 20), LayoutBuilder(builder: (context, c) { final a = TextFormField(controller: _code, decoration: const InputDecoration(labelText: 'Code'), validator: (v) => v == null || v.trim().isEmpty ? 'Code is required.' : null); final b = TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Name'), validator: (v) => v == null || v.trim().isEmpty ? 'Name is required.' : null); return c.maxWidth < 600 ? Column(children: [a, const SizedBox(height: 18), b]) : Row(children: [Expanded(child: a), const SizedBox(width: 18), Expanded(child: b)]); }), const SizedBox(height: 18), TextFormField(controller: _legalName, decoration: const InputDecoration(labelText: 'Legal name')), if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: TextStyle(color: Colors.red))], const SizedBox(height: 24), Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: _submitting ? null : _submit, icon: _submitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_outlined), label: const Text('Save changes')))])))
  ])))))); }
}
