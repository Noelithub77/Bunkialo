#!/usr/bin/env bash
set -euo pipefail

if [ -z "${ANDROID_ARTIFACT_PATH:-}" ]; then
  echo "ANDROID_ARTIFACT_PATH is required"
  exit 1
fi

pnpm exec eas submit \
  --platform android \
  --profile production \
  --path "${ANDROID_ARTIFACT_PATH}" \
  --non-interactive
