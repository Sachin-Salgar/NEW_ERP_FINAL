import 'package:flutter/material.dart';

class TopBar extends StatelessWidget implements PreferredSizeWidget {
  final Widget? leading;
  final List<Widget>? actions;
  final String title;

  const TopBar({Key? key, this.leading, this.actions, this.title = ''})
    : super(key: key);

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title, style: Theme.of(context).textTheme.titleLarge),
      centerTitle: false,
      elevation: 0,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      foregroundColor: Theme.of(context).textTheme.bodyLarge?.color,
      leading: leading,
      actions: actions,
      shape: Border(
        bottom: BorderSide(color: Theme.of(context).dividerColor, width: 1),
      ),
    );
  }
}
