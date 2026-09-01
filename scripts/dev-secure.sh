#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-4173}"
# Local-only by default; set HOST=0.0.0.0 explicitly to expose on the LAN.
HOST="${HOST:-localhost}"

GOOGLE_MAPS_API_KEY_ENV="${GOOGLE_MAPS_API_KEY:-}"
GOOGLE_MAPS_API_KEY_KEYCHAIN=""
GOOGLE_MAPS_API_KEY_SOURCE=""
if command -v security >/dev/null 2>&1; then
  for acct in "api-key" "default" "key"; do
    GOOGLE_MAPS_API_KEY_KEYCHAIN="$(security find-generic-password -s "google-maps-api" -a "${acct}" -w 2>/dev/null || true)"
    if [[ -n "${GOOGLE_MAPS_API_KEY_KEYCHAIN}" ]]; then
      GOOGLE_MAPS_API_KEY_SOURCE="keychain:${acct}"
      break
    fi
  done
fi

if [[ -n "${GOOGLE_MAPS_API_KEY_KEYCHAIN}" ]]; then
  GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_KEYCHAIN}"
elif [[ -n "${GOOGLE_MAPS_API_KEY_ENV}" ]]; then
  GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_ENV}"
  GOOGLE_MAPS_API_KEY_SOURCE="env"
else
  GOOGLE_MAPS_API_KEY=""
fi
if [[ -z "${GOOGLE_MAPS_API_KEY}" ]]; then
  echo "error: Google Maps API key missing."
  echo "set GOOGLE_MAPS_API_KEY in env, or add Keychain item: service=google-maps-api account=api-key"
  exit 1
fi

read_keychain_secret() {
  local service="$1"
  local account="$2"
  security find-generic-password -s "$service" -a "$account" -w 2>/dev/null || true
}


CCTV_AUSTIN_MAX_SOURCES="${CCTV_AUSTIN_MAX_SOURCES:-36}"
CCTV_MAX_SOURCES="${CCTV_MAX_SOURCES:-48}"

echo "Starting God's Eye View dev server..."
echo "URL: http://localhost:${PORT}/"
echo "Google Maps key source: ${GOOGLE_MAPS_API_KEY_SOURCE}"
echo "Flights: adsb.lol (keyless, ODbL 1.0) - regional coverage"

GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY}" \
CCTV_AUSTIN_MAX_SOURCES="${CCTV_AUSTIN_MAX_SOURCES}" \
CCTV_MAX_SOURCES="${CCTV_MAX_SOURCES}" \
npm run dev -- --host "${HOST}" --port "${PORT}"
