param([string]$Destination,[switch]$NoShortcut)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'Verify.ps1') -Root $PSScriptRoot
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PACKAGE-MANIFEST.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(!$Destination){$Destination=Join-Path $env:LOCALAPPDATA ('Programs\DashboardService-'+$manifest.version)}
$target=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $target){throw 'Destination exists and was preserved. Choose a NEW empty installation directory.'}
if($target.StartsWith([IO.Path]::GetFullPath($PSScriptRoot)+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Do not install inside the source package'}
$null=New-Item -ItemType Directory -Path $target
foreach($entry in $manifest.files){$dest=[IO.Path]::GetFullPath((Join-Path $target $entry.path));if(!$dest.StartsWith($target.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid destination'};$null=New-Item -ItemType Directory -Force -Path (Split-Path $dest);Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.path) -Destination $dest}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'PACKAGE-MANIFEST.json') -Destination (Join-Path $target 'PACKAGE-MANIFEST.json')
& (Join-Path $target 'Verify.ps1') -Root $target
if(!$NoShortcut){$shell=New-Object -ComObject WScript.Shell;$shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Dashboard Service.lnk'));$shortcut.TargetPath=Join-Path $target 'Start.cmd';$shortcut.WorkingDirectory=$target;$shortcut.Description='داشبورد خدمات';$shortcut.Save()}
Write-Output ('Installed: '+$target)
Write-Output 'Run Start.cmd. Enter your OWN CRM username and password in the browser settings.'
