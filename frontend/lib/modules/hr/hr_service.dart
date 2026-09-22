// dart format off
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class HrService extends ChangeNotifier {
  final ApiClient apiClient; final AuthService auth;
  HrService({required this.apiClient,required this.auth});
  bool loading=false; String? error; List<Map<String,dynamic>> employees=[]; final Map<String,List<Map<String,dynamic>>> data={};
  Future<void> loadEmployees()=>load('employees');
  Future<void> load(String resource) async { loading=true; error=null; notifyListeners(); try { final response=await apiClient.get('/api/v1/hr/$resource?page=1&page_size=100'); if(response.statusCode!=200)throw Exception(response.body); final body=jsonDecode(response.body) as Map<String,dynamic>; final rows=((body['items'] as List?)??const[]).map((x)=>Map<String,dynamic>.from(x as Map)).toList(); data[resource]=rows; if(resource=='employees')employees=rows; } catch(e){error=e.toString();} finally{loading=false;notifyListeners();} }
  Future<Map<String,dynamic>> createEmployee(Map<String,dynamic> body) async=>create('employees',body);
  Future<Map<String,dynamic>> create(String resource,Map<String,dynamic> body) async { final response=await apiClient.post('/api/v1/hr/$resource',body:body); if(response.statusCode<200||response.statusCode>=300)throw Exception(response.body); final record=Map<String,dynamic>.from((jsonDecode(response.body) as Map<String,dynamic>)['record'] as Map); await load(resource); return record; }
  Future<void> punch(String employeeId,bool checkIn) async { final suffix=checkIn?'/check-in':'/check-out'; final response=await apiClient.post('/api/v1/hr/attendance/$employeeId$suffix',body:const{}); if(response.statusCode<200||response.statusCode>=300)throw Exception(response.body); await load('attendance'); }
  Future<void> submit(String resource,String id) async { final response=await apiClient.post('/api/v1/hr/$resource/$id/submit',body:const{}); if(response.statusCode<200||response.statusCode>=300)throw Exception(response.body); await load(resource); }
}
