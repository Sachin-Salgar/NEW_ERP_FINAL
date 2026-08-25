import 'package:flutter/material.dart';
import 'package:new_erp_final_frontend/app/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await App.init();
  runApp(const App());
}
