import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
class WorkflowService extends ChangeNotifier {
 WorkflowService({required this.apiClient,required this.auth}); final ApiClient apiClient; final AuthService auth;
 bool loading=false; String? error; List<Map<String,dynamic>> tasks=[]; List<Map<String,dynamic>> definitions=[];
 Future<void> load() async { loading=true; error=null; notifyListeners(); try { final a=await apiClient.get('/api/v1/workflow/tasks'); final b=await apiClient.get('/api/v1/workflow/definitions'); _ok(a); _ok(b); tasks=_items(a,'tasks'); definitions=_items(b,'definitions'); } catch(e) { error=e.toString().replaceFirst('Exception: ',''); } finally { loading=false; notifyListeners(); } }
 Future<Map<String,dynamic>?> createDefinition(Map<String,dynamic> body)=>_post('/api/v1/workflow/definitions',body,201);
 Future<Map<String,dynamic>?> publish(String id)=>_post('/api/v1/workflow/definitions/'+id+'/publish',{},200);
 Future<Map<String,dynamic>?> decide(String id,String decision,String comments)=>_post('/api/v1/workflow/tasks/'+id+'/decision',{'decision':decision,'comments':comments},200);
 List<Map<String,dynamic>> _items(dynamic r,String k){ final b=jsonDecode(r.body) as Map<String,dynamic>; return ((b[k]??const []) as List).map((e)=>Map<String,dynamic>.from(e as Map)).toList(); }
 void _ok(dynamic r){ if(r.statusCode<200||r.statusCode>=300) throw Exception(_message(r)); }
 Future<Map<String,dynamic>?> _post(String p,Map<String,dynamic>b,int expected) async { try { final r=await apiClient.post(p,body:b); if(r.statusCode!=expected){error=_message(r);notifyListeners();return null;} await load(); return Map<String,dynamic>.from(jsonDecode(r.body) as Map); } catch(e){error=e.toString().replaceFirst('Exception: ','');notifyListeners();return null;} }
 String _message(dynamic r){ try { final b=jsonDecode(r.body); if(b is Map&&b['message'] is String)return b['message']; } catch(_){} return 'Request failed (HTTP '+r.statusCode.toString()+').'; }
}