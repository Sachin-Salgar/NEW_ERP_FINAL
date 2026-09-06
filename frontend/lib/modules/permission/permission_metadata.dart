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
    final value = action.trim();
    return value.isEmpty ? 'Permission' : _humanizeWords(value);
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

    return words.map(_capitalise).join(' ');
  }

  static String humanizeModuleCode(String moduleCode) {
    final value = moduleCode.trim();
    if (value.isEmpty) return 'General';
    return _humanizeWords(value);
  }

  static String _humanizeWords(String value) {
    return value
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .map(_capitalise)
        .join(' ');
  }

  static String resourceDisplayName(String resource) {
    final label = _humanizeWords(resource);
    if (label.isEmpty) return 'Resource';
    if (label.endsWith('s')) return label;
    return '$label${label.endsWith('y') ? 'ies' : 's'}';
  }

  static String actionDisplayName(String action) => _humanizeAction(action);

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
    return parts.length > 2 ? parts.first.trim().toLowerCase() : 'general';
  }

  static PermissionDescriptor fromJson(dynamic value) {
    if (value is String) {
      final key = value.trim();
      final parts = key.split('.');
      final moduleCode = parts.length > 2 ? parts.first : moduleCodeFromPermissionKey(key);
      final resource = parts.length > 2 ? parts[1] : (parts.length > 1 ? parts.first : key);
      final action = parts.length > 2 ? parts.sublist(2).join('.') : (parts.length > 1 ? parts.last : 'read');
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

  static List<PermissionMatrixModule> buildMatrix(List<PermissionDescriptor> permissions) {
    final modules = <String, PermissionMatrixModule>{};
    for (final permission in permissions) {
      final module = modules.putIfAbsent(
        permission.moduleCode,
        () => PermissionMatrixModule(
          moduleCode: permission.moduleCode,
          displayName: permission.moduleName,
        ),
      );
      module.add(permission);
    }
    final result = modules.values.toList()
      ..sort((a, b) => a.displayName.compareTo(b.displayName));
    for (final module in result) {
      module.sort();
    }
    return result;
  }

  static Map<String, List<PermissionDescriptor>> groupByModule(List<PermissionDescriptor> permissions) {
    final grouped = <String, List<PermissionDescriptor>>{};
    for (final permission in permissions) {
      grouped.putIfAbsent(permission.moduleName, () => <PermissionDescriptor>[]).add(permission);
    }
    for (final items in grouped.values) {
      items.sort((a, b) => a.displayName.compareTo(b.displayName));
    }
    return Map.fromEntries(
      grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key)),
    );
  }
}

class PermissionMatrixModule {
  final String moduleCode;
  final String displayName;
  final Map<String, PermissionMatrixResource> _resources = {};

  PermissionMatrixModule({required this.moduleCode, required this.displayName});

  List<PermissionMatrixResource> get resources => _resources.values.toList(growable: false);

  void add(PermissionDescriptor permission) {
    _resources
        .putIfAbsent(
          permission.resource,
          () => PermissionMatrixResource(
            resourceCode: permission.resource,
            displayName: PermissionDescriptor.resourceDisplayName(permission.resource),
          ),
        )
        .add(permission);
  }

  void sort() {
    for (final resource in _resources.values) {
      resource.sort();
    }
    final sorted = _resources.entries.toList()
      ..sort((a, b) => a.value.displayName.compareTo(b.value.displayName));
    _resources
      ..clear()
      ..addEntries(sorted);
  }
}

class PermissionMatrixResource {
  final String resourceCode;
  final String displayName;
  final Map<String, PermissionDescriptor> _actions = {};

  PermissionMatrixResource({required this.resourceCode, required this.displayName});

  List<String> get actions => _actions.keys.toList(growable: false);

  PermissionDescriptor? permissionFor(String action) => _actions[action];

  void add(PermissionDescriptor permission) {
    _actions.putIfAbsent(permission.action, () => permission);
  }

  void sort() {
    final sorted = _actions.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    _actions
      ..clear()
      ..addEntries(sorted);
  }
}
