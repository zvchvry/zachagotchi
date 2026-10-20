#!/bin/bash
# Compatibility wrapper; the cross-platform fetcher owns checksums and versions.
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec node "$ROOT/scripts/fetch-esptool.cjs" --platform=macos
