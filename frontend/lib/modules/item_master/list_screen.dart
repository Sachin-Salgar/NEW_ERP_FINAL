import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'item_master_service.dart';

class ItemMasterListScreen extends StatefulWidget {
  const ItemMasterListScreen({super.key});

  @override
  State<ItemMasterListScreen> createState() => _ItemMasterListScreenState();
}

class _ItemMasterListScreenState extends State<ItemMasterListScreen> {
  late final ItemMasterService service;
  late final AuthService auth;
  final searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    auth = GetIt.instance.get<AuthService>();
    service = GetIt.instance.get<ItemMasterService>();
    WidgetsBinding.instance.addPostFrameCallback((_) => service.fetchItems());
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<ItemMasterService>.value(
      value: service,
      child: Consumer<ItemMasterService>(
        builder: (context, svc, _) {
          if (svc.isLoading && svc.items.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!auth.hasPermission('inventory.item.read')) {
            return const Center(child: Text('You do not have permission to view items.'));
          }
          return Scaffold(
            body: RefreshIndicator(
              onRefresh: svc.fetchItems,
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                    sliver: SliverToBoxAdapter(
                      child: ErpPageHeader(
                        title: 'Item Master',
                        subtitle: 'Manage organization-owned items for Sales and Inventory',
                        breadcrumbs: const [
                          ErpBreadcrumbItem(label: 'Dashboard'),
                          ErpBreadcrumbItem(label: 'Item Master'),
                        ],
                        actions: auth.hasPermission('inventory.item.create')
                            ? [
                                FilledButton.icon(
                                  onPressed: () => _showEditor(context),
                                  icon: const Icon(Icons.add),
                                  label: const Text('Add Item'),
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                    sliver: SliverToBoxAdapter(
                      child: TextField(
                        controller: searchController,
                        onSubmitted: (_) => svc.fetchItems(search: searchController.text, page: 1),
                        decoration: InputDecoration(
                          labelText: 'Search item code or name',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: IconButton(
                            onPressed: () => svc.fetchItems(search: searchController.text, page: 1),
                            icon: const Icon(Icons.arrow_forward),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (svc.error != null)
                    SliverFillRemaining(hasScrollBody: false, child: Center(child: Text(svc.error!)))
                  else if (svc.items.isEmpty)
                    const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No items found.')))
                  else
                    SliverPadding(
                      padding: const EdgeInsets.all(24),
                      sliver: SliverToBoxAdapter(
                        child: Card(
                          child: DataTable(
                            columns: const [
                              DataColumn(label: Text('Code')),
                              DataColumn(label: Text('Name')),
                              DataColumn(label: Text('Unit')),
                              DataColumn(label: Text('Sales')),
                              DataColumn(label: Text('')),
                            ],
                            rows: svc.items.map((item) {
                              return DataRow(cells: [
                                DataCell(Text(item['code'] as String)),
                                DataCell(Text(item['name'] as String)),
                                DataCell(Text(item['unitOfMeasure'] as String)),
                                DataCell(Text((item['salesEligible'] as bool) ? 'Eligible' : 'Excluded')),
                                DataCell(
                                  auth.hasPermission('inventory.item.update')
                                      ? IconButton(
                                          icon: const Icon(Icons.edit_outlined),
                                          onPressed: () => _showEditor(context, item: item),
                                        )
                                      : const SizedBox.shrink(),
                                ),
                              ]);
                            }).toList(),
                          ),
                        ),
                      ),
                    ),
                  if (svc.error == null && svc.items.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            onPressed: svc.page > 1 ? () => svc.fetchItems(page: svc.page - 1) : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('Page ${svc.page} of ${svc.totalPages}'),
                          IconButton(
                            onPressed: svc.page < svc.totalPages ? () => svc.fetchItems(page: svc.page + 1) : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _showEditor(BuildContext context, {Map<String, dynamic>? item}) async {
    final formKey = GlobalKey<FormState>();
    final code = TextEditingController(text: item?['code'] as String?);
    final name = TextEditingController(text: item?['name'] as String?);
    final unit = TextEditingController(text: item?['unitOfMeasure'] as String? ?? 'EA');
    final description = TextEditingController(text: item?['description'] as String?);
    var salesEligible = item?['salesEligible'] as bool? ?? true;
    String? error;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(item == null ? 'Add Item' : 'Edit Item'),
          content: Form(
            key: formKey,
            child: SizedBox(
              width: 420,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                if (item == null)
                  TextFormField(controller: code, decoration: const InputDecoration(labelText: 'Item code'), validator: _required),
                TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Name'), validator: _required),
                TextFormField(controller: unit, decoration: const InputDecoration(labelText: 'Unit of measure'), validator: _required),
                TextFormField(controller: description, decoration: const InputDecoration(labelText: 'Description')),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Sales eligible'),
                  value: salesEligible,
                  onChanged: (value) => setState(() => salesEligible = value),
                ),
                if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ]),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                final result = item == null
                    ? await service.createItem(code: code.text, name: name.text, unitOfMeasure: unit.text, description: description.text, salesEligible: salesEligible)
                    : await service.updateItem(item['id'] as String, name: name.text, unitOfMeasure: unit.text, description: description.text, salesEligible: salesEligible, version: (item['version'] as num).toInt());
                if (!mounted) return;
                if (result == null) {
                  Navigator.pop(dialogContext);
                } else {
                  setState(() => error = result);
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    code.dispose();
    name.dispose();
    unit.dispose();
    description.dispose();
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'Required' : null;
}
