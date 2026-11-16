param(
    [ValidateRange(1024, 65535)][int]$FrontendPort = 7778,
    [ValidateRange(1024, 65535)][int]$BackendPort = 8766,
    [string]$DataDirectory
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qaRoot = if ($DataDirectory) { [IO.Path]::GetFullPath($DataDirectory) } else { Join-Path $env:LOCALAPPDATA 'blaze-voice-qa' }
if ($FrontendPort -eq $BackendPort) { throw 'QA frontend and backend must use different ports.' }
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
$python = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
$node = (Get-Command node -ErrorAction Stop).Source
$vite = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $vite)) {
    throw 'Install backend and frontend dependencies before starting QA.'
}

# Refuse occupied ports before touching the QA data; never reuse the live stack.
foreach ($port in @($BackendPort, $FrontendPort)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "QA port $port is occupied. Existing services have been left unchanged."
    }
}
$names = @('BLAZE_QA_ROOT', 'DATABASE_URL', 'JWT_SECRET', 'COOKIE_NAME', 'CORS_ORIGINS',
           'MINIO_BUCKET', 'BLAZE_API_TARGET', 'VITE_API_BASE_URL', 'VITE_DEMO_SERVER', 'ENABLE_LEGACY', 'VITE_ENABLE_LEGACY')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$started = @()
try {
    $env:BLAZE_QA_ROOT = $qaRoot
    $env:DATABASE_URL = 'sqlite:///' + (Join-Path $qaRoot 'qa.db').Replace('\', '/')
    $env:JWT_SECRET = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:COOKIE_NAME = "blaze_qa_access_token_$FrontendPort"
    $env:CORS_ORIGINS = "[`"http://localhost:$FrontendPort`",`"http://127.0.0.1:$FrontendPort`"]"
    $env:MINIO_BUCKET = 'blaze-dialect-qa'
    $env:BLAZE_API_TARGET = "http://127.0.0.1:$BackendPort"
    $env:VITE_API_BASE_URL = '/api'
    $env:VITE_DEMO_SERVER = 'on'
    $env:ENABLE_LEGACY = 'false'
    $env:VITE_ENABLE_LEGACY = 'off'
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & $python -m scripts.seed_qa
        if ($LASTEXITCODE -ne 0) { throw 'QA seed failed; no servers were started.' }
    } finally { Pop-Location }
    $started += Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $BackendPort) -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $qaRoot 'backend.out.log') -RedirectStandardError (Join-Path $qaRoot 'backend.err.log')
    $started += Start-Process -FilePath $node -ArgumentList @(('"' + $vite + '"'), '--host', '127.0.0.1', '--port', $FrontendPort) -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $qaRoot 'frontend.out.log') -RedirectStandardError (Join-Path $qaRoot 'frontend.err.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:$FrontendPort/api/health" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "QA startup failed. See logs in $qaRoot" }
    $started.Id | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot 'processes.json')
    Write-Output "QA frontend: http://127.0.0.1:$FrontendPort/demo ; backend: http://127.0.0.1:$BackendPort/docs"
    Write-Output "Credentials and logs: $qaRoot (outside Git). Use a separate browser profile for QA."
} catch {
    foreach ($process in $started) { if (-not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue } }
    throw
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
