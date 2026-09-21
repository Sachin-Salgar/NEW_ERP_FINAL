// dart format off
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'hr_service.dart';

class HrScreen extends StatefulWidget { const HrScreen({super.key}); @override State<HrScreen> createState()=>_HrScreenState(); }
class _HrScreenState extends State<HrScreen>{
 final service=GetIt.I<HrService>(); int tab=0; final fields=<String,TextEditingController>{};
 final tabs=<Map<String,String>>[
  {'title':'Employees','resource':'employees'},{'title':'Organization','resource':'departments'},{'title':'Attendance','resource':'attendance'},{'title':'Leave','resource':'leaveRequests'},{'title':'Payroll','resource':'payrollRuns'},{'title':'Recruitment','resource':'requisitions'},{'title':'Performance','resource':'performanceCycles'},{'title':'Training','resource':'trainingPrograms'},{'title':'Compliance','resource':'compliance'},{'title':'ESS','resource':'employeeRequests'},{'title':'Reports','resource':'analytics/workforce'},
 ];
 @override void initState(){super.initState();_loadTab();}
 void _loadTab(){final r=tabs[tab]['resource']!;if(r!='analytics/workforce')service.load(r);}
 @override void dispose(){for(final c in fields.values)c.dispose();super.dispose();}
 TextEditingController _c(String k)=>fields.putIfAbsent(k,()=>TextEditingController());
 String _label(String k)=>k.replaceAll('_',' ');
 Future<void> _create(String resource) async{final data=<String,dynamic>{};for(final e in fields.entries)if(e.value.text.trim().isNotEmpty)data[e.key]=e.value.text.trim();if(resource=='employees'){data['employment_status']='ACTIVE';data['joining_date']=data['joining_date']??DateTime.now().toIso8601String().substring(0,10);}try{await service.create(resource,data);if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('HR record created')));}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}}
 Widget _field(String key,{bool multiline=false})=>Padding(padding:const EdgeInsets.only(bottom:10),child:TextField(controller:_c(key),maxLines:multiline?3:1,decoration:InputDecoration(labelText:_label(key),border:const OutlineInputBorder())));
 List<String> _formFields(String resource){switch(resource){case'employees':return['employee_no','first_name','middle_name','last_name','preferred_name','gender','date_of_birth','personal_email','work_email','phone','joining_date','confirmation_date','employment_type','grade','cost_center','branch_id','department_id','position_id'];case'departments':return['code','name','branch_id','parent_id'];case'attendance':return['employee_id','attendance_date','status','check_in','check_out','break_minutes','overtime_minutes','remarks'];case'leaveRequests':return['employee_id','leave_type_id','start_date','end_date','days','reason'];case'payrollRuns':return['payroll_period_id'];case'requisitions':return['requisition_no','title','department_id','position_id','vacancies','justification'];case'performanceCycles':return['code','name','start_date','end_date'];case'trainingPrograms':return['code','name','description','provider','duration_hours'];case'compliance':return['employee_id','record_type','title','due_date','details'];case'employeeRequests':return['employee_id','request_type','payload'];default:return['code','name'];}}
 String _title(String resource){for(final t in tabs)if(t['resource']==resource)return t['title']!;return _label(resource);}
 String _primary(Map<String,dynamic> r){for(final k in['employee_no','code','name','title','requisition_no','period_code','status']){if(r[k]!=null&&r[k].toString().isNotEmpty)return r[k].toString();}return r['id']?.toString()??'Record';}
 String _secondary(Map<String,dynamic> r)=>[r['first_name'],r['last_name'],r['work_email'],r['employment_status'],r['status']].where((x)=>x!=null&&x.toString().isNotEmpty).join(' • ');
 Widget _workspace(String resource) {
  final rows = service.data[resource] ?? const <Map<String, dynamic>>[];
  final formFields = _formFields(resource);
  final children = <Widget>[
    Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(_title(resource), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        IconButton(onPressed: () => service.load(resource), icon: const Icon(Icons.refresh)),
      ],
    ),
    const SizedBox(height: 12),
    Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Create / Configure', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            for (final field in formFields)
              _field(field, multiline: field == 'reason' || field == 'description' || field == 'justification' || field == 'details' || field == 'payload'),
            FilledButton.icon(
              onPressed: () => _create(resource),
              icon: const Icon(Icons.add),
              label: Text('Create ' + _title(resource) + ' record'),
            ),
          ],
        ),
      ),
    ),
    const SizedBox(height: 16),
  ];
  if (service.loading) children.add(const Center(child: CircularProgressIndicator()));
  if (service.error != null) children.add(Text(service.error!, style: const TextStyle(color: Colors.red)));
  children.add(Text(rows.length.toString() + ' records', style: Theme.of(context).textTheme.titleSmall));
  for (final row in rows) {
    children.add(
      Card(
        child: ListTile(
          title: Text(_primary(row)),
          subtitle: Text(_secondary(row)),
        ),
      ),
    );
  }
  return ListView(children: children);
 }
 Widget _reports(){return Card(child:Padding(padding:const EdgeInsets.all(20),child:Text('Workforce analytics: headcount, active/exited employees and department manpower are available from the HR analytics endpoint.')));}
 @override Widget build(BuildContext context){final resource=tabs[tab]['resource']!;return Scaffold(appBar:AppBar(title:const Text('Human Resources')),body:Column(children:[SingleChildScrollView(scrollDirection:Axis.horizontal,child:Row(children:tabs.asMap().entries.map((e)=>Padding(padding:const EdgeInsets.all(4),child:ChoiceChip(label:Text(e.value['title']!),selected:tab==e.key,onSelected:(_){setState(()=>tab=e.key);_loadTab();}))).toList())),Expanded(child:Padding(padding:const EdgeInsets.all(16),child:resource=='analytics/workforce'?_reports():_workspace(resource))) ]));}
}
