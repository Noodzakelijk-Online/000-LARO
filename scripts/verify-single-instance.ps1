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

  [ordered]@{
    result = 'PASS'
    initializedDatabase = $true
    primaryProcessCount = $beforeIds.Count
    secondLauncherExited = $true
    primaryProcessSetPreserved = $true
  } | ConvertTo-Json
} finally {
  foreach ($process in @(Get-ProfileProcesses)) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
