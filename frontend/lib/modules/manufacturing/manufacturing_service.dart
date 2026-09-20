import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class ManufacturingService extends ChangeNotifier {
 ManufacturingService({required this.apiClient,required this.auth});
 final ApiClient apiClient; final AuthService auth;
 List<Map<String, dynamic>> capabilities = []; List<Map<String, dynamic>> workOrders = []; List<Map<String, dynamic>> machines = []; String? error; bool loading = false;
 Future<void> refresh() async {loading=true;error=null;notifyListeners();try{final a=await apiClient.get('/api/v1/manufacturing/capabilities?page=1&page_size=100');final b=await apiClient.get('/api/v1/manufacturing/work-orders?page=1&page_size=100');final m=await apiClient.get('/api/v1/manufacturing/machines?page=1&page_size=100');if(a.statusCode!=200||b.statusCode!=200||m.statusCode!=200)throw Exception(_message(a.statusCode!=200?a:b));capabilities=_list(a,'items');workOrders=_list(b,'items');machines=_list(m,'machines');}catch(e){error=e.toString().replaceFirst('Exception: ','');}finally{loading=false;notifyListeners();}}
 Future<Map<String, dynamic>?> getMachine(String id) async {
  try {
    final r = await apiClient.get('/api/v1/manufacturing/machines/$id');
    if (r.statusCode != 200) throw Exception(_message(r));
    return Map<String, dynamic>.from((jsonDecode(r.body) as Map)['machine'] as Map);
  } catch (e) { error = e.toString().replaceFirst('Exception: ', ''); notifyListeners(); return null; }
 }
 Future<Map<String,dynamic>?> createMachine(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/machines',body,201);
 Future<Map<String,dynamic>?> updateMachine(String id,Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/machines/$id',body,200,method:'patch');
 Future<Map<String,dynamic>?> deleteMachine(String id,int expectedVersion) async=>_mutate('/api/v1/manufacturing/machines/$id',{'expectedVersion':expectedVersion},200,method:'delete');
 Future<Map<String,dynamic>?> createTool(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/tools',body,201);
 Future<Map<String,dynamic>?> createFixture(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/fixtures',body,201);
 Future<Map<String,dynamic>?> createCalibration(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/calibrations',body,201);
 Future<Map<String,dynamic>?> createCapability(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/capabilities',body,201);
 Future<Map<String,dynamic>?> createProcess(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/process-details',body,201);
 Future<Map<String,dynamic>?> addRouting(String processId,Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/process-details/'+processId+'/routing-operations',body,201);
 Future<Map<String,dynamic>?> createWorkOrder(Map<String,dynamic> body) async{final result=await _mutate('/api/v1/manufacturing/work-orders',body,201);await refresh();return result;}
 Future<Map<String,dynamic>?> scheduleWorkOrder(String id) async{final result=await _mutate('/api/v1/manufacturing/work-orders/'+id+'/schedule',{},200);await refresh();return result;}
 Future<Map<String,dynamic>?> readiness(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/readiness/check',body,200);
 Future<Map<String,dynamic>?> punchProduction(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/production-output',body,201);
 Future<Map<String,dynamic>?> punchQuality(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/quality-output',body,201);
 Future<Map<String,dynamic>?> materialReturn(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/material-returns',body,201);
 Future<Map<String,dynamic>?> variance(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/variance-costs',body,201);
 Future<Map<String,dynamic>?> updateTask(String id,Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/task-sheets/'+id+'/status',body,200);
 Future<Map<String,dynamic>?> materialRequisition(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/material-requisitions',body,201);
 Future<Map<String,dynamic>?> issueMaterial(Map<String,dynamic> body) async=>_mutate('/api/v1/manufacturing/material-requisitions/issue',body,200);
 Future<Map<String,dynamic>?> _mutate(String path,Map<String,dynamic> body,int expected,{String method='post'}) async{try{final response=method=='patch'?await apiClient.patch(path,body:body):method=='delete'?await apiClient.delete(path,body:body):await apiClient.post(path,body:body);if(response.statusCode!=expected){error=_message(response);notifyListeners();return null;}error=null;notifyListeners();return jsonDecode(response.body) as Map<String,dynamic>;}catch(e){error=e.toString().replaceFirst('Exception: ','');notifyListeners();return null;}}
 List<Map<String,dynamic>> _list(dynamic response,String key){final b=jsonDecode(response.body) as Map<String,dynamic>;final raw=(b[key]??b['items']??const []) as List<dynamic>;return raw.map((e)=>Map<String,dynamic>.from(e as Map)).toList();}
 String _message(dynamic response){try{final b=jsonDecode(response.body);if(b is Map&&b['message'] is String)return b['message'] as String;}catch(_){ }return 'Request failed (HTTP '+response.statusCode.toString()+').';}
}
