#!/bin/sh
set -eu

# Development-stage Render deployment contract:
# provision the database completely before starting the web process.
# This is intentionally used only while the service is on the Free plan,
# where Render has no native pre-deploy command. The provisioning credentials
# are supplied to the Render service for this deployment stage. When moving
# to paid Render or self-hosted production, move this command to the dedicated
# deployment/pre-deploy stage and remove the privileged credentials from the
# runtime environment.

: "${DB_PROVISIONING_DATABASE_URL:?DB_PROVISIONING_DATABASE_URL is required for Render deployment provisioning}"
: "${DB_MIGRATION_DATABASE_URL:?DB_MIGRATION_DATABASE_URL is required for Render deployment provisioning}"
: "${DATABASE_URL:?DATABASE_URL is required for Render application runtime}"
: "${PLATFORM_ADMIN_USERNAME:?PLATFORM_ADMIN_USERNAME is required for initial platform administrator bootstrap}"
: "${PLATFORM_ADMIN_PASSWORD:?PLATFORM_ADMIN_PASSWORD is required for initial platform administrator bootstrap}"
: "${PLATFORM_ADMIN_EMAIL:?PLATFORM_ADMIN_EMAIL is required for initial platform administrator bootstrap}"

echo "==> Provisioning production database..."
node dist/infrastructure/database/provision.js

echo "==> Database provisioning completed successfully."
echo "==> Starting ERP server..."
exec node dist/main.js
