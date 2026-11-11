$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$qaRoot = Join-Path $env:LOCALAPPDATA 'blaze-voice-qa'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
$python = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
$node = (Get-Command node -ErrorAction Stop).Source
$vite = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $vite)) {
    throw 'Install backend and frontend dependencies before starting QA.'
}

# Refuse occupied ports before touching the QA data; never reuse the live stack.
foreach ($port in @(8766, 7778)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "QA port $port is occupied. Existing services have been left unchanged."
    }
}
$names = @('BLAZE_QA_ROOT', 'DATABASE_URL', 'JWT_SECRET', 'COOKIE_NAME', 'CORS_ORIGINS',
           'MINIO_BUCKET', 'BLAZE_API_TARGET', 'VITE_API_BASE_URL', 'VITE_DEMO_SERVER')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$started = @()
try {
    $env:BLAZE_QA_ROOT = $qaRoot
    $env:DATABASE_URL = 'sqlite:///' + (Join-Path $qaRoot 'qa.db').Replace('\', '/')
    $env:JWT_SECRET = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:COOKIE_NAME = 'blaze_qa_access_token'
    $env:CORS_ORIGINS = '["http://localhost:7778","http://127.0.0.1:7778"]'
    $env:MINIO_BUCKET = 'blaze-dialect-qa'
    $env:BLAZE_API_TARGET = 'http://127.0.0.1:8766'
    $env:VITE_API_BASE_URL = '/api'
    $env:VITE_DEMO_SERVER = 'on'
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & $python -m scripts.seed_qa
        if ($LASTEXITCODE -ne 0) { throw 'QA seed failed; no servers were started.' }
    } finally { Pop-Location }
    $started += Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8766') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $qaRoot 'backend.out.log') -RedirectStandardError (Join-Path $qaRoot 'backend.err.log')
    $started += Start-Process -FilePath $node -ArgumentList @(('"' + $vite + '"'), '--host', '127.0.0.1', '--port', '7778') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $qaRoot 'frontend.out.log') -RedirectStandardError (Join-Path $qaRoot 'frontend.err.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-WebRequest 'http://127.0.0.1:7778/api/health' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "QA startup failed. See logs in $qaRoot" }
    $started.Id | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot 'processes.json')
    Write-Output 'QA frontend: http://127.0.0.1:7778/demo ; backend: http://127.0.0.1:8766/docs'
    Write-Output "Credentials and logs: $qaRoot (outside Git). Use a separate browser profile for QA."
} catch {
    foreach ($process in $started) { if (-not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue } }
    throw
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
