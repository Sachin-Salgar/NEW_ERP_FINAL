class PermissionDescriptor {
  final String permissionKey;
  final String displayName;
  final String moduleCode;
  final String moduleName;
  final String resource;
  final String action;
  final String? description;

  const PermissionDescriptor({
    required this.permissionKey,
    required this.displayName,
    required this.moduleCode,
    required this.moduleName,
    required this.resource,
    required this.action,
    this.description,
  });

  static String _capitalise(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.length == 1) return trimmed.toUpperCase();
    return trimmed[0].toUpperCase() + trimmed.substring(1);
  }

  static String _humanizeAction(String action) {
    switch (action.trim().toLowerCase()) {
      case 'read':
        return 'View';
      case 'create':
        return 'Create';
      case 'update':
        return 'Edit';
      case 'delete':
        return 'Delete';
      case 'manage':
        return 'Manage';
      case 'list':
        return 'List';
      default:
        return action.trim().isEmpty ? 'Permission' : action.split('-').map(_capitalise).join(' ');
    }
  }

  static String _humanizeResource(String value) {
    final cleaned = value
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim();
    if (cleaned.isEmpty) return 'Permission';

    final words = cleaned.split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .map((word) => word.toLowerCase())
        .toList();

    if (words.isEmpty) return 'Permission';

    final normalized = words.map((word) {
      if (word == 'user') return 'Users';
      if (word == 'role') return 'Roles';
      if (word == 'permission') return 'Permissions';
      if (word == 'branch') return 'Branches';
      if (word == 'organization') return 'Organizations';
      if (word == 'organizations') return 'Organizations';
      if (word == 'tenant') return 'Tenant';
      if (word == 'session') return 'Sessions';
      return _capitalise(word);
    }).join(' ');

    return normalized;
  }

  static String humanizeModuleCode(String moduleCode) {
    final value = moduleCode.trim();
    if (value.isEmpty) return 'General';
    final map = <String, String>{
      'organization': 'Organizations',
      'branch': 'Branches',
      'user-management': 'User Management',
      'security': 'Security',
      'tenant-configuration': 'Tenant Configuration',
      'core': 'Core',
      'permission': 'Permissions',
      'role': 'Roles',
    };
    return map[value] ?? value
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .split(RegExp(r'\s+'))
        .map((word) => _capitalise(word))
        .join(' ');
  }

  static String displayNameFromKey({
    String? permissionKey,
    String? resource,
    String? action,
    String? displayName,
  }) {
    final explicit = (displayName ?? '').trim();
    if (explicit.isNotEmpty) return explicit;

    final key = (permissionKey ?? '').trim();
    if (key.isEmpty) return 'Permission';

    final parts = key.split('.');
    final resourceName = (resource ?? (parts.length > 1 ? parts.first : '')).trim();
    final actionName = (action ?? (parts.length > 1 ? parts.sublist(1).join('.') : '')).trim();

    final resourceLabel = _humanizeResource(resourceName.isNotEmpty ? resourceName : key);
    final actionLabel = _humanizeAction(actionName.isNotEmpty ? actionName : 'read');
    return '$actionLabel $resourceLabel';
  }

  static String moduleCodeFromPermissionKey(String permissionKey) {
    final key = permissionKey.trim();
    if (key.isEmpty) return 'general';
    final parts = key.split('.');
    if (parts.length < 2) return 'general';
    final resource = parts.first.trim().toLowerCase();
    final map = <String, String>{
      'organization': 'organization',
      'branch': 'branch',
      'user': 'user-management',
      'role': 'security',
      'permission': 'security',
      'session': 'security',
      'tenant': 'tenant-configuration',
    };
    return map[resource] ?? resource;
  }

  static PermissionDescriptor fromJson(dynamic value) {
    if (value is String) {
      final key = value.trim();
      final resource = key.contains('.') ? key.split('.').first : key;
      final action = key.contains('.') ? key.split('.').last : 'read';
      final moduleCode = moduleCodeFromPermissionKey(key);
      return PermissionDescriptor(
        permissionKey: key,
        displayName: displayNameFromKey(permissionKey: key, resource: resource, action: action),
        moduleCode: moduleCode,
        moduleName: humanizeModuleCode(moduleCode),
        resource: resource,
        action: action,
      );
    }

    if (value is Map) {
      final map = Map<String, dynamic>.from(value);
      final permissionKey = (map['permissionKey'] ?? map['permission_key'] ?? map['key'] ?? '').toString().trim();
      final displayName = (map['displayName'] ?? map['display_name'] ?? map['name'] ?? '').toString().trim();
      final moduleCode = (map['moduleCode'] ?? map['module_code'] ?? moduleCodeFromPermissionKey(permissionKey)).toString().trim();
      final resource = (map['resource'] ?? (permissionKey.contains('.') ? permissionKey.split('.').first : '')).toString().trim();
      final action = (map['action'] ?? (permissionKey.contains('.') ? permissionKey.split('.').last : 'read')).toString().trim();
      final descriptorName = displayNameFromKey(
        permissionKey: permissionKey,
        resource: resource,
        action: action,
        displayName: displayName,
      );
      return PermissionDescriptor(
        permissionKey: permissionKey.isNotEmpty ? permissionKey : 'unknown.permission',
        displayName: descriptorName,
        moduleCode: moduleCode.isNotEmpty ? moduleCode : moduleCodeFromPermissionKey(permissionKey),
        moduleName: humanizeModuleCode(moduleCode.isNotEmpty ? moduleCode : moduleCodeFromPermissionKey(permissionKey)),
        resource: resource.isNotEmpty ? resource : (permissionKey.contains('.') ? permissionKey.split('.').first : 'permission'),
        action: action.isNotEmpty ? action : 'read',
        description: (map['description'] ?? '').toString().trim().isEmpty ? null : (map['description'] ?? '').toString().trim(),
      );
    }

    throw const FormatException('Unsupported permission payload.');
  }

  static List<PermissionDescriptor> normalizePermissions(dynamic rawPermissions) {
    if (rawPermissions is! List) return const [];
    return rawPermissions.map((entry) => PermissionDescriptor.fromJson(entry)).toList(growable: false);
  }

  static Map<String, List<PermissionDescriptor>> groupByModule(List<PermissionDescriptor> permissions) {
    final grouped = <String, List<PermissionDescriptor>>{};
    for (final permission in permissions) {
      grouped.putIfAbsent(permission.moduleName, () => <PermissionDescriptor>[]).add(permission);
    }
    final sortedKeys = grouped.keys.toList()..sort();
    final result = <String, List<PermissionDescriptor>>{};
    for (final key in sortedKeys) {
      final items = grouped[key]!..sort((a, b) => a.displayName.compareTo(b.displayName));
      result[key] = items;
    }
    return result;
  }
}
