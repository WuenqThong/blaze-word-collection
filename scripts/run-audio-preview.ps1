param(
    [string]$Source = 'E:\blaze-voice-lab\datasets\fpt-audio-phase2-20261111',
    [string]$Output = '',
    [string]$Approval = ''
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repoRoot 'ml\.venv\Scripts\python.exe'
$generator = Join-Path $repoRoot 'ml\dataset\augment_audio_pilot.py'
if (-not $Output) {
    $Output = Join-Path 'E:\blaze-voice-lab\datasets' ('fpt-audio-phase3-preview-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
}
$generatorArgs = @($generator, '--source', $Source, '--output', $Output)
if ($Approval) { $generatorArgs += @('--approval', $Approval) }
& $python @generatorArgs
if ($LASTEXITCODE -ne 0) { throw 'Audio preview failed; output is incomplete.' }
Write-Host ('Listen: ' + (Join-Path $Output 'listen-preview.html'))
