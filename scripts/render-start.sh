#!/bin/sh
set -eu

# Runtime must never receive the privileged platform-security credential.
if [ "${NODE_ENV:-production}" = "production" ] && [ -n "${PLATFORM_SECURITY_DATABASE_URL:-}" ]; then
  echo "PLATFORM_SECURITY_DATABASE_URL must not be configured on the Render web service." >&2
  echo "Run the one-time platform security bootstrap outside the application runtime." >&2
  exit 1
fi

# Ensure the default platform administrator exists after the database schema/security bootstrap.
# This operation is idempotent and never overwrites an existing administrator password.
node dist/infrastructure/database/platform-admin-seed.js

exec node dist/main.js
