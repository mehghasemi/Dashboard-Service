$ErrorActionPreference='Stop'
$source=Get-Content "$PSScriptRoot/crm-read.ps1" -Raw -Encoding UTF8
$start=$source.IndexOf('  $main=Read-View')
$end=$source.IndexOf(" }else{throw 'Invalid operation'", $start)
$run=[scriptblock]::Create($source.Substring($start,$end-$start)+'; return $result')
$id=[guid]::NewGuid().ToString()
$parent=[guid]::NewGuid().ToString()
function Read-View($view,$targets){
 if($view.entity -eq 'annotation'){return @{rows=@(@{objectid=$id})}}
 if($view.entity -eq 'brd_project'){return @{rows=@(@{brd_projectid=$id})}}
 return @{rows=@(@{incidentid=$id;_brd_plannedcase_value=$parent},@{incidentid=$id;_brd_plannedcase_value=$parent})}
}
function Read-List($path){
 if($failRead){throw 'controlled failure'}
 $decoded=[uri]::UnescapeDataString($path)
 if(!$decoded.StartsWith('annotations?') -or !$decoded.Contains("_objectid_value eq $id")){throw 'unscoped query'}
 if(($job.views.main.entity -eq 'incident') -ne $decoded.Contains("_objectid_value eq $parent")){throw 'wrong parent scope'}
 return ,@(@{annotationid=$id;objectid=$id})
}
foreach($entity in 'incident','brd_project'){
 $job=@{views=@{main=@{entity=$entity}};targetIds=@($id)}
 $r=& $run
 if(!$r.coverage.notes -or $r.notes.Count -ne 1){throw 'automatic note retrieval failed'}
}
$failRead=$true
try{$null=& $run;throw 'read failure swallowed'}catch{if($_.Exception.Message -ne 'controlled failure'){throw}}
$job.views.notes=@{entity='annotation'}; $r=& $run
if(!$r.coverage.notes -or $r.notes.Count -ne 1){throw 'selected note View ignored'}
Write-Output 'Scoped notes: case/backlog, project, explicit View and failure passed.'
