param([string]$Root=$PSScriptRoot,[switch]$RuntimeOnly)
$ErrorActionPreference='Stop'
$base=[IO.Path]::GetFullPath($Root).TrimEnd('\')
$manifest=Get-Content -LiteralPath (Join-Path $base 'PACKAGE-MANIFEST.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($manifest.schema -ne 1 -or $manifest.tool -ne 'support'){throw 'Invalid package manifest'}
foreach($entry in $manifest.files){
 if($RuntimeOnly -and !$entry.path.StartsWith('runtime/')){continue}
 $file=[IO.Path]::GetFullPath((Join-Path $base $entry.path))
 if(!$file.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Manifest escaped package'}
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw ('Missing: '+$entry.path)}
 if((Get-Item -LiteralPath $file).Length -ne $entry.size -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $entry.sha256){throw ('Checksum changed: '+$entry.path)}
}
Write-Output 'Package hashes verified.'
