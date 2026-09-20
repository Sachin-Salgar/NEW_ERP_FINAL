import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';

class SecurityAdministrationScreen extends StatefulWidget {
  const SecurityAdministrationScreen({super.key});
  @override State<SecurityAdministrationScreen> createState() => _SecurityAdministrationScreenState();
}

class _SecurityAdministrationScreenState extends State<SecurityAdministrationScreen> {
  late final ApiClient _api;
  Map<String, dynamic>? _policy;
  List<dynamic> _sessions = [];
  List<dynamic> _logs = [];
  Map<String, dynamic> _metadata = {};
  String? _error;
  final _actor = TextEditingController();
  final _action = TextEditingController();
  final _resourceType = TextEditingController();
  final _resourceId = TextEditingController();
  final _correlation = TextEditingController();
  int _page = 1;
  int _pageSize = 20;
  String _order = 'desc';

  @override void initState() { super.initState(); _api=GetIt.instance.get<ApiClient>(); _load(); }
  @override void dispose() { _actor.dispose(); _action.dispose(); _resourceType.dispose(); _resourceId.dispose(); _correlation.dispose(); super.dispose(); }

  String _message(dynamic r) {
    try { final b=jsonDecode(r.body); final e=b['error']; return '\${b['message'] ?? (e is Map ? e['message'] : e) ?? 'Request failed.'}'; }
    catch (_) { return 'Request failed (HTTP \${r.statusCode}).'; }
  }

  Future<void> _load() async {
    try {
      final query = <String, String>{'page':'$_page','page_size':'$_pageSize','order':_order};
      final values = {'actorUserId':_actor.text,'action':_action.text,'resourceType':_resourceType.text,'resourceId':_resourceId.text,'correlationId':_correlation.text};
      values.forEach((k,v){if(v.trim().isNotEmpty)query[k]=v.trim();});
      final qs=query.entries.map((e)=>'\${Uri.encodeQueryComponent(e.key)}=\${Uri.encodeQueryComponent(e.value)}').join('&');
      final results=await Future.wait([_api.get('/api/v1/security/policy'),_api.get('/api/v1/security/sessions'),_api.get('/api/v1/security/audit-logs?$qs')]);
      if(!mounted)return;
      final audit=jsonDecode(results[2].body);
      setState((){_policy=jsonDecode(results[0].body)['policy'] as Map<String,dynamic>;_sessions=(jsonDecode(results[1].body)['sessions'] as List<dynamic>?)??[];_logs=(audit['logs'] as List<dynamic>?)??[];_metadata=(audit['metadata'] as Map<String,dynamic>?)??{};_error=null;});
    } catch(e){if(mounted)setState(()=>_error=e.toString());}
  }

  Future<void> _revoke(String id) async { final r=await _api.post('/api/v1/security/sessions/$id/revoke'); if(r.statusCode>=400)throw Exception(_message(r)); await _load(); }
  Future<void> _revokeAll(String userId) async { final r=await _api.post('/api/v1/security/users/$userId/sessions/revoke-all'); if(r.statusCode>=400)throw Exception(_message(r)); await _load(); }

  Future<void> _exportAudit() async {
    final r=await _api.get('/api/v1/security/audit-logs/export?limit=100');
    if(!mounted)return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(r.statusCode<400?'Audit export generated.':_message(r))));
  }

  Future<void> _editPolicy() async {
    if(_policy==null)return;
    final session=TextEditingController(text:'\${_policy!['sessionLifetimeMinutes']}');
    final failed=TextEditingController(text:'\${_policy!['maxFailedLoginAttempts']}');
    final lockout=TextEditingController(text:'\${_policy!['lockoutMinutes']}');
    var mfa=_policy!['mfaRequired']==true;
    final result=await showDialog<bool>(context:context,builder:(c)=>StatefulBuilder(builder:(c,setDialog)=>AlertDialog(title:const Text('Edit Security Policy'),content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
      SwitchListTile(title:const Text('Require MFA'),value:mfa,onChanged:(v)=>setDialog(()=>mfa=v)),
      TextField(controller:session,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Session lifetime (minutes)')),
      TextField(controller:failed,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Maximum failed login attempts')),
      TextField(controller:lockout,keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Lockout duration (minutes)')),
    ])),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Save'))]));
    if(result!=true)return;
    final r=await _api.patch('/api/v1/security/policy',body:{'mfaRequired':mfa,'sessionLifetimeMinutes':int.tryParse(session.text),'maxFailedLoginAttempts':int.tryParse(failed.text),'lockoutMinutes':int.tryParse(lockout.text)});
    session.dispose();failed.dispose();lockout.dispose();
    if(!mounted)return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(r.statusCode<400?'Security policy updated.':_message(r))));
    if(r.statusCode<400)await _load();
  }

  Widget _filters() => Card(child:Padding(padding:const EdgeInsets.all(16),child:Wrap(spacing:12,runSpacing:12,children:[
    _filter(_actor,'Actor user ID'),_filter(_action,'Action'),_filter(_resourceType,'Resource type'),_filter(_resourceId,'Resource ID'),_filter(_correlation,'Correlation ID'),
    DropdownButton<String>(value:_order,items:const [DropdownMenuItem(value:'desc',child:Text('Newest first')),DropdownMenuItem(value:'asc',child:Text('Oldest first'))],onChanged:(v){if(v!=null)setState(()=>_order=v);}),
    FilledButton.icon(onPressed:(){_page=1;_load();},icon:const Icon(Icons.search),label:const Text('Apply filters')),
    OutlinedButton(onPressed:(){_actor.clear();_action.clear();_resourceType.clear();_resourceId.clear();_correlation.clear();_page=1;_load();},child:const Text('Clear')),
  ])));

  Widget _filter(TextEditingController c,String label)=>SizedBox(width:190,child:TextField(controller:c,decoration:InputDecoration(labelText:label,border:const OutlineInputBorder())));

  @override Widget build(BuildContext context){
    if(_error!=null)return Scaffold(appBar:AppBar(title:const Text('Security Administration')),body:Center(child:Text('Unable to load security administration: $_error')));
    if(_policy==null)return const Scaffold(body:Center(child:CircularProgressIndicator()));
    final totalPages=(_metadata['total_pages'] as num?)?.toInt()??1;
    return Scaffold(appBar:AppBar(title:const Text('Security Administration'),actions:[IconButton(onPressed:_editPolicy,icon:const Icon(Icons.tune)),IconButton(onPressed:_load,icon:const Icon(Icons.refresh))]),body:RefreshIndicator(onRefresh:_load,child:ListView(padding:const EdgeInsets.all(24),children:[
      const Text('Security Policy',style:TextStyle(fontSize:20,fontWeight:FontWeight.bold)),
      ListTile(title:const Text('Require MFA'),subtitle:Text(_policy!['mfaRequired']==true?'Enabled':'Disabled')),
      ListTile(title:const Text('Session lifetime'),subtitle:Text('\${_policy!['sessionLifetimeMinutes']} minutes')),
      ListTile(title:const Text('Maximum failed logins'),subtitle:Text('\${_policy!['maxFailedLoginAttempts']} attempts')),
      ListTile(title:const Text('Lockout duration'),subtitle:Text('\${_policy!['lockoutMinutes']} minutes')),
      const SizedBox(height:24),
      const Text('Active Sessions',style:TextStyle(fontSize:20,fontWeight:FontWeight.bold)),
      ..._sessions.map((s)=>ListTile(title:Text(s['userId']?.toString()??'Session'),subtitle:Text(s['loginAt']?.toString()??''),trailing:Wrap(children:[IconButton(icon:const Icon(Icons.logout),onPressed:()=>_revoke(s['id'].toString())),IconButton(icon:const Icon(Icons.logout_outlined),onPressed:()=>_revokeAll(s['userId'].toString()))]))),
      const SizedBox(height:24),
      Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[const Text('Audit Query',style:TextStyle(fontSize:20,fontWeight:FontWeight.bold)),TextButton(onPressed:_exportAudit,child:const Text('Export'))]),
      _filters(),
      const SizedBox(height:8),
      ..._logs.map((log)=>ListTile(title:Text('\${log['action']??''} • \${log['resourceType']??''}'),subtitle:Text('\${log['createdAt']??''} • actor: \${log['actorUserId']??''}\nresource: \${log['resourceId']??''} • correlation: \${log['correlationId']??''}'))),
      Row(mainAxisAlignment:MainAxisAlignment.center,children:[IconButton(onPressed:_page>1?(){setState(()=>_page--);_load();}:null,icon:const Icon(Icons.chevron_left)),Text('Page $_page of $totalPages'),IconButton(onPressed:_page<totalPages?(){setState(()=>_page++);_load();}:null,icon:const Icon(Icons.chevron_right)),const SizedBox(width:12),DropdownButton<int>(value:_pageSize,items:const [20,50,100].map((v)=>DropdownMenuItem(value:v,child:Text('$v / page'))).toList(),onChanged:(v){if(v!=null){setState((){_pageSize=v;_page=1;});_load();}})]),
    ])));
  }
}
