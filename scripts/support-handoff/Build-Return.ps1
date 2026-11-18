param([Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][string]$Version)
$ErrorActionPreference='Stop'
if($Version -notmatch '^\d+\.\d+\.\d+$'){throw 'An explicit user-approved version is required.'}
$target=[IO.Path]::GetFullPath($OutputDirectory);if(Test-Path -LiteralPath $target){throw 'Output exists and was preserved.'}
$project=Join-Path $PSScriptRoot 'project';$versions=Get-Content -LiteralPath (Join-Path $project 'platform\component-versions.json') -Raw|ConvertFrom-Json
if($versions.components.support -ne $Version){throw 'Set only the support version to the owner-approved value first. Never increment automatically.'}
& (Join-Path $PSScriptRoot 'runtime\node.exe') (Join-Path $project 'scripts\build-support-handoff.mjs') --project $project --output $target --version $Version
if($LASTEXITCODE -ne 0){throw 'Build failed; no completed return package claimed.'}
$zip=$target+'.zip';if(Test-Path -LiteralPath $zip){throw 'Archive exists and was preserved.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($target,$zip,[IO.Compression.CompressionLevel]::Optimal,$false)
Get-FileHash -LiteralPath $zip -Algorithm SHA256
