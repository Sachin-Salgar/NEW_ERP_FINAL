#!/usr/bin/env bash
set -euo pipefail

# Keep Vercel's Flutter toolchain aligned with the Flutter version that
# generated this project. frontend/.metadata currently pins Flutter 3.47.1.
FLUTTER_VERSION="3.47.1"
FLUTTER_HOME="${HOME}/flutter-${FLUTTER_VERSION}"
FLUTTER_ARCHIVE="/tmp/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
FLUTTER_URL="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"

if [[ ! -x "${FLUTTER_HOME}/bin/flutter" ]]; then
  echo "Installing Flutter ${FLUTTER_VERSION}..."
  rm -rf "${FLUTTER_HOME}"
  curl -fsSL "${FLUTTER_URL}" -o "${FLUTTER_ARCHIVE}"
  mkdir -p "${HOME}"
  tar -xJf "${FLUTTER_ARCHIVE}" -C "${HOME}"
  mv "${HOME}/flutter" "${FLUTTER_HOME}"
fi

export PATH="${FLUTTER_HOME}/bin:${PATH}"

flutter --version
flutter config --enable-web

cd frontend
flutter pub get

API_BASE_URL_VALUE="${API_BASE_URL:-}"
if [[ -z "${API_BASE_URL_VALUE}" ]]; then
  echo "ERROR: API_BASE_URL must be configured as a Vercel Environment Variable."
  exit 1
fi

flutter build web --release \
  --dart-define="API_BASE_URL=${API_BASE_URL_VALUE}" \
  --base-href="/"

cd ..
echo "Flutter Web build completed: frontend/build/web"
