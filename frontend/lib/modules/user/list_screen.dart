import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'user_service.dart';
import '../../presentation/ui/components/page_header.dart';

class UserListScreen extends StatefulWidget {
  const UserListScreen({super.key});

  @override
  State<UserListScreen> createState() => _UserListScreenState();
}

class _UserListScreenState extends State<UserListScreen> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();

  @override
  void initState() {
    super.initState();
    service.fetchUsers();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: service,
        builder: (context, _) {
          if (service.isLoading)
            return const Center(child: CircularProgressIndicator());
          if (service.error != null)
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text('Unable to load users: ${service.error}'),
              ),
            );
          if (!auth.hasPermission('user.read'))
            return const Center(
              child: Text('You do not have permission to view users.'),
            );
          final users = service.users;
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                sliver: SliverToBoxAdapter(
                  child: ErpPageHeader(
                    title: 'Users',
                    subtitle: 'Manage user accounts and access',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(
                        label: 'Dashboard',
                        route: '/dashboard',
                      ),
                      ErpBreadcrumbItem(label: 'Users'),
                    ],
                    actions: auth.hasPermission('user.manage')
                        ? [
                            FilledButton.icon(
                              onPressed: () => Navigator.pushNamed(
                                context,
                                '/settings/users/create',
                              ),
                              icon: const Icon(Icons.add),
                              label: const Text('Add User'),
                            ),
                          ]
                        : null,
                  ),
                ),
              ),
              if (users.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Text('No users found')),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                  sliver: SliverToBoxAdapter(
                    child: Card(
                      clipBehavior: Clip.antiAlias,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          if (constraints.maxWidth < 700)
                            return Column(
                              children: users
                                  .map(
                                    (u) => ListTile(
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 20,
                                            vertical: 6,
                                          ),
                                      leading: CircleAvatar(
                                        child: Text(
                                          (u['username'] ?? u['email'] ?? '?')
                                              .toString()
                                              .substring(0, 1)
                                              .toUpperCase(),
                                        ),
                                      ),
                                      title: Text(
                                        u['username'] ??
                                            u['email'] ??
                                            'Unnamed',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      subtitle: Text(u['email'] ?? ''),
                                      trailing: Wrap(
                                        children: [
                                          if (auth.hasPermission('user.manage'))
                                            IconButton(
                                              icon: const Icon(
                                                Icons.edit_outlined,
                                              ),
                                              onPressed: () =>
                                                  Navigator.pushNamed(
                                                    context,
                                                    '/settings/users/edit',
                                                    arguments: u['id'],
                                                  ),
                                            ),
                                          IconButton(
                                            icon: const Icon(
                                              Icons.chevron_right,
                                            ),
                                            onPressed: () =>
                                                Navigator.pushNamed(
                                                  context,
                                                  '/settings/users/details',
                                                  arguments: u['id'],
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                  .toList(),
                            );
                          return DataTable(
                            columnSpacing: 30,
                            horizontalMargin: 20,
                            headingRowHeight: 52,
                            dataRowMinHeight: 62,
                            dataRowMaxHeight: 72,
                            columns: const [
                              DataColumn(label: Text('User')),
                              DataColumn(label: Text('Email')),
                              DataColumn(label: Text('Status')),
                              DataColumn(label: Text('')),
                            ],
                            rows: users
                                .map(
                                  (u) => DataRow(
                                    cells: [
                                      DataCell(
                                        Text(
                                          u['username'] ??
                                              u['email'] ??
                                              'Unnamed',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                      DataCell(Text(u['email'] ?? '—')),
                                      DataCell(
                                        Text(
                                          (u['status'] ?? 'Active').toString(),
                                        ),
                                      ),
                                      DataCell(
                                        Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            if (auth.hasPermission(
                                              'user.manage',
                                            ))
                                              IconButton(
                                                icon: const Icon(
                                                  Icons.edit_outlined,
                                                ),
                                                onPressed: () =>
                                                    Navigator.pushNamed(
                                                      context,
                                                      '/settings/users/edit',
                                                      arguments: u['id'],
                                                    ),
                                              ),
                                            IconButton(
                                              icon: const Icon(
                                                Icons.chevron_right,
                                              ),
                                              onPressed: () =>
                                                  Navigator.pushNamed(
                                                    context,
                                                    '/settings/users/details',
                                                    arguments: u['id'],
                                                  ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                                .toList(),
                          );
                        },
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
