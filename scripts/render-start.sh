#!/bin/sh
set -eu

# Runtime must never receive the privileged platform-security credential.
if [ "${NODE_ENV:-production}" = "production" ] && [ -n "${PLATFORM_SECURITY_DATABASE_URL:-}" ]; then
  echo "PLATFORM_SECURITY_DATABASE_URL must not be configured on the Render web service." >&2
  echo "Run the one-time platform security bootstrap outside the application runtime." >&2
  exit 1
fi

# Render's current service is on the free plan, where the native pre-deploy
# command is unavailable. Therefore database preparation is a deployment gate
# immediately before the server starts. If either step fails, the new instance
# never becomes healthy and Render keeps the last successful deployment live.
echo "==> Running database migrations..."
node dist/infrastructure/database/migrate.js

echo "==> Seeding/verifying platform administrator..."
node dist/infrastructure/database/platform-admin-seed.js

echo "==> Database preparation completed. Starting ERP server..."
exec node dist/main.js
