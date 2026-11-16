param([ValidateRange(0, 2147483647)][int]$Seed = 42)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Backend Python environment not found.' }
& $python (Join-Path $projectRoot 'ml/simulator/run.py') --seed $Seed
if ($LASTEXITCODE -ne 0) { throw "Simulator failed (exit $LASTEXITCODE). See report path above." }
