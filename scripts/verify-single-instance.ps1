param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,
  [ValidateRange(30, 300)]
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$artifact = (Resolve-Path -LiteralPath $ArtifactPath).Path
$profile = Join-Path $env:TEMP ("laro-single-instance-$([guid]::NewGuid().ToString('N'))")
New-Item -ItemType Directory -Path $profile | Out-Null
$arguments = @("--user-data-dir=$profile", '--disable-gpu')

function Get-ProfileProcesses {
  return @(Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($profile)
  })
}

try {
  Start-Process -FilePath $artifact -ArgumentList $arguments -WindowStyle Hidden | Out-Null
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $stableSamples = 0
  $lastSignature = ''

  do {
    Start-Sleep -Seconds 2
    $primaryProcesses = @(Get-ProfileProcesses)
    $signature = (@($primaryProcesses.ProcessId | Sort-Object) -join ',')
    $databaseReady = Test-Path -LiteralPath (Join-Path $profile 'laro-server.sqlite')
    if ($databaseReady -and $primaryProcesses.Count -ge 3 -and $signature -eq $lastSignature) {
      $stableSamples++
    } else {
      $stableSamples = 0
    }
    $lastSignature = $signature
  } while ($stableSamples -lt 2 -and (Get-Date) -lt $deadline)

  if ($stableSamples -lt 2) {
    throw "Primary packaged process did not initialize a stable profile within $TimeoutSeconds seconds. Processes: $lastSignature"
  }

  $beforeIds = @($primaryProcesses.ProcessId | Sort-Object)
  $second = Start-Process -FilePath $artifact -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (-not $second.WaitForExit($TimeoutSeconds * 1000)) {
    throw "Second packaged launcher did not exit within $TimeoutSeconds seconds."
  }

  Start-Sleep -Seconds 5
  $afterIds = @((Get-ProfileProcesses).ProcessId | Sort-Object)
  $differences = @(Compare-Object $beforeIds $afterIds)
  if ($differences.Count -ne 0) {
    throw "Second launch changed the primary process set. Before: $($beforeIds -join ','); after: $($afterIds -join ',')"
  }

  $secretsPath = Join-Path $profile 'laro-secrets.json'
  if (-not (Test-Path -LiteralPath $secretsPath -PathType Leaf)) {
    throw 'Packaged startup did not persist laro-secrets.json.'
  }
  $secretHashBeforeRestart = (Get-FileHash -LiteralPath $secretsPath -Algorithm SHA256).Hash

  foreach ($process in @(Get-ProfileProcesses)) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  $shutdownDeadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 1
    $remainingProcesses = @(Get-ProfileProcesses)
  } while ($remainingProcesses.Count -gt 0 -and (Get-Date) -lt $shutdownDeadline)
  if ($remainingProcesses.Count -gt 0) {
    throw 'Primary packaged processes did not stop before the restart probe.'
  }

  Start-Process -FilePath $artifact -ArgumentList $arguments -WindowStyle Hidden | Out-Null
  $restartDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $restartStableSamples = 0
  $lastRestartSignature = ''
  do {
    Start-Sleep -Seconds 2
    $restartProcesses = @(Get-ProfileProcesses)
    $restartSignature = (@($restartProcesses.ProcessId | Sort-Object) -join ',')
    $databaseReadyAfterRestart = Test-Path -LiteralPath (Join-Path $profile 'laro-server.sqlite')
    if ($databaseReadyAfterRestart -and $restartProcesses.Count -ge 3 -and $restartSignature -eq $lastRestartSignature) {
      $restartStableSamples++
    } else {
      $restartStableSamples = 0
    }
    $lastRestartSignature = $restartSignature
  } while ($restartStableSamples -lt 2 -and (Get-Date) -lt $restartDeadline)
  if ($restartStableSamples -lt 2) {
    throw "Packaged restart did not initialize the existing profile within $TimeoutSeconds seconds."
  }

  $secretHashAfterRestart = (Get-FileHash -LiteralPath $secretsPath -Algorithm SHA256).Hash
  if ($secretHashAfterRestart -ne $secretHashBeforeRestart) {
    throw 'Packaged restart replaced the existing desktop encryption secrets.'
  }

  [ordered]@{
    result = 'PASS'
    initializedDatabase = $true
    primaryProcessCount = $beforeIds.Count
    secondLauncherExited = $true
    primaryProcessSetPreserved = $true
    restartInitializedExistingProfile = $true
    desktopSecretFilePreserved = $true
  } | ConvertTo-Json
} finally {
  foreach ($process in @(Get-ProfileProcesses)) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
