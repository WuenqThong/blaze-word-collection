# Dot-source from the project root: . .\ml\use-lab.ps1
$env:BLAZE_ML_ROOT = 'E:\blaze-voice-lab'
$env:HF_HOME = Join-Path $env:BLAZE_ML_ROOT 'cache\huggingface'
$env:TORCH_HOME = Join-Path $env:BLAZE_ML_ROOT 'cache\torch'
$env:HF_DATASETS_CACHE = Join-Path $env:BLAZE_ML_ROOT 'cache\huggingface\datasets'
Write-Output "ML data root: $env:BLAZE_ML_ROOT"
Write-Output 'Python: .\ml\.venv\Scripts\python.exe (backend environment is separate)'
