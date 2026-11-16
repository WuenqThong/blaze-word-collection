param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$python = Join-Path $backendRoot '.venv/Scripts/python.exe'
$dist = Join-Path $frontendRoot 'dist'
$logDirectory = Join-Path $env:TEMP 'blaze-local-dev'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
if (-not (Test-Path -LiteralPath $python)) { throw 'Missing backend/.venv. Install backend dependencies first.' }
if (-not $SkipBuild) {
    $buildNames = @('VITE_API_BASE_URL', 'VITE_DEMO_SERVER', 'VITE_ENABLE_LEGACY')
    $buildPrevious = @{}
    foreach ($name in $buildNames) { $buildPrevious[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        $env:VITE_API_BASE_URL = '/api'
        $env:VITE_DEMO_SERVER = 'on'
        $env:VITE_ENABLE_LEGACY = 'off'
        Push-Location $frontendRoot
        try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed. Existing service left running.' } }
        finally { Pop-Location }
    } finally {
        foreach ($name in $buildNames) { [Environment]::SetEnvironmentVariable($name, $buildPrevious[$name], 'Process') }
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'Missing frontend build. Run without -SkipBuild.' }
foreach ($port in @(7777, 8765)) {
    foreach ($listener in (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ParentProcessId)"
        $ownedNode = $process.CommandLine -like "*$frontendRoot*node_modules*vite*"
        $ownedPython = ($process.CommandLine -match 'uvicorn app.main:app|scripts.serve') -and (($process.CommandLine -like "*$python*") -or ($parent.CommandLine -like "*$python*"))
        if (-not ($ownedNode -or $ownedPython)) { throw "Port $port belongs to another application; left unchanged." }
        Stop-Process -Id $process.ProcessId -Force
    }
}
$previousDist = [Environment]::GetEnvironmentVariable('FRONTEND_DIST', 'Process')
try {
    $env:FRONTEND_DIST = $dist
    Start-Process -FilePath $python -ArgumentList @('-m', 'scripts.serve', '--host', '127.0.0.1', '--port', '7777') -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'app.out.log') -RedirectStandardError (Join-Path $logDirectory 'app.err.log') | Out-Null
} finally { [Environment]::SetEnvironmentVariable('FRONTEND_DIST', $previousDist, 'Process') }
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-WebRequest 'http://127.0.0.1:7777/api/health' -UseBasicParsing -TimeoutSec 2
        $page = Invoke-WebRequest 'http://127.0.0.1:7777/login' -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200 -and $page.Content -match '<!doctype html>') { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Startup failed. Logs: $logDirectory" }
Write-Output 'Frontend + API ready on ONE port: http://localhost:7777/demo'
