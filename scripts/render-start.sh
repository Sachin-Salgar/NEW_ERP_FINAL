#!/bin/sh
set -eu

# Runtime must never receive the privileged platform-security credential.
if [ "${NODE_ENV:-production}" = "production" ] && [ -n "${PLATFORM_SECURITY_DATABASE_URL:-}" ]; then
  echo "PLATFORM_SECURITY_DATABASE_URL must not be configured on the Render web service." >&2
  echo "Run the one-time platform security bootstrap outside the application runtime." >&2
  exit 1
fi

# Database migrations are deliberately NOT executed by the web process.
# Render's canonical deployment contract applies migrations before the
# application deploy (paid pre-deploy command or operator migration step).
# Running them here would execute DDL using the runtime application role and
# can fail under the ERP database-role security model.
echo "==> Starting ERP server..."
exec node dist/main.js
