import 'package:flutter/material.dart';

typedef CustomerFormSubmit = Future<String?> Function(
  String name,
  Map<String, dynamic> fields,
);

class CustomerForm extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final CustomerFormSubmit onSubmit;
  final String submitLabel;

  const CustomerForm({
    super.key,
    this.initial,
    required this.onSubmit,
    required this.submitLabel,
  });

  @override
  State<CustomerForm> createState() => _CustomerFormState();
}

class _CustomerFormState extends State<CustomerForm> {
  final formKey = GlobalKey<FormState>();
  final controllers = <String, TextEditingController>{};
  final contacts = <Map<String, TextEditingController>>[];
  final officeControllers = <String, TextEditingController>{};
  final taxControllers = <String, TextEditingController>{};
  final otherControllers = <String, TextEditingController>{};
  final booleans = <String, bool>{};
  bool submitting = false;
  String? error;

  static const sections = <String, List<String>>{
    'Basic / Customer Details': [
      'code',
      'name',
      'shortName',
      'customerType',
      'customerCategory',
      'zone',
      'domesticExport',
      'startDate',
      'expiryDate',
    ],
    'Address': [
      'address',
      'address1',
      'city',
      'pincode',
      'country',
      'state',
      'district',
      'panNo',
      'gstNo',
      'vatNo',
      'cstNo',
      'serviceTaxNo',
      'eccCode',
      'fax',
      'phone',
      'mobile',
      'email',
    ],
    'Commercial / Financial': [
      'interestPercent',
      'outstandingLimit',
      'agingLimit',
      'cashDiscountPercent',
      'supplierCode',
      'industryType',
    ],
    'Contact': ['contactPerson', 'designation', 'website'],
    'Banking': ['bankName', 'bankAddress', 'bankAddress1', 'bankAccountNo'],
    'Other Details': [
      'range',
      'commissionerate',
      'division',
      'referenceCustomer',
      'documentThrough',
      'dealerName',
      'dealerAddress',
      'dealerAddress1',
      'weeklyOff',
      'groupCustomer',
      'distanceInKm',
      'marketingBy',
      'salesmanName',
    ],
  };

  static const labels = <String, String>{
    'code': 'Code',
    'name': 'Name',
    'shortName': 'Short Name',
    'customerType': 'Type',
    'customerCategory': 'Category',
    'zone': 'Zone',
    'domesticExport': 'Domestic / Export',
    'startDate': 'Start Date (YYYY-MM-DD)',
    'expiryDate': 'Expiry Date (YYYY-MM-DD)',
    'address': 'Address',
    'address1': 'Address1',
    'city': 'City',
    'pincode': 'PIN / Pincode',
    'country': 'Country',
    'state': 'State',
    'district': 'District',
    'panNo': 'PAN No.',
    'gstNo': 'GST No.',
    'vatNo': 'VAT No.',
    'cstNo': 'CST No.',
    'serviceTaxNo': 'Service Tax No.',
    'eccCode': 'ECC Code',
    'fax': 'Fax',
    'phone': 'Phone',
    'mobile': 'Mobile',
    'email': 'Email',
    'interestPercent': 'Interest %',
    'outstandingLimit': 'Outstanding Limit',
    'agingLimit': 'Ageing Limit',
    'cashDiscountPercent': 'Cash Discount %',
    'supplierCode': 'Our Supplier Code',
    'industryType': 'Industry Type',
    'contactPerson': 'Contact Person',
    'designation': 'Designation',
    'website': 'Web Site',
    'bankName': 'Bank Name',
    'bankAddress': 'Bank Address',
    'bankAddress1': 'Bank Address1',
    'bankAccountNo': 'Bank Account No.',
    'range': 'Range',
    'commissionerate': 'Commissionerate',
    'division': 'Division',
    'referenceCustomer': 'Reference Customer',
    'documentThrough': 'Document Through',
    'dealerName': 'Dealer Name',
    'dealerAddress': 'Dealer Address',
    'dealerAddress1': 'Dealer Address1',
    'weeklyOff': 'Weekly Off',
    'groupCustomer': 'Group Customer',
    'distanceInKm': 'Distance in KM',
    'marketingBy': 'Marketing By',
    'salesmanName': 'Salesman Name',
  };

  @override
  void initState() {
    super.initState();
    for (final field in sections.values.expand((fields) => fields)) {
      final value = widget.initial?[field];
      controllers[field] = TextEditingController(text: value?.toString() ?? '');
    }
    for (final field in [
      'inUse',
      'merchantExporter',
      'insurance',
      'nda',
      'discountApplicable',
    ]) {
      booleans[field] = widget.initial?[field] as bool? ?? false;
    }
    _initializeGroup(
      officeControllers,
      widget.initial?['officeDetails'] as Map?,
    );
    _initializeGroup(
      taxControllers,
      widget.initial?['taxPaymentTerms'] as Map?,
    );
    _initializeGroup(otherControllers, widget.initial?['otherDetails'] as Map?);
    final initialContacts = widget.initial?['contacts'];
    if (initialContacts is List) {
      for (final item in initialContacts) {
        if (item is Map) _addContact(Map<String, dynamic>.from(item));
      }
    }
    if (contacts.isEmpty) _addContact();
  }

  void _initializeGroup(
    Map<String, TextEditingController> target,
    Map? source,
  ) {
    for (final field
        in target == officeControllers
            ? [
                'name',
                'address',
                'address1',
                'city',
                'pincode',
                'state',
                'faxNo',
                'phone',
                'email',
                'mobile',
                'contact',
                'designation',
                'website',
                'weeklyOff',
                'panNo',
                'gstNo',
              ]
            : target == taxControllers
            ? [
                'taxCategory',
                'paymentTerms',
                'creditDays',
                'taxRegistrationType',
              ]
            : ['notes', 'reference', 'remarks']) {
      target[field] = TextEditingController(
        text: source?[field]?.toString() ?? '',
      );
    }
  }

  void _addContact([Map<String, dynamic>? source]) {
    setState(() {
      contacts.add({
        for (final field in ['contactPerson', 'designation', 'mobile', 'email'])
          field: TextEditingController(text: source?[field]?.toString() ?? ''),
      });
    });
  }

  @override
  void dispose() {
    for (final controller in controllers.values) controller.dispose();
    for (final group in [officeControllers, taxControllers, otherControllers]) {
      for (final controller in group.values) controller.dispose();
    }
    for (final contact in contacts) {
      for (final controller in contact.values) controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate() || submitting) return;
    setState(() {
      submitting = true;
      error = null;
    });
    final fields = <String, dynamic>{
      for (final entry in controllers.entries)
        if (entry.key != 'name' && entry.value.text.trim().isNotEmpty)
          entry.key: _value(entry.key, entry.value.text),
      for (final entry in booleans.entries) entry.key: entry.value,
      'contacts': [
        for (final contact in contacts)
          if (contact.values.any(
            (controller) => controller.text.trim().isNotEmpty,
          ))
            {
              for (final entry in contact.entries)
                entry.key: entry.value.text.trim(),
            },
      ],
      'officeDetails': _groupPayload(officeControllers),
      'taxPaymentTerms': _groupPayload(taxControllers),
      'otherDetails': _groupPayload(otherControllers),
    };
    final result = await widget.onSubmit(controllers['name']!.text, fields);
    if (!mounted) return;
    if (result == null) {
      Navigator.pop(context, true);
    } else {
      setState(() {
        submitting = false;
        error = result;
      });
    }
  }

  dynamic _value(String field, String value) {
    if ([
      'interestPercent',
      'outstandingLimit',
      'agingLimit',
      'cashDiscountPercent',
      'distanceInKm',
    ].contains(field)) {
      return double.tryParse(value.trim()) ?? value.trim();
    }
    return value.trim();
  }

  Map<String, dynamic>? _groupPayload(
    Map<String, TextEditingController> group,
  ) {
    final values = <String, dynamic>{
      for (final entry in group.entries)
        if (entry.value.text.trim().isNotEmpty)
          entry.key: entry.value.text.trim(),
    };
    return values.isEmpty ? null : values;
  }

  Widget _textField(String field) => TextFormField(
    controller: controllers[field],
    decoration: InputDecoration(labelText: labels[field]),
    maxLines:
        [
          'address',
          'address1',
          'bankAddress',
          'bankAddress1',
          'dealerAddress',
          'dealerAddress1',
        ].contains(field)
        ? 2
        : 1,
    keyboardType:
        [
          'interestPercent',
          'outstandingLimit',
          'agingLimit',
          'cashDiscountPercent',
          'distanceInKm',
        ].contains(field)
        ? const TextInputType.numberWithOptions(decimal: true)
        : null,
    validator: field == 'name'
        ? (value) =>
              value == null || value.trim().isEmpty ? 'Name is required.' : null
        : null,
  );

  Widget _groupFields(Map<String, TextEditingController> group) => Wrap(
    spacing: 16,
    runSpacing: 8,
    children: [
      for (final entry in group.entries)
        SizedBox(
          width: 260,
          child: TextFormField(
            controller: entry.value,
            decoration: InputDecoration(labelText: _pretty(entry.key)),
          ),
        ),
    ],
  );

  String _pretty(String value) => value
      .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
      .replaceFirstMapped(
        RegExp(r'^\w'),
        (match) => match.group(0)!.toUpperCase(),
      );

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          for (final section in sections.entries)
            Card(
              margin: const EdgeInsets.only(bottom: 16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      section.key,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 16,
                      runSpacing: 8,
                      children: [
                        for (final field in section.value)
                          SizedBox(width: 260, child: _textField(field)),
                      ],
                    ),
                    if (section.key == 'Basic / Customer Details')
                      Wrap(
                        children: [
                          for (final field in [
                            'inUse',
                            'merchantExporter',
                            'insurance',
                            'nda',
                            'discountApplicable',
                          ])
                            SizedBox(
                              width: 180,
                              child: CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(_pretty(field)),
                                value: booleans[field],
                                onChanged: (value) => setState(
                                  () => booleans[field] = value ?? false,
                                ),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          _detailCard('Tax & Payment Terms', taxControllers),
          _detailCard('Other Details', otherControllers),
          _detailCard('Office Details', officeControllers),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Contact Persons',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  for (var index = 0; index < contacts.length; index++)
                    Row(
                      children: [
                        for (final entry in contacts[index].entries)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: TextFormField(
                                controller: entry.value,
                                decoration: InputDecoration(
                                  labelText: _pretty(entry.key),
                                ),
                              ),
                            ),
                          ),
                        IconButton(
                          onPressed: contacts.length == 1
                              ? null
                              : () => setState(() => contacts.removeAt(index)),
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                      ],
                    ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: contacts.length < 4 ? _addContact : null,
                      icon: const Icon(Icons.add),
                      label: const Text('Add contact'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: submitting ? null : submit,
              icon: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(widget.submitLabel),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailCard(String title, Map<String, TextEditingController> group) =>
      Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              _groupFields(group),
            ],
          ),
        ),
      );
}
