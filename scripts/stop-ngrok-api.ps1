[CmdletBinding()]
param(
    [switch]$KeepContainer
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $root ".laro-ngrok.json"

Set-Location -LiteralPath $root

if (Test-Path -LiteralPath $runtimePath) {
    $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
    if ($runtime.ngrokPid) {
        $process = Get-Process -Id ([int]$runtime.ngrokPid) -ErrorAction SilentlyContinue
        if ($process) {
            if ($process.ProcessName -ne "ngrok") {
                throw "Recorded PID $($runtime.ngrokPid) no longer belongs to ngrok; refusing to stop it."
            }

            $processDetails = Get-CimInstance Win32_Process -Filter "ProcessId = $($runtime.ngrokPid)"
            if (-not $processDetails.CommandLine -or $processDetails.CommandLine -notmatch "laro-api") {
                throw "Recorded ngrok process is not the LARO tunnel; refusing to stop it."
            }
            Stop-Process -Id $process.Id -Force
        }
    }
    Remove-Item -LiteralPath $runtimePath -Force
}

if (-not $KeepContainer) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "docker is required but was not found on PATH."
    }
    & docker compose stop laro-server
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to stop LARO." }
}

Write-Host "LARO ngrok API deployment stopped."
