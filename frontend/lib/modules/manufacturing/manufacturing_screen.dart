import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'manufacturing_service.dart';

class ManufacturingScreen extends StatefulWidget {
  const ManufacturingScreen({super.key});
  @override
  State<ManufacturingScreen> createState() => _ManufacturingScreenState();
}

class _ManufacturingScreenState extends State<ManufacturingScreen> {
  final s = GetIt.I<ManufacturingService>();
  int tab = 0;
  final code = TextEditingController(),
      name = TextEditingController(),
      machineId = TextEditingController(),
      machineCode = TextEditingController(),
      opCode = TextEditingController();
  final itemId = TextEditingController(),
      revision = TextEditingController(),
      processId = TextEditingController(),
      woNo = TextEditingController(),
      qty = TextEditingController();
  final woId = TextEditingController(),
      taskId = TextEditingController(),
      warehouseId = TextEditingController(),
      requisitionLineId = TextEditingController(),
      requiredQty = TextEditingController(),
      expectedVersion = TextEditingController(),
      acceptedQty = TextEditingController(),
      rejectedQty = TextEditingController(),
      reworkQty = TextEditingController(),
      returnedQty = TextEditingController(),
      toolId = TextEditingController(),
      fixtureId = TextEditingController(),
      operationKey = TextEditingController(),
      returnNo = TextEditingController(),
      unitCost = TextEditingController(),
      result = TextEditingController();
  @override
  void initState() {
    super.initState();
    s.refresh();
  }

  @override
  void dispose() {
    for (final c in [
      code,
      name,
      machineId,
      machineCode,
      opCode,
      itemId,
      revision,
      processId,
      woNo,
      qty,
      woId,
      taskId,
      warehouseId,
      requisitionLineId,
      requiredQty,
      expectedVersion,
      acceptedQty,
      rejectedQty,
      reworkQty,
      returnedQty,
      toolId,
      fixtureId,
      operationKey,
      returnNo,
      unitCost,
      result,
    ])
      c.dispose();
    super.dispose();
  }

  Widget f(String label, TextEditingController c) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextField(
      controller: c,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    ),
  );
  Future<void> act(Future<dynamic> Function() fn) async {
    final v = await fn();
    if (mounted) setState(() {});
    if (v != null && mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Operation completed.')));
  }

  Widget action(String label, IconData icon, Future<dynamic> Function() fn) =>
      FilledButton.icon(
        onPressed: () => act(fn),
        icon: Icon(icon),
        label: Text(label),
      );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Manufacturing')),
    body: Column(
      children: [
        if (s.error != null)
          MaterialBanner(
            content: Text(s.error!),
            actions: [
              TextButton(
                onPressed: () => setState(() => s.error = null),
                child: const Text('Dismiss'),
              ),
            ],
          ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children:
                [
                      'Machines',
                      'Capabilities',
                      'Process / Routing',
                      'Work Orders',
                      'Execution',
                    ]
                    .asMap()
                    .entries
                    .map(
                      (e) => Padding(
                        padding: const EdgeInsets.all(4),
                        child: ChoiceChip(
                          label: Text(e.value),
                          selected: tab == e.key,
                          onSelected: (_) => setState(() => tab = e.key),
                        ),
                      ),
                    )
                    .toList(),
          ),
        ),
        Expanded(
          child: Padding(padding: const EdgeInsets.all(16), child: _body()),
        ),
      ],
    ),
  );
  Widget _body() {
    switch (tab) {
      case 0:
        return _machines();
      case 1:
        return _capabilities();
      case 2:
        return _process();
      case 3:
        return _workOrders();
      default:
        return _execution();
    }
  }

  Widget _machines() => ListView(
    children: [
      const Text(
        'Machine / Asset Master',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 8),
      const Text(
        'Branch-scoped machine master with optimistic versioning and soft-delete.',
        style: TextStyle(color: Colors.grey),
      ),
      const SizedBox(height: 16),
      f('Machine Code', machineCode),
      f('Machine Name', name),
      f('Serial Number', result),
      f('Model', opCode),
      f('Manufacturer', code),
      f('Manufacture Year', revision),
      f('Section', processId),
      f('Division', returnNo),
      f('Operational Group', warehouseId),
      f('Capacity', qty),
      f('Capacity UOM', requiredQty),
      f('Power', unitCost),
      f('Power UOM', acceptedQty),
      DropdownButtonFormField<String>(
        initialValue: result.text.isEmpty ? 'ACTIVE' : result.text,
        decoration: const InputDecoration(
          labelText: 'Status',
          border: OutlineInputBorder(),
        ),
        items: const [
          DropdownMenuItem(value: 'ACTIVE', child: Text('ACTIVE')),
          DropdownMenuItem(value: 'INACTIVE', child: Text('INACTIVE')),
          DropdownMenuItem(value: 'MAINTENANCE', child: Text('MAINTENANCE')),
        ],
        onChanged: (v) {
          if (v != null) setState(() => result.text = v);
        },
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Expanded(
            child: action(
              'Create Machine',
              Icons.add,
              () => s.createMachine({
                'code': machineCode.text,
                'name': name.text,
                'serialNumber': result.text.isEmpty ? null : result.text,
                'model': opCode.text.isEmpty ? null : opCode.text,
                'manufacturer': code.text.isEmpty ? null : code.text,
                'manufactureYear': int.tryParse(revision.text),
                'section': processId.text.isEmpty ? null : processId.text,
                'division': returnNo.text.isEmpty ? null : returnNo.text,
                'operationalGroup': warehouseId.text.isEmpty
                    ? null
                    : warehouseId.text,
                'capacity': double.tryParse(qty.text),
                'capacityUom': requiredQty.text.isEmpty
                    ? null
                    : requiredQty.text,
                'power': double.tryParse(unitCost.text),
                'powerUom': acceptedQty.text.isEmpty ? null : acceptedQty.text,
                'status': result.text.isEmpty ? 'ACTIVE' : result.text,
                'cutTimeApplicable': true,
                'productionMachine': true,
              }),
            ),
          ),
          const SizedBox(width: 12),
          OutlinedButton.icon(
            onPressed: () => s.refresh(),
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh'),
          ),
        ],
      ),
      const SizedBox(height: 20),
      if (s.machines.isEmpty)
        const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('No machines found.'),
          ),
        ),
      ...s.machines.map(
        (x) => Card(
          child: ListTile(
            leading: const Icon(Icons.precision_manufacturing),
            title: Text(
              (x['code'] ?? '').toString() +
                  ' — ' +
                  (x['name'] ?? '').toString(),
            ),
            subtitle: Text(
              'Status: ' +
                  (x['status'] ?? '').toString() +
                  ' • Version: ' +
                  (x['version'] ?? '').toString() +
                  ' • Serial: ' +
                  (x['serialNumber'] ?? '').toString(),
            ),
            onTap: () => _machineActions(x),
          ),
        ),
      ),
    ],
  );
  Future<void> _machineActions(Map<String, dynamic> machine) async {
    final id = '${machine['id']}';
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.visibility_outlined),
              title: const Text('Load machine details'),
              onTap: () => Navigator.pop(context, 'view'),
            ),
            if (s.auth.hasPermission('manufacturing.machine.update'))
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit machine'),
                onTap: () => Navigator.pop(context, 'edit'),
              ),
            if (s.auth.hasPermission('manufacturing.machine.delete'))
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text('Soft delete machine'),
                onTap: () => Navigator.pop(context, 'delete'),
              ),
          ],
        ),
      ),
    );
    if (!mounted || selected == null) return;
    if (selected == 'view') {
      final detail = await s.getMachine(id);
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(
            (detail?['name'] ?? machine['name'] ?? 'Machine').toString(),
          ),
          content: SingleChildScrollView(child: Text(detail.toString())),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    }
    if (selected == 'delete') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Delete machine?'),
          content: const Text(
            'This performs a backend soft delete. The current version is required.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (ok == true) {
        await s.deleteMachine(id, int.tryParse('${machine['version']}') ?? 1);
        await s.refresh();
        setState(() {});
      }
    }
    if (selected == 'edit') {
      _fillMachine(machine);
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Edit machine'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                f('Machine Name', name),
                f('Serial Number', result),
                f('Model', opCode),
                f('Manufacturer', code),
                f('Section', processId),
                f('Division', returnNo),
                f('Operational Group', warehouseId),
                f('Capacity', qty),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save'),
            ),
          ],
        ),
      );
      if (ok == true) {
        await s.updateMachine(id, {
          'name': name.text,
          'serialNumber': result.text,
          'model': opCode.text,
          'manufacturer': code.text,
          'section': processId.text,
          'division': returnNo.text,
          'operationalGroup': warehouseId.text,
          'capacity': double.tryParse(qty.text),
          'status': 'ACTIVE',
          'expectedVersion': int.tryParse('${machine['version']}') ?? 1,
          'cutTimeApplicable': true,
          'productionMachine': true,
        });
        await s.refresh();
        setState(() {});
      }
    }
  }

  void _fillMachine(Map<String, dynamic> x) {
    machineCode.text = '${x['code'] ?? ''}';
    name.text = '${x['name'] ?? ''}';
    result.text = '${x['serialNumber'] ?? x['status'] ?? 'ACTIVE'}';
    opCode.text = '${x['model'] ?? ''}';
    code.text = '${x['manufacturer'] ?? ''}';
    revision.text = '${x['manufactureYear'] ?? ''}';
    processId.text = '${x['section'] ?? ''}';
    returnNo.text = '${x['division'] ?? ''}';
    warehouseId.text = '${x['operationalGroup'] ?? ''}';
    qty.text = '${x['capacity'] ?? ''}';
  }

  Widget _capabilities() => ListView(
    children: [
      const Text(
        'FEAT-010 — Machine Capability Matrix',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 16),
      f('Machine ID', machineId),
      f('Operation Code', opCode),
      f('Capability Name', name),
      Row(
        children: [
          Expanded(
            child: action(
              'Add Capability',
              Icons.add,
              () => s.createCapability({
                'machineId': machineId.text,
                'operationCode': opCode.text,
                'capabilityName': name.text,
              }),
            ),
          ),
          const SizedBox(width: 12),
          OutlinedButton.icon(
            onPressed: () => s.refresh(),
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh'),
          ),
        ],
      ),
      const SizedBox(height: 20),
      ...s.capabilities.map(
        (x) => Card(
          child: ListTile(
            title: Text(
              (x['operation_code'] ?? '').toString() +
                  ' — ' +
                  (x['capability_name'] ?? '').toString(),
            ),
            subtitle: Text(
              (x['machine_code'] ?? '').toString() +
                  ' / ' +
                  (x['machine_name'] ?? '').toString(),
            ),
            trailing: Text((x['status'] ?? '').toString()),
          ),
        ),
      ),
    ],
  );
  Widget _process() => ListView(
    children: [
      const Text(
        'FEAT-011 — Product Process / Routing',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 16),
      f('Inventory Item ID', itemId),
      f('Revision', revision),
      f('Drawing Number', result),
      Row(
        children: [
          Expanded(
            child: action(
              'Create Process Detail',
              Icons.route,
              () => s.createProcess({
                'itemId': itemId.text,
                'revision': revision.text,
                'drawingNumber': result.text,
              }),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: action(
              'Add Routing Operation',
              Icons.alt_route,
              () => s.addRouting(processId.text, {
                'sequenceNo': 1,
                'operationCode': opCode.text,
                'operationDescription': name.text,
              }),
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      const Text(
        'Routing supports operation sequence, machine group/code, manpower, cycle/setup/allowance/overhead times, batch quantity, tooling, work instructions and process parameters through the API.',
        style: TextStyle(color: Colors.grey),
      ),
    ],
  );
  Widget _workOrders() => ListView(
    children: [
      const Text(
        'FEAT-001 / FEAT-002 — Work Order, Scheduling & Route Card',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 16),
      f('Work Order Number', woNo),
      f('Item ID', itemId),
      f('Process Detail ID', processId),
      f('Planned Quantity', qty),
      Row(
        children: [
          Expanded(
            child: action(
              'Create Work Order',
              Icons.add_task,
              () => s.createWorkOrder({
                'workOrderNumber': woNo.text,
                'itemId': itemId.text,
                'processDetailId': processId.text,
                'plannedQuantity': double.tryParse(qty.text) ?? 0,
              }),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: action(
              'Schedule Work Order',
              Icons.calendar_month,
              () => s.scheduleWorkOrder(woId.text),
            ),
          ),
        ],
      ),
      const SizedBox(height: 20),
      ...s.workOrders.map(
        (x) => Card(
          child: ListTile(
            title: Text((x['work_order_number'] ?? '').toString()),
            subtitle: Text(
              'Qty ' +
                  (x['planned_quantity'] ?? '').toString() +
                  ' • ' +
                  (x['status'] ?? '').toString(),
            ),
            onTap: () => setState(() => woId.text = x['id'].toString()),
          ),
        ),
      ),
      const SizedBox(height: 12),
      f('Selected Task Sheet ID', taskId),
      f('Expected Task Version', expectedVersion),
      Wrap(
        spacing: 8,
        children: [
          action(
            'Mark Task READY',
            Icons.play_circle,
            () => s.updateTask(taskId.text, {
              'status': 'READY',
              'expectedVersion': int.tryParse(expectedVersion.text) ?? 1,
            }),
          ),
          action(
            'Start Task',
            Icons.play_arrow,
            () => s.updateTask(taskId.text, {
              'status': 'RUNNING',
              'expectedVersion': int.tryParse(expectedVersion.text) ?? 1,
            }),
          ),
          action(
            'Pause Task',
            Icons.pause_circle,
            () => s.updateTask(taskId.text, {
              'status': 'PAUSED',
              'expectedVersion': int.tryParse(expectedVersion.text) ?? 1,
            }),
          ),
          action(
            'Complete Task',
            Icons.task_alt,
            () => s.updateTask(taskId.text, {
              'status': 'COMPLETED',
              'expectedVersion': int.tryParse(expectedVersion.text) ?? 1,
            }),
          ),
        ],
      ),
      const Text(
        'Scheduling creates one Task Sheet / Route Card per routing operation. Task execution is protected by the readiness gate.',
        style: TextStyle(color: Colors.grey),
      ),
    ],
  );
  Widget _execution() => ListView(
    children: [
      const Text(
        'FEAT-003 to FEAT-008 — Manufacturing Execution',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 16),
      f('Task Sheet ID', taskId),
      f('Machine ID', machineId),
      f('Tool ID (optional)', toolId),
      f('Fixture ID (optional)', fixtureId),
      action(
        'Run Readiness Gate',
        Icons.fact_check,
        () => s.readiness({
          'taskSheetId': taskId.text,
          'machineId': machineId.text,
          'toolId': toolId.text.isEmpty ? null : toolId.text,
          'fixtureId': fixtureId.text.isEmpty ? null : fixtureId.text,
        }),
      ),
      const Divider(height: 32),
      f('Quantity', qty),
      f('Operation Key', operationKey),
      f('Return Number', returnNo),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          action(
            'Punch Good Output',
            Icons.check_circle,
            () => s.punchProduction({
              'taskSheetId': taskId.text,
              'quantity': double.tryParse(qty.text) ?? 0,
              'outputType': 'GOOD',
              'operationKey': operationKey.text,
            }),
          ),
          action(
            'Punch Rework',
            Icons.replay,
            () => s.punchProduction({
              'taskSheetId': taskId.text,
              'quantity': double.tryParse(qty.text) ?? 0,
              'outputType': 'REWORK',
              'operationKey': operationKey.text,
            }),
          ),
          action(
            'Punch Reject',
            Icons.cancel,
            () => s.punchProduction({
              'taskSheetId': taskId.text,
              'quantity': double.tryParse(qty.text) ?? 0,
              'outputType': 'REJECT',
              'operationKey': operationKey.text,
            }),
          ),
        ],
      ),
      const Divider(height: 32),
      const Text(
        'Material Requisition / Issue',
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      f('Warehouse ID', warehouseId),
      f('Inventory Item ID', itemId),
      f('Requisition Line ID', requisitionLineId),
      f('Required Quantity', requiredQty),
      Wrap(
        spacing: 8,
        children: [
          action(
            'Create Material Requisition',
            Icons.request_page,
            () => s.materialRequisition({
              'workOrderId': woId.text,
              'requisitionNumber': returnNo.text,
              'lines': [
                {
                  'itemId': itemId.text,
                  'requiredQuantity': double.tryParse(requiredQty.text) ?? 0,
                },
              ],
            }),
          ),
          action(
            'Issue Material',
            Icons.output,
            () => s.issueMaterial({
              'requisitionLineId': requisitionLineId.text,
              'warehouseId': warehouseId.text,
              'quantity': double.tryParse(qty.text) ?? 0,
              'operationKey': operationKey.text,
            }),
          ),
        ],
      ),
      const Divider(height: 32),
      f('Warehouse ID', warehouseId),
      f('Inventory Item ID', itemId),
      action(
        'Create Material Return',
        Icons.assignment_return,
        () => s.materialReturn({
          'workOrderId': woId.text,
          'warehouseId': warehouseId.text,
          'itemId': itemId.text,
          'quantity': double.tryParse(qty.text) ?? 0,
          'returnNumber': returnNo.text,
          'operationKey': operationKey.text,
        }),
      ),
      const Divider(height: 32),
      f('Variance Unit Cost', unitCost),
      Wrap(
        spacing: 8,
        children: [
          action(
            'Rework Cost',
            Icons.build,
            () => s.variance({
              'workOrderId': woId.text,
              'taskSheetId': taskId.text,
              'varianceType': 'REWORK',
              'quantity': double.tryParse(qty.text) ?? 0,
              'unitCost': double.tryParse(unitCost.text) ?? 0,
            }),
          ),
          action(
            'Rejection Cost',
            Icons.warning,
            () => s.variance({
              'workOrderId': woId.text,
              'taskSheetId': taskId.text,
              'varianceType': 'REJECTION',
              'quantity': double.tryParse(qty.text) ?? 0,
              'unitCost': double.tryParse(unitCost.text) ?? 0,
            }),
          ),
        ],
      ),
      const Divider(height: 32),
      const Text(
        'Quality Output / Disposition',
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      f('Inspected Quantity', qty),
      f('Accepted Quantity', acceptedQty),
      f('Rejected Quantity', rejectedQty),
      f('Rework Quantity', reworkQty),
      f('Returned Quantity', returnedQty),
      const Text(
        'Quality reconciliation is enforced server-side: Inspected = Accepted + Rejected + Rework + Return.',
        style: TextStyle(color: Colors.grey),
      ),
      action(
        'Record Quality Disposition',
        Icons.verified,
        () => s.punchQuality({
          'taskSheetId': taskId.text,
          'inspectedQuantity': double.tryParse(qty.text) ?? 0,
          'acceptedQuantity': double.tryParse(acceptedQty.text) ?? 0,
          'rejectedQuantity': double.tryParse(rejectedQty.text) ?? 0,
          'reworkQuantity': double.tryParse(reworkQty.text) ?? 0,
          'returnedQuantity': double.tryParse(returnedQty.text) ?? 0,
        }),
      ),
      action(
        'Record Accepted Quality',
        Icons.verified,
        () => s.punchQuality({
          'taskSheetId': taskId.text,
          'inspectedQuantity': double.tryParse(qty.text) ?? 0,
          'acceptedQuantity': double.tryParse(qty.text) ?? 0,
          'rejectedQuantity': 0,
          'reworkQuantity': 0,
          'returnedQuantity': 0,
        }),
      ),
    ],
  );
}
