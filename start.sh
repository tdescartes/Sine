#!/usr/bin/env bash
# start.sh — Launch the Sine backend from the project root.
#
# Usage:
#   ./start.sh        # production-style
#   ./start.sh --dev  # with hot-reload

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Error: backend/ directory not found at $BACKEND_DIR" >&2
  exit 1
fi

cd "$BACKEND_DIR"

if [[ "$1" == "--dev" ]]; then
  uvicorn app.main:app --app-dir "$BACKEND_DIR" --reload --host 0.0.0.0 --port 8000
else
  uvicorn app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000
fi
