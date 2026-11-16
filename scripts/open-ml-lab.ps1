$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge)) { throw 'Microsoft Edge not found.' }
# A dedicated user-data-dir isolates cookies, localStorage and IndexedDB.
$profile = 'E:\blaze-voice-lab\browser-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Start-Process -FilePath $edge -ArgumentList @("--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check', 'http://127.0.0.1:7780/demo') -WindowStyle Normal
