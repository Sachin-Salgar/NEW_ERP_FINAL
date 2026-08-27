Frontend scaffold for NEW_ERP_FINAL

This folder contains the Flutter frontend scaffold for the ERP platform. It includes:

- main.dart entrypoint
- app initialization and DI
- API client, Auth service, secure storage
- Routing and auth guard
- App shell and dashboard placeholder

Notes:
- Flutter SDK may not be available in every repository validation environment; frontend validation must run in a Flutter-enabled environment.
- To run the frontend locally:
  1. Install Flutter SDK (https://flutter.dev/docs/get-started/install)
  2. From this directory: flutter pub get
  3. Run: flutter run
  4. Run tests: flutter test

Configuration:
- API base URL: set via `--dart-define=API_BASE_URL`.
- The API endpoint identifies where the ERP backend is deployed. It is not tenant configuration.
- Tenant context is established after authentication from the backend-issued tenant-scoped session.
- The frontend does not send a client-authoritative tenant header.
