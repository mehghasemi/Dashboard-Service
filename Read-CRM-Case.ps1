param(
  [switch]$Check,
  [switch]$Probe,
  [string[]]$CaseIds = @()
)
$ErrorActionPreference = 'Stop'
if (([int]$Check.IsPresent + [int]$Probe.IsPresent + [int]($CaseIds.Count -gt 0)) -ne 1) {
  throw 'Choose exactly one: -Check, -Probe, or -CaseIds.'
}
$node = Join-Path $PSScriptRoot 'artifacts\Dashboard-Service-Local-0.1.0\runtime\node.exe'
$tool = Join-Path $PSScriptRoot 'scripts\crm-case-review.mjs'
if (!(Test-Path -LiteralPath $node) -or !(Test-Path -LiteralPath $tool)) {
  throw 'Dashboard-Service CRM review files are missing.'
}
$argsForTool = @($tool)
if ($Check) { $argsForTool += '--check' }
elseif ($Probe) { $argsForTool += '--probe' }
else {
  foreach ($id in $CaseIds) {
    if ([string]::IsNullOrWhiteSpace($id) -or $id.Length -gt 120) { throw 'Invalid case identifier.' }
    $argsForTool += @('--case', $id)
  }
}
& $node @argsForTool
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }