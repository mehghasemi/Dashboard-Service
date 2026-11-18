import {spawn} from 'node:child_process';
import {dashboardFailure} from './dashboard-diagnostics.mjs';

export function runDashboardProcess(script,job,options={}){
 const command="[Console]::InputEncoding=New-Object Text.UTF8Encoding($false);$x=([Console]::In.ReadToEnd()|ConvertFrom-Json);& ([scriptblock]::Create([string]$x.script)) $x.job";
 return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const chunks=[],started=Date.now(),signal=options.signal;let bytes=0,done=false,pending='',progress={};
  const abort=()=>{child.kill();finish(Object.assign(Error('دریافت لغو شد؛ داده قبلی حفظ شد.'),{status:499}))};
  const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);chunks.length=0;error?reject(error):resolve(data)};
  const failure=(code,extra={},status=502)=>dashboardFailure(code,{...progress,bytes,elapsedMs:Date.now()-started,...extra},status);
  const timer=setTimeout(()=>{finish(failure('worker_timeout'));child.kill()},600000);
  child.stdout.on('data',chunk=>{
   if(done)return;bytes+=chunk.length;
   if(bytes>32000000){finish(failure('output_limit',{limitBytes:32000000}));child.kill()}else chunks.push(chunk);
  });
  child.stderr.on('data',chunk=>{
   if(done)return;
   pending+=chunk.toString('utf8');if(pending.length>8192){pending='';return}
   const lines=pending.split(/\r?\n/);pending=lines.pop();
   for(const line of lines){
    try{
     const p=JSON.parse(line);
     if(p.kind!=='dashboard_progress'||!Number.isSafeInteger(p.stage)||!Number.isSafeInteger(p.total)||p.stage<0||p.total<=0||p.total>1024||p.stage>p.total+1||typeof p.entity!=='string'||!/^[a-z0-9-]{1,40}$/.test(p.entity))continue;
     const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
     progress={stage:p.stage,total:p.total,entity:p.entity,page:count(p.page),rows:count(p.rows)};
     options.onProgress?.({...progress,elapsedSeconds:count(p.elapsedSeconds)});
    }catch{}
   }
  });
  child.stdin.on('error',()=>{});
  child.on('error',()=>finish(failure('worker_start')));
  child.on('close',code=>{
   if(done)return;
   if(code!==0)return finish(failure('worker_exit',{exitCode:code}));
   let data;
   try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return finish(failure('invalid_json'))}
   if(data?.failure){
    const status=data.httpStatus===401?428:data.httpStatus===403?403:502;
    return finish(failure(data.httpStatus>=400?'crm_http':data.reason,{entity:data.entity,httpStatus:data.httpStatus,line:data.line,exceptionType:data.exceptionType},status));
   }
   finish(null,data);
  });
  if(signal?.aborted){abort();return}
  signal?.addEventListener('abort',abort,{once:true});
  child.stdin.end(JSON.stringify({script,job}),'utf8');
 });
}
