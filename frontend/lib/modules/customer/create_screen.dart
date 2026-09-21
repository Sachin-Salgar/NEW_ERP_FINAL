import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'customer_form.dart';
import 'customer_service.dart';

class CreateCustomerScreen extends StatelessWidget {
  const CreateCustomerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = GetIt.instance.get<CustomerService>();
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.hasPermission('customer.create')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to create customers.')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Create Customer')),
      body: CustomerForm(
        submitLabel: 'Create customer',
        onSubmit: (name, fields) => service.createCustomer(name, fields: fields),
      ),
    );
  }
}
