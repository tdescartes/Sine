#!/usr/bin/env pwsh
# start.ps1 — Launch the Sine backend from the project root.
#
# Usage (from any directory):
#   .\start.ps1              # production-style (no reload)
#   .\start.ps1 --dev        # with hot-reload

param(
    [switch]$dev
)

$backendDir = Join-Path $PSScriptRoot "backend"

if (-not (Test-Path $backendDir)) {
    Write-Error "backend/ directory not found at $backendDir"
    exit 1
}

Push-Location $backendDir

try {
    if ($dev) {
        uvicorn app.main:app --app-dir $backendDir --reload --host 0.0.0.0 --port 8000
    } else {
        uvicorn app.main:app --app-dir $backendDir --host 0.0.0.0 --port 8000
    }
} finally {
    Pop-Location
}
