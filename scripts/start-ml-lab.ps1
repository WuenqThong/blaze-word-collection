param([switch]$OpenBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$labRoot = 'E:\blaze-voice-lab'
& (Join-Path $PSScriptRoot 'start-qa.ps1') -FrontendPort 7780 -BackendPort 8768 -DataDirectory (Join-Path $labRoot 'qa')
if ($OpenBrowser) { & (Join-Path $PSScriptRoot 'open-ml-lab.ps1') }
