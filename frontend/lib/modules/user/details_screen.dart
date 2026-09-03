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
  int _selectedSection = 0;

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

    final sections = <Widget>[
      UserProfileSection(
        user: user!,
        onUserChanged: (updated) => setState(() => user = updated),
      ),
      SizedBox(
        height: 520,
        child: UserRolesSection(userId: user!['id'].toString()),
      ),
      UserAccessSection(userId: user!['id'].toString()),
    ];
    return Scaffold(
      body: SafeArea(
        child: DefaultTabController(
          length: 3,
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
                    TabBar(
                      onTap: (index) =>
                          setState(() => _selectedSection = index),
                      tabs: const [
                        Tab(text: 'Profile'),
                        Tab(text: 'Roles'),
                        Tab(text: 'Access'),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: sections[_selectedSection],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
