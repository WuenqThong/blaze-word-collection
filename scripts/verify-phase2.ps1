$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
& $python (Join-Path $projectRoot 'ml/simulator/verify_phase.py')
if ($LASTEXITCODE -ne 0) { throw 'Phase 2 acceptance failed; inspect acceptance.json and logs at the printed path.' }
