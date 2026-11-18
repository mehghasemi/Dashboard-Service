param([int]$Port=3049,[string]$DataDirectory=(Join-Path $env:LOCALAPPDATA 'CombineSupport\user-data'),[switch]$NoBrowser)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'Verify.ps1') -Root $PSScriptRoot -RuntimeOnly
$node=Join-Path $PSScriptRoot 'runtime\node.exe';$entry=Join-Path $PSScriptRoot 'project\platform\support-standalone.mjs'
$data=[IO.Path]::GetFullPath($DataDirectory);$null=New-Item -ItemType Directory -Force -Path $data
$launchFile=Join-Path $data 'launch.json';$launch=$null
if(Test-Path -LiteralPath $launchFile){$previous=Get-Content -LiteralPath $launchFile -Raw|ConvertFrom-Json;try{$health=Invoke-RestMethod ('http://127.0.0.1:'+$previous.port+'/api/health') -TimeoutSec 2;if($health.app -eq 'combine-support-standalone'){$live=Get-CimInstance Win32_Process -Filter ('ProcessId='+$previous.pid);if($live -and $live.CommandLine.Contains($entry)){$launch=$previous}else{throw 'Another installation is using this data directory. Stop it first.'}}}catch{if($_.Exception.Message -like '*Another installation*'){throw}}}
if(!$launch){if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'Port is occupied. Use -Port with another port; never stop an unknown process.'}
 $args=@(('"'+$entry+'"'),'--data-directory',('"'+$data+'"'),'--port',[string]$Port)
 $process=Start-Process -FilePath $node -ArgumentList $args -WorkingDirectory (Split-Path $entry) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'host.stdout.log') -RedirectStandardError (Join-Path $data 'host.stderr.log')
 for($i=0;$i -lt 100;$i++){if($process.HasExited){throw 'Host failed. See host.stderr.log in your private data directory.'};if(Test-Path -LiteralPath $launchFile){try{$candidate=Get-Content -LiteralPath $launchFile -Raw|ConvertFrom-Json;if($candidate.pid -eq $process.Id){$launch=$candidate;break}}catch{}};Start-Sleep -Milliseconds 100}
 if(!$launch){throw 'Host did not become ready. See private host logs.'}
}
if(!$NoBrowser){Start-Process $launch.url}
Write-Output ('Ready on http://127.0.0.1:'+$launch.port+'/support/ . No CRM credential is stored in the installation folder.')
