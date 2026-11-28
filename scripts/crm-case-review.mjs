import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(here,'../artifacts/Dashboard-Service-Local-0.1.0/project/platform');
const {createStandaloneStore}=await import(pathToFileURL(path.join(app,'support-standalone.mjs')).href);
const {crmUserGet,readCrmPages}=await import(pathToFileURL(path.join(app,'crm-user.mjs')).href).then(async m=>({...m,...await import(pathToFileURL(path.join(app,'crm-read-policy.mjs')).href)}));
const args=process.argv.slice(2),check=args.includes('--check'),probe=args.includes('--probe'),values=[];for(let i=0;i<args.length;i++)if(args[i]==='--case'&&args[i+1])values.push(args[++i]);
if(!check&&!probe&&!values.length){console.error('Usage: node scripts/crm-case-review.mjs --check | --probe | --case CAS-123 [--case GUID]');process.exit(2)}
const dir=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'DashboardService','user-data');
const store=await createStandaloneStore({directory:dir});
const account=(await store.list())[0],connection=account.organization?.disabled?null:account.organization?.crm;
if(!connection?.username||!connection?.password||!connection?.userId||connection.invalidated)throw Error('Verified Dashboard-Service CRM account is unavailable; configure it in the app.');
const identity=await crmUserGet(connection,'WhoAmI');
if(identity.UserId?.toLowerCase()!==connection.userId.toLowerCase())throw Error('CRM identity changed; stopped.');
if(check){console.log(JSON.stringify({connected:true,crmUserId:connection.userId,displayName:connection.displayName||null,environment:'crm.baridsoft.ir',readOnly:true}));process.exit(0)}
const guid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const page=async(resource,params,maxRows=2000)=>readCrmPages((r,p)=>crmUserGet(connection,r,p),resource,params,{maxPages:100,maxRows,maxMs:180000,requireComplete:true});
const fields='incidentid,ticketnumber,title,description,createdon,modifiedon,statuscode,statecode,_customerid_value,_ownerid_value';
const relationQueries=id=>({
 notes:['annotations',{'$select':'annotationid,subject,notetext,createdon,modifiedon,isdocument,filename,_objectid_value','$filter':'_objectid_value eq '+id,'$orderby':'createdon asc'}],
 posts:['posts',{'$select':'postid,text,createdon,source,_regardingobjectid_value','$filter':'_regardingobjectid_value eq '+id,'$orderby':'createdon asc'}],
 tasks:['tasks',{'$select':'activityid,subject,description,createdon,modifiedon,scheduledend,statecode,statuscode,_regardingobjectid_value','$filter':'_regardingobjectid_value eq '+id,'$orderby':'createdon asc'}],
 activities:['activitypointers',{'$select':'activityid,activitytypecode,subject,description,createdon,scheduledend,statecode,_regardingobjectid_value','$filter':'_regardingobjectid_value eq '+id,'$orderby':'createdon asc'}]
});
if(probe){const id='00000000-0000-0000-0000-000000000000',checks={};for(const [kind,[resource,params]]of Object.entries(relationQueries(id))){try{await page(resource,params,1);checks[kind]='available'}catch(error){checks[kind]='unavailable: '+error.message}}console.log(JSON.stringify({readOnly:true,probe:checks}));process.exit(0)}
const output=[];
for(const input of values){const filter=guid.test(input)?'incidentid eq '+input:'ticketnumber eq \''+input.replaceAll("'","''")+'\'';const found=await page('incidents',{'$select':fields,'$filter':filter,'$top':'10'},10);
 if(!found.value.length){output.push({input,found:false});continue}
 for(const incident of found.value){const id=incident.incidentid,result={input,found:true,incident,categories:{}};for(const [kind,[resource,params]]of Object.entries(relationQueries(id))){try{const data=await page(resource,params);result.categories[kind]={complete:true,count:data.value.length,rows:data.value}}catch(error){result.categories[kind]={complete:false,error:error.message}}}output.push(result)}
}
console.log(JSON.stringify({environment:'crm.baridsoft.ir',readOnly:true,checkedAt:new Date().toISOString(),results:output}));
