param([string]$DataDirectory=(Join-Path $env:LOCALAPPDATA 'CombineSupport\user-data'))
$ErrorActionPreference='Stop'
$file=Join-Path ([IO.Path]::GetFullPath($DataDirectory)) 'launch.json';if(!(Test-Path -LiteralPath $file)){Write-Output 'Not running.';exit}
$state=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json;$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.pid)
$entry=Join-Path $PSScriptRoot 'project\platform\support-standalone.mjs'
if($process){if(!$process.CommandLine.Contains($entry)){throw 'PID belongs to another process and was preserved.'};Stop-Process -Id $state.pid}
Write-Output 'Stopped. Private data and credentials were preserved.'
