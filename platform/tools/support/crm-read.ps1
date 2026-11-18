param($job)
# Combine's explicit per-account Windows transport. GET only; never the host identity.
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$root='https://crm.baridsoft.ir/Main/api/data/v9.1/'
$watch=[Diagnostics.Stopwatch]::StartNew()
$script:httpStatus=0
function Read-Page([string]$url){
 if($watch.Elapsed.TotalSeconds -gt 540){throw 'CRM time limit'}
 $uri=[Uri]$url
 if($uri.Scheme -cne 'https' -or $uri.Host -cne 'crm.baridsoft.ir' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.Fragment -or !$uri.AbsolutePath.StartsWith('/Main/api/data/v9.1/') -or $uri.AbsolutePath.Contains('..') -or $uri.AbsolutePath.Contains('$batch')){throw 'Invalid CRM target'}
 $req=[Net.HttpWebRequest]::Create($uri);$req.Method='GET';$req.AllowAutoRedirect=$false;$req.Timeout=35000;$req.ReadWriteTimeout=35000
 $req.Accept='application/json';$preference=if($uri.Query -match '(?i)fetchxml='){'odata.include-annotations="*"'}else{'odata.maxpagesize=500,odata.include-annotations="*"'};$req.Headers.Add('Prefer',$preference)
 $username=[string]$job.connection.username;$domain='';if($username.Contains([string][char]92)){$parts=$username.Split([char]92,2);$domain=$parts[0];$username=$parts[1]}
 $req.UseDefaultCredentials=$false;$req.Credentials=New-Object Net.NetworkCredential($username,[string]$job.connection.password,$domain)
 try{$response=$req.GetResponse()}catch [Net.WebException]{if($_.Exception.Response){$script:httpStatus=[int]$_.Exception.Response.StatusCode};throw}
 try{$reader=New-Object IO.StreamReader($response.GetResponseStream(),[Text.Encoding]::UTF8);$raw=$reader.ReadToEnd();if($raw.Length -gt 16000000){throw 'CRM page too large'};return ($raw|ConvertFrom-Json)}finally{if($reader){$reader.Dispose()};$response.Dispose()}
}
function Read-List([string]$path){
 $all=New-Object Collections.Generic.List[object];$url=$root+$path;$seen=New-Object 'Collections.Generic.HashSet[string]';$initial=([Uri]$url).AbsolutePath
 for($page=1;$page -le 200;$page++){
  if(!$seen.Add($url)){throw 'Repeated page'}
  if(([Uri]$url).AbsolutePath -cne $initial){throw 'Paging resource changed'}
  $data=Read-Page $url;if($null -eq $data.value){throw 'Invalid list'};foreach($row in @($data.value)){$all.Add($row);if($all.Count -gt 100000){throw 'CRM row limit'}}
  $url=$data.'@odata.nextLink';if(!$url){return ,$all.ToArray()}
 }
 throw 'CRM paging limit'
}
function Read-Xml([string]$source){
 if($source.Length -gt 1000000){throw 'XML too large'}
 $settings=New-Object Xml.XmlReaderSettings;$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create((New-Object IO.StringReader($source)),$settings)
 try{$doc=New-Object Xml.XmlDocument;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}finally{$reader.Dispose()}
}
function Add-Attribute($doc,$entity,[string]$name){
 if(!$entity.SelectSingleNode("attribute[@name='$name']") -and !$entity.SelectSingleNode('all-attributes')){$a=$doc.CreateElement('attribute');$a.SetAttribute('name',$name);$null=$entity.AppendChild($a)}
}
function Read-View($view,$ids){
 $sets=@{incident='incidents';annotation='annotations';activitypointer='activitypointers';task='tasks';brd_project='brd_projects'}
 if($view.kind -notin @('savedqueries','userqueries') -or !$sets.ContainsKey([string]$view.entity)){throw 'Invalid View'}
 $id=([Guid]$view.id).ToString();$kind=[string]$view.kind
 $definition=Read-Page ($root+$kind+'('+$id+')?$select=name,fetchxml,returnedtypecode')
 $doc=Read-Xml ([string]$definition.fetchxml);$entity=$doc.SelectSingleNode('/fetch/entity');$fetch=$doc.DocumentElement
 if(!$entity -or $entity.GetAttribute('name') -cne [string]$view.entity -or $fetch.GetAttribute('aggregate') -eq 'true'){throw 'Invalid View entity'}
 $names=@(Read-List ("EntityDefinitions(LogicalName='"+$view.entity+"')/Attributes?`$select=LogicalName")|ForEach-Object {$_.LogicalName})
 $needed=@{incident=@('incidentid','ticketnumber','title','createdon','modifiedon','statuscode','statecode','customerid','brd_account','brd_plannedcase','ownerid','brd_startplanningdate','brd_incidenttype','casetypecode','brd_caseservice','brd_sprinttime','brd_releasetime');brd_project=@('brd_projectid','brd_name','statuscode','statecode','brd_account','brd_customer','brd_projectmanager','brd_plannedenddate','brd_realenddate','brd_lastnotedate','brd_lastaction','brd_currentphase','brd_progress','modifiedon');annotation=@('annotationid','objectid','subject','notetext','modifiedon','createdon');task=@('activityid','regardingobjectid','subject','description','scheduledend','statecode','modifiedon');activitypointer=@('activityid','regardingobjectid','subject','description','scheduledend','statecode','modifiedon')}
 foreach($name in $needed[[string]$view.entity]){if($name -in $names){Add-Attribute $doc $entity $name}}
 $lastNoteField=$null
 if($view.entity -eq 'incident'){
  $dateFields=Read-List "EntityDefinitions(LogicalName='incident')/Attributes/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata?`$select=LogicalName,DisplayName"
  $matchesByLabel=@($dateFields | Where-Object {
   @($_.DisplayName.LocalizedLabels | Where-Object { $_.Label -match '^(Last Note( Date)?|تاریخ آخرین یادداشت|آخرین یادداشت)$' }).Count -gt 0
  })
  if($matchesByLabel.Count -eq 1){$lastNoteField=$matchesByLabel[0].LogicalName}
  elseif($matchesByLabel.Count -eq 0){
   $matchesByName=@($dateFields | Where-Object { $_.LogicalName -match '(^|_)last_?note(_?date|_?on)?$' })
   if($matchesByName.Count -eq 1){$lastNoteField=$matchesByName[0].LogicalName}
  }
  if($lastNoteField){Add-Attribute $doc $entity $lastNoteField}
  $accountFields=@(Read-List "EntityDefinitions(LogicalName='account')/Attributes?`$select=LogicalName"|ForEach-Object {$_.LogicalName})
  foreach($lookup in @('brd_account','customerid')){
   $alias='sma_upgrade_'+$lookup
   if($lookup -in $names -and !$entity.SelectSingleNode("link-entity[@alias='$alias']")){
    $link=$doc.CreateElement('link-entity');$link.SetAttribute('name','account');$link.SetAttribute('from','accountid');$link.SetAttribute('to',$lookup);$link.SetAttribute('alias',$alias);$link.SetAttribute('link-type','outer');$null=$entity.AppendChild($link)
    foreach($field in @('brd_automationversion','brd_city','address1_city')){if($field -in $accountFields){Add-Attribute $doc $link $field}}
   }
  }
  foreach($link in $entity.SelectNodes("link-entity[@name='incident'][@to='brd_plannedcase']")){foreach($field in @('title','statuscode','brd_incidenttype','brd_plannedstartdate','brd_plannedenddate')){if($field -in $names){Add-Attribute $doc $link $field}}}
 }
 if($null -ne $ids){
  if(@($ids).Count -eq 0){return @{rows=@();xml=$doc.OuterXml;name=$definition.name}}
  $target=@{annotation='objectid';task='regardingobjectid';activitypointer='regardingobjectid';incident='incidentid';brd_project='brd_projectid'}[[string]$view.entity]
  $filter=$doc.CreateElement('filter');$filter.SetAttribute('type','and');$condition=$doc.CreateElement('condition');$condition.SetAttribute('attribute',$target);$condition.SetAttribute('operator','in');$null=$filter.AppendChild($condition);$null=$entity.AppendChild($filter)
  foreach($targetId in $ids){$value=$doc.CreateElement('value');$value.InnerText=([Guid]$targetId).ToString();$null=$condition.AppendChild($value)}
 }
 $top=$fetch.GetAttribute('top');$fetch.RemoveAttribute('paging-cookie');if($top){$fetch.RemoveAttribute('page');$fetch.RemoveAttribute('count')}else{$fetch.SetAttribute('count','500');$fetch.SetAttribute('page','1')}
 $all=New-Object Collections.Generic.List[object];$seen=New-Object 'Collections.Generic.HashSet[string]';$pageSignatures=New-Object 'Collections.Generic.HashSet[string]';$next=$null
 for($page=1;$page -le 200;$page++){
  $url=if($next){$next}else{$root+$sets[[string]$view.entity]+'?fetchXml='+[Uri]::EscapeDataString($doc.OuterXml)}
  if(([Uri]$url).AbsolutePath -cne ('/Main/api/data/v9.1/'+$sets[[string]$view.entity])){throw 'View paging resource changed'}
  if(!$seen.Add($url)){throw 'Repeated View page'}
  $data=Read-Page $url;if($null -eq $data.value){throw 'Invalid View rows'};$rows=@($data.value)
  $keyField=@{incident='incidentid';annotation='annotationid';activitypointer='activityid';task='activityid';brd_project='brd_projectid'}[[string]$view.entity];$signature=(@($rows|ForEach-Object{[string]$_.$keyField}) -join ',');if($rows.Count -gt 0 -and !$pageSignatures.Add($signature)){throw 'Repeated CRM records page; previous snapshot retained'}
  foreach($row in $rows){$all.Add($row);if($all.Count -gt 100000){throw 'CRM row limit'}}
  [Console]::Error.WriteLine((@{kind='dashboard_progress';stage=1;total=1;entity=$sets[[string]$view.entity];page=$page;rows=$all.Count}|ConvertTo-Json -Compress))
  $next=$data.'@odata.nextLink';if($next){continue}
  $more=$data.'@Microsoft.Dynamics.CRM.morerecords';$cookie=$data.'@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'
  if((!$cookie -and $more -ne $true -and $more -cne 'true' -and $rows.Count -lt 500) -or ($top -and $all.Count -ge [int]$top)){return @{rows=$all.ToArray();xml=$doc.OuterXml;name=$definition.name;lastNoteField=$lastNoteField;viewTop=$top;pagesRead=$page}}
  if($top){throw 'Unexpected top pagination'};$fetch.SetAttribute('page',[string]($page+1))
  if($cookie){$wrapper=Read-Xml $cookie;$raw=$wrapper.DocumentElement.GetAttribute('pagingcookie');if($raw){$raw=[Uri]::UnescapeDataString([Uri]::UnescapeDataString($raw))}else{$raw=$cookie};$fetch.SetAttribute('paging-cookie',$raw)}
 }
 throw 'Incomplete View; previous snapshot retained'
}
try{
 $identity=Read-Page ($root+'WhoAmI');if(([string]$identity.UserId).ToLowerInvariant() -cne ([string]$job.connection.userId).ToLowerInvariant()){throw 'CRM identity mismatch'}
 if($job.operation -eq 'catalog'){
  $views=@();foreach($kind in @('savedqueries','userqueries')){$key=if($kind -eq 'savedqueries'){'savedqueryid'}else{'userqueryid'};foreach($r in (Read-List ($kind+'?$select=name,'+$key+',returnedtypecode'))){$entity=[string]$r.returnedtypecode;$codes=@{'112'='incident';'5'='annotation';'4200'='activitypointer';'4212'='task'};if($codes.ContainsKey($entity)){$entity=$codes[$entity]};if($entity -in @('incident','annotation','activitypointer','task','brd_project')){$views+=@{id=[string]$r.$key;kind=$kind;entity=$entity;name=[string]$r.name}}}};$result=@{views=$views}
 }elseif($job.operation -eq 'snapshot'){
  $main=Read-View $job.views.main $job.targetIds;$ids=@($main.rows|ForEach-Object{if($job.views.main.entity -eq 'brd_project'){$_.brd_projectid}else{$_.incidentid}}|Select-Object -Unique)
  if($job.views.main.entity -eq 'incident'){$ids+=@($main.rows|ForEach-Object{$_._brd_plannedcase_value}|Where-Object{$_}|Select-Object -Unique)}
  $ids=@($ids | Where-Object { $_ } | ForEach-Object { ([Guid]$_).ToString() } | Select-Object -Unique)
  $notes=@()
  $activities=@()
  for($offset=0;$offset -lt $ids.Count;$offset+=50){
   $last=[Math]::Min($offset+49,$ids.Count-1)
   $targets=@($ids[$offset..$last])
   if($job.views.notes){
    $part=Read-View $job.views.notes $targets
    $notes+=@($part.rows)
   }else{
    $predicate=($targets | ForEach-Object { "_objectid_value eq $_" }) -join ' or '
    $query='annotations?$select=annotationid,_objectid_value,subject,notetext,createdon,modifiedon&$orderby=annotationid&$filter='
    $batch=Read-List ($query+[Uri]::EscapeDataString($predicate))
    $notes+=@($batch)
   }
   if($job.views.activities){
    $part=Read-View $job.views.activities $targets
    $activities+=@($part.rows)
   }
  }
  $result=@{main=$main;notes=$notes;activities=$activities;coverage=@{notes=$true;activities=[bool]$job.views.activities}}
 }else{throw 'Invalid operation'}
 $bytes=[Text.Encoding]::UTF8.GetBytes(($result|ConvertTo-Json -Depth 35 -Compress));if($bytes.Length -gt 60000000){throw 'Snapshot size limit'}
 $memory=New-Object IO.MemoryStream;$gzip=New-Object IO.Compression.GZipStream($memory,[IO.Compression.CompressionMode]::Compress,$true);try{$gzip.Write($bytes,0,$bytes.Length)}finally{$gzip.Dispose()}
 [Console]::Out.Write((@{gzip=[Convert]::ToBase64String($memory.ToArray())}|ConvertTo-Json -Compress));$memory.Dispose()
}catch{[Console]::Out.Write((@{failure=$true;reason='read_error';httpStatus=$script:httpStatus;line=$_.InvocationInfo.ScriptLineNumber;exceptionType=$_.Exception.GetType().Name}|ConvertTo-Json -Compress))}
