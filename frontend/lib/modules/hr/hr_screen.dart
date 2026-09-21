import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'hr_service.dart';

class HrScreen extends StatefulWidget {
  const HrScreen({super.key});

  @override
  State<HrScreen> createState() => _HrScreenState();
}

class _HrScreenState extends State<HrScreen> {
  final service = GetIt.I<HrService>();
  final employeeNo = TextEditingController();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final workEmail = TextEditingController();
  final joiningDate = TextEditingController();
  int tab = 0;

  @override
  void initState() {
    super.initState();
    service.loadEmployees();
  }

  @override
  void dispose() {
    employeeNo.dispose();
    firstName.dispose();
    lastName.dispose();
    workEmail.dispose();
    joiningDate.dispose();
    super.dispose();
  }

  Widget _field(String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const tabs = [
      'Employees',
      'Attendance',
      'Leave',
      'Payroll',
      'Recruitment',
      'Performance',
      'Training',
      'Compliance',
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Human Resources')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: tabs.asMap().entries.map((entry) {
                return Padding(
                  padding: const EdgeInsets.all(4),
                  child: ChoiceChip(
                    label: Text(entry.value),
                    selected: tab == entry.key,
                    onSelected: (_) {
                      setState(() => tab = entry.key);
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: tab == 0 ? _employees() : _modulePlaceholder(tabs[tab]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _employees() {
    return ListView(
      children: [
        const Text(
          'Employee Master',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _field('Employee Number', employeeNo),
        _field('First Name', firstName),
        _field('Last Name', lastName),
        _field('Work Email', workEmail),
        _field('Joining Date (YYYY-MM-DD)', joiningDate),
        FilledButton.icon(
          onPressed: () async {
            try {
              await service.createEmployee({
                'employeeNo': employeeNo.text.trim(),
                'firstName': firstName.text.trim(),
                'lastName': lastName.text.trim(),
                'workEmail': workEmail.text.trim(),
                'joiningDate': joiningDate.text.trim(),
                'employmentStatus': 'ACTIVE',
              });
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Employee created')),
                );
              }
            } catch (error) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(error.toString())),
                );
              }
            }
          },
          icon: const Icon(Icons.person_add),
          label: const Text('Create Employee'),
        ),
        const SizedBox(height: 16),
        if (service.loading)
          const Center(child: CircularProgressIndicator()),
        if (service.error != null)
          Text(
            service.error!,
            style: const TextStyle(color: Colors.red),
          ),
        ...service.employees.map(
          (employee) => Card(
            child: ListTile(
              title: Text(
                employee['employee_no'].toString() +
                    ' — ' +
                    employee['first_name'].toString() +
                    ' ' +
                    (employee['last_name'] ?? '').toString(),
              ),
              subtitle: Text(
                (employee['work_email'] ?? '').toString() +
                    ' • ' +
                    (employee['employment_status'] ?? '').toString(),
              ),
              trailing: Wrap(
                spacing: 8,
                children: [
                  FilledButton(
                    onPressed: () => service.punch(
                      employee['id'].toString(),
                      true,
                    ),
                    child: const Text('IN'),
                  ),
                  OutlinedButton(
                    onPressed: () => service.punch(
                      employee['id'].toString(),
                      false,
                    ),
                    child: const Text('OUT'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _modulePlaceholder(String name) {
    return Center(
      child: Text(
        name + ' workspace',
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
      ),
    );
  }
}
