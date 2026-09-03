import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../presentation/ui/components/back_button.dart';
import '../../presentation/ui/components/page_header.dart';
import 'components/user_access_section.dart';
import 'components/user_profile_section.dart';
import 'components/user_roles_section.dart';
import 'user_service.dart';

class UserDetailsScreen extends StatefulWidget {
  final String? id;

  const UserDetailsScreen({super.key, this.id});

  @override
  State<UserDetailsScreen> createState() => _UserDetailsScreenState();
}

class _UserDetailsScreenState extends State<UserDetailsScreen> {
  final service = GetIt.instance.get<UserService>();
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;
  bool _rolesExpanded = true;
  bool _accessExpanded = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeId =
        widget.id ?? (ModalRoute.of(context)?.settings.arguments as String?);
    if (routeId != null && routeId.isNotEmpty && user == null) _load(routeId);
  }

  Future<void> _load(String id) async {
    if (!mounted) return;
    setState(() => loading = true);
    final loadedUser = await service.getUser(id);
    if (!mounted) return;
    setState(() {
      user = loadedUser;
      loading = false;
      error = loadedUser == null ? 'User not found' : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (user == null) {
      return Scaffold(body: Center(child: Text(error ?? 'User not found')));
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ErpPageHeader(
                    title: user!['username'] ?? 'User details',
                    subtitle: user!['email'] ?? '',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Users'),
                      ErpBreadcrumbItem(label: 'Details'),
                    ],
                    actions: [
                      SettingsBackButton(parentRoute: '/settings/users'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _UserSummary(user: user!),
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Profile',
                    subtitle: 'Personal and organizational information',
                    child: UserProfileSection(
                      user: user!,
                      onUserChanged: (updated) =>
                          setState(() => user = updated),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Roles',
                    actionLabel: _rolesExpanded ? 'Hide Roles' : 'Manage Roles',
                    onAction: () =>
                        setState(() => _rolesExpanded = !_rolesExpanded),
                    child: Visibility(
                      visible: _rolesExpanded,
                      maintainState: true,
                      child: SizedBox(
                        height: 520,
                        child: UserRolesSection(userId: user!['id'].toString()),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Access',
                    subtitle: 'Organization and branch access',
                    actionLabel: _accessExpanded
                        ? 'Hide Access'
                        : 'Manage Access',
                    onAction: () =>
                        setState(() => _accessExpanded = !_accessExpanded),
                    child: Visibility(
                      visible: _accessExpanded,
                      maintainState: true,
                      child: UserAccessSection(userId: user!['id'].toString()),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _UserSummary extends StatelessWidget {
  final Map<String, dynamic> user;

  const _UserSummary({required this.user});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final username = user['username']?.toString().trim().isNotEmpty == true
        ? user['username'].toString()
        : 'User';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(child: Text(username.substring(0, 1).toUpperCase())),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    username,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(user['email']?.toString() ?? '—'),
                  const SizedBox(height: 8),
                  Chip(label: Text(user['status']?.toString() ?? '—')),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget child;

  const _SectionCard({
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(subtitle!, style: theme.textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
                if (actionLabel != null)
                  TextButton(onPressed: onAction, child: Text(actionLabel!)),
              ],
            ),
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}
