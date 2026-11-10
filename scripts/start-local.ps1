$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $env:TEMP 'blaze-local-dev'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Test-LocalService([string]$Address) {
    try { return (Invoke-WebRequest -Uri $Address -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { return $false }
}

if (-not (Test-LocalService 'http://127.0.0.1:8765/api/health')) {
    $python = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $python)) { throw 'Chưa có backend/.venv. Cài dependencies backend theo README trước.' }
    Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'backend.out.log') -RedirectStandardError (Join-Path $logDirectory 'backend.err.log') | Out-Null
}

if (-not (Test-LocalService 'http://localhost:7777/')) {
    $node = (Get-Command node -ErrorAction Stop).Source
    $vite = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    if (-not (Test-Path -LiteralPath $vite)) { throw 'Chưa có dependencies frontend. Chạy npm install trong frontend trước.' }
    Start-Process -FilePath $node -ArgumentList @(('"' + $vite + '"')) -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'frontend.out.log') -RedirectStandardError (Join-Path $logDirectory 'frontend.err.log') | Out-Null
}

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ((Test-LocalService 'http://127.0.0.1:8765/api/health') -and (Test-LocalService 'http://localhost:7777/api/health')) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Chưa khởi động được đầy đủ. Xem log tại $logDirectory" }
Write-Output 'Frontend + backend đã sẵn sàng: http://localhost:7777/demo'
