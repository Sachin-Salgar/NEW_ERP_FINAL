import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'authz_service.dart';
import '../network/api_client.dart';

abstract class SecureStorageLike { Future<String?> read({required String key}); Future<void> write({required String key, required String value}); Future<void> delete({required String key}); }
class FlutterSecureStorageAdapter implements SecureStorageLike {
  final FlutterSecureStorage _inner = FlutterSecureStorage();
  @override Future<String?> read({required String key}) => _inner.read(key: key);
  @override Future<void> write({required String key, required String value}) => _inner.write(key: key, value: value);
  @override Future<void> delete({required String key}) => _inner.delete(key: key);
}

class AuthService extends ChangeNotifier {
  final AuthZService authzService;
  final SecureStorageLike _secureStorage;
  final ApiClient Function(String baseUrl) _apiClientFactory;
  late ApiClient _apiClient;
  AuthService({SecureStorageLike? secureStorage, ApiClient Function(String baseUrl)? apiClientFactory, AuthZService? authzService})
      : _secureStorage = secureStorage ?? FlutterSecureStorageAdapter(), _apiClientFactory = apiClientFactory ?? ((baseUrl) => ApiClient(baseUrl: baseUrl)), authzService = authzService ?? AuthZService();

  String? _accessToken, _refreshToken;
  DateTime? _expiresAt;
  String? currentTenantId, currentOrganizationId, currentLocationId;
  String? selectedOrganizationId, selectedLocationId;
  Map<String, dynamic>? currentUser, deploymentInfo;
  List<Map<String, dynamic>> availableOrganizations = const [], availableLocations = const [], availableModules = const [];
  bool requiresOrganizationSelection = false, requiresLocationSelection = false;
  bool get isAuthenticated => _accessToken != null && _expiresAt != null && DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;
  String get nextPostAuthRoute => isAuthenticated ? '/dashboard' : '/login';
  void _ensureApiClient(String baseUrl) => _apiClient = _apiClientFactory(baseUrl);

  Future<void> init() async {
    _accessToken = await _secureStorage.read(key: 'access_token'); _refreshToken = await _secureStorage.read(key: 'refresh_token');
    final exp = await _secureStorage.read(key: 'expires_at'); if (exp != null) _expiresAt = DateTime.tryParse(exp);
    currentTenantId = await _secureStorage.read(key: 'tenant_id'); currentOrganizationId = await _secureStorage.read(key: 'organization_id'); currentLocationId = await _secureStorage.read(key: 'location_id');
    selectedOrganizationId = currentOrganizationId; selectedLocationId = currentLocationId; if (_accessToken != null) notifyListeners();
  }

  Future<Map<String, dynamic>?> bootstrap(String baseUrl) async { _ensureApiClient(baseUrl); try { final r = await _apiClient.get('/api/v1/bootstrap'); if (r.statusCode != 200) return null; final b = jsonDecode(r.body) as Map<String,dynamic>; deploymentInfo = (b['deployment'] as Map<String,dynamic>?) ?? {}; notifyListeners(); return b; } catch (_) { return null; } }

  Future<bool> login(String baseUrl, String identifier, String password) async {
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.post('/api/v1/auth/login', body: {'identifier': identifier, 'password': password});
      if (r.statusCode != 200) return false; await _storeSession(jsonDecode(r.body) as Map<String,dynamic>);
      // Context is initialized from the user's configured defaults when available. Missing defaults do not block login.
      await loadAuthorizedOrganizations(baseUrl);
      if (currentOrganizationId != null) { await loadAuthorizedLocations(baseUrl); await loadAccessibleModules(baseUrl); await _loadPermissionsIfContextReady(baseUrl); }
      notifyListeners(); return true;
    } catch (_) { return false; }
  }

  Future<void> _storeSession(Map<String,dynamic> body) async {
    _accessToken = body['accessToken'] as String?; _refreshToken = body['refreshToken'] as String?; _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? ''); currentUser = body['user'] as Map<String,dynamic>?;
    final s = (body['session'] as Map<String,dynamic>?) ?? {}; final tenant = (s['tenantId'] ?? currentUser?['tenantId'] ?? '').toString().trim(); currentTenantId = tenant.isEmpty ? null : tenant;
    final org = (s['organizationId'] ?? currentUser?['organizationId'] ?? '').toString().trim(); currentOrganizationId = org.isEmpty ? null : org;
    final loc = (s['locationId'] ?? currentUser?['activeLocationId'] ?? '').toString().trim(); currentLocationId = loc.isEmpty ? null : loc; selectedOrganizationId = currentOrganizationId; selectedLocationId = currentLocationId;
    if (_accessToken != null) await _secureStorage.write(key:'access_token',value:_accessToken!); if (_refreshToken != null) await _secureStorage.write(key:'refresh_token',value:_refreshToken!); if (_expiresAt != null) await _secureStorage.write(key:'expires_at',value:_expiresAt!.toIso8601String());
    if (currentTenantId != null) await _secureStorage.write(key:'tenant_id',value:currentTenantId!); if (currentOrganizationId != null) await _secureStorage.write(key:'organization_id',value:currentOrganizationId!); if (currentLocationId != null) await _secureStorage.write(key:'location_id',value:currentLocationId!);
  }

  Future<bool> loadMe(String baseUrl) async { if (_accessToken == null) return false; _ensureApiClient(baseUrl); try { final r=await _apiClient.get('/api/v1/auth/me'); if(r.statusCode!=200)return false; final b=jsonDecode(r.body) as Map<String,dynamic>; currentUser=b['user'] as Map<String,dynamic>?; currentTenantId=(currentUser?['tenantId'] ?? currentTenantId)?.toString(); currentOrganizationId=(currentUser?['organizationId'] ?? currentOrganizationId)?.toString(); currentLocationId=(currentUser?['activeLocationId'] ?? currentLocationId)?.toString(); notifyListeners(); return true; } catch(_){return false;} }
  Future<bool> tryRefresh() async { if(_refreshToken==null||_refreshToken!.isEmpty)return false; try{final r=await _apiClient.post('/api/v1/auth/refresh',body:{'refreshToken':_refreshToken}); if(r.statusCode!=200)return false; final b=jsonDecode(r.body) as Map<String,dynamic>; _accessToken=b['accessToken'] as String?; _expiresAt=DateTime.tryParse(b['expiresAt']?.toString()??'')??_expiresAt; if(_accessToken!=null)await _secureStorage.write(key:'access_token',value:_accessToken!); notifyListeners(); return _accessToken!=null;}catch(_){return false;} }
  String _currentBaseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue:'http://localhost:3000');
  Future<bool> restoreSession(String baseUrl) async { _currentBaseUrl=baseUrl; if(_accessToken==null||_refreshToken==null)return false; if(_expiresAt!=null&&DateTime.now().isAfter(_expiresAt!)){if(!await tryRefresh()){await logout();return false;}} if(!await loadMe(baseUrl)){if(!await tryRefresh()||!await loadMe(baseUrl)){await logout();return false;}} await loadAuthorizedOrganizations(baseUrl); if(currentOrganizationId!=null){await loadAuthorizedLocations(baseUrl);await loadAccessibleModules(baseUrl);await _loadPermissionsIfContextReady(baseUrl);} return true; }

  Future<bool> loadAuthorizedOrganizations(String baseUrl) async { if(_accessToken==null)return false; _currentBaseUrl=baseUrl; _ensureApiClient(baseUrl); try{final r=await _apiClient.get('/api/v1/auth/organizations'); if(r.statusCode!=200)return false; final b=jsonDecode(r.body) as Map<String,dynamic>; final l=(b['organizations'] as List<dynamic>?)??const[]; availableOrganizations=l.map((x)=>Map<String,dynamic>.from(x as Map)).toList(); final active=(b['activeOrganizationId']??currentOrganizationId??'').toString().trim(); requiresOrganizationSelection=false; if(active.isNotEmpty&&availableOrganizations.any((o)=>(o['id']??'').toString()==active)){currentOrganizationId=active;selectedOrganizationId=active;await _secureStorage.write(key:'organization_id',value:active);} notifyListeners(); return true;}catch(_){return false;} }
  Future<bool> selectOrganization(String organizationId) async { final id=organizationId.trim(); if(id.isEmpty||!availableOrganizations.any((o)=>(o['id']??'').toString()==id))return false; try{final base=_currentBaseUrl;_ensureApiClient(base);final r=await _apiClient.post('/api/v1/auth/organizations/select',body:{'organizationId':id});if(r.statusCode!=200)return false;await _storeSession(jsonDecode(r.body) as Map<String,dynamic>);requiresOrganizationSelection=false;await loadAuthorizedLocations(base);await loadAccessibleModules(base);await _loadPermissionsIfContextReady(base);notifyListeners();return true;}catch(_){return false;} }
  Future<bool> loadAuthorizedLocations(String baseUrl) async { if(_accessToken==null||currentOrganizationId==null)return false; _currentBaseUrl=baseUrl;_ensureApiClient(baseUrl);try{final r=await _apiClient.get('/api/v1/locations');if(r.statusCode!=200)return false;final b=jsonDecode(r.body) as Map<String,dynamic>;final l=(b['locations'] as List<dynamic>?)??const[];availableLocations=l.map((x)=>Map<String,dynamic>.from(x as Map)).toList();final active=(b['activeLocationId']??currentLocationId??'').toString().trim();requiresLocationSelection=false;if(active.isNotEmpty&&availableLocations.any((x)=>(x['id']??'').toString()==active)){currentLocationId=active;selectedLocationId=active;await _secureStorage.write(key:'location_id',value:active);}notifyListeners();return true;}catch(_){return false;} }
  Future<bool> selectLocation(String locationId) async {final id=locationId.trim();if(id.isEmpty||!availableLocations.any((x)=>(x['id']??'').toString()==id))return false;try{final base=_currentBaseUrl;_ensureApiClient(base);final r=await _apiClient.post('/api/v1/locations/$id/select');if(r.statusCode!=200)return false;await _storeSession(jsonDecode(r.body) as Map<String,dynamic>);currentLocationId=id;selectedLocationId=id;requiresLocationSelection=false;await _loadPermissionsIfContextReady(base);notifyListeners();return true;}catch(_){return false;} }
  Future<bool> loadAccessibleModules(String baseUrl) async {if(_accessToken==null||currentOrganizationId==null)return false;_currentBaseUrl=baseUrl;_ensureApiClient(baseUrl);try{final r=await _apiClient.get('/api/v1/auth/modules');if(r.statusCode!=200)return false;final b=jsonDecode(r.body) as Map<String,dynamic>;availableModules=((b['modules'] as List<dynamic>?)??const[]).map((x)=>Map<String,dynamic>.from(x as Map)).toList();notifyListeners();return true;}catch(_){return false;}}
  Future<List<String>> fetchEffectivePermissions(String baseUrl) async {if(_accessToken==null||currentUser==null)return[];_currentBaseUrl=baseUrl;_ensureApiClient(baseUrl);final id=currentUser?['id'] as String?;if(id==null)return[];return authzService.loadPermissions(_apiClient,id);}
  Future<void> _loadPermissionsIfContextReady(String baseUrl) async {if(_accessToken==null||currentUser==null||currentOrganizationId==null)return;await fetchEffectivePermissions(baseUrl);}
  bool hasPermission(String key)=>authzService.hasPermission(key); bool hasModule(String code)=>code.trim().isEmpty||availableModules.isEmpty||availableModules.any((m)=>(m['code']??'').toString()==code.trim());
  Future<void> logout() async {try{if(_accessToken!=null){_ensureApiClient(_currentBaseUrl);await _apiClient.post('/api/v1/auth/logout');}}catch(_){} _accessToken=null;_refreshToken=null;_expiresAt=null;currentTenantId=null;currentOrganizationId=null;currentLocationId=null;selectedOrganizationId=null;selectedLocationId=null;currentUser=null;availableOrganizations=const[];availableLocations=const[];availableModules=const[];requiresOrganizationSelection=false;requiresLocationSelection=false;authzService.clear();for(final k in ['access_token','refresh_token','expires_at','tenant_id','organization_id','location_id'])await _secureStorage.delete(key:k);notifyListeners();}
}
