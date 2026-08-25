Frontend scaffold for NEW_ERP_FINAL

This folder contains the Flutter frontend scaffold for CORE-01 foundation. It includes:

- main.dart entrypoint
- app initialization and DI
- API client, Auth service, secure storage
- Routing and auth guard
- App shell and dashboard placeholder

Notes:
- Flutter SDK is NOT available in the current environment, so no formatting/analyzer/tests were run here.
- To run the frontend locally:
  1. Install Flutter SDK (https://flutter.dev/docs/get-started/install)
  2. From this directory: flutter pub get
  3. Run: flutter run
  4. Run tests: flutter test

Configuration:
- API base URL: set via --dart-define=API_BASE_URL or update AuthService._determineBaseUrl
- Tenant header: frontend sends x-tenant-id header per backend requirements
