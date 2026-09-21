#!/bin/sh
set -eu

if [ "${PLATFORM_SECURITY_BOOTSTRAP_ON_START:-false}" = "true" ]; then
  if [ -z "${PLATFORM_SECURITY_DATABASE_URL:-}" ]; then
    echo "PLATFORM_SECURITY_DATABASE_URL is required when PLATFORM_SECURITY_BOOTSTRAP_ON_START=true" >&2
    exit 1
  fi

  echo "Running idempotent platform security bootstrap..."
  node dist/infrastructure/database/platform-security-bootstrap.js

  # Do not expose the privileged bootstrap credential to the application process.
  unset PLATFORM_SECURITY_DATABASE_URL
  unset PLATFORM_SECURITY_BOOTSTRAP_ON_START
fi

exec node dist/main.js
