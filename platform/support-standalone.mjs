// Development handover host only. Combine production keeps its own shared login.
import http from 'node:http'
import https from 'node:https'
import {isIPv4} from 'node:net'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto'
import {createSupportHttp} from './support-http.mjs'
import {createOrganizationHttp} from './organization-http.mjs'
import {createWorkspaceStore} from './workspace-store.mjs'
import {dpapi} from './history.mjs'
import {windowsSid} from './crm-profile.mjs'
import {defaultToolRoles} from './platform-access.mjs'
import {lockStandaloneProfile} from './support-standalone-lock.mjs'
import {componentVersion} from './component-status.mjs'
const failure=(message,status=400)=>Object.assign(Error(message),{status})
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
export async function createStandaloneStore({directory,codec=dpapi,identity=windowsSid}){
 const owner=await identity(),file=path.join(directory,'account.protected.json'),scope=createHash('sha256').update('combine-support-standalone:'+owner+':'+path.resolve(directory)).digest('hex');let queue=Promise.resolve(),cachedAccount=null
 async function read(){try{const raw=await fs.readFile(file,'utf8');if(cachedAccount?.raw===raw)return structuredClone(cachedAccount.value);const box=JSON.parse(raw),v=JSON.parse(await codec(box.encrypted,true));if(v.schema!==1||v.owner!==owner||!v.id||!v.launchSecret)throw Error('Binding');cachedAccount={raw,value:structuredClone(v)};return v}catch(e){if(e.code==='ENOENT')return null;throw failure('تنظیمات امن قابل خواندن نیست؛ فایل قبلی حفظ شد.',503)}}
 async function save(v){await fs.mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify({schema:1,encrypted:await codec(JSON.stringify(v))}),{mode:0o600});await fs.rename(temp,file)}finally{await fs.unlink(temp).catch(()=>{})}}
 if(!await read())await save({schema:1,owner,id:randomUUID(),name:process.env.USERNAME||'کاربر محلی',launchSecret:randomBytes(32).toString('hex'),organization:null,revision:1})
 const user=v=>({id:v.id,name:v.name,enabled:true,isAdmin:false,revision:v.revision,scope,access:[],toolRoles:{...defaultToolRoles,support:'user'},organization:v.organization})
 return {scope,get:async id=>{const v=await read();return v.id===id?user(v):null},list:async()=>[user(await read())],launchSecret:async()=>(await read()).launchSecret,setOrganization(id,organization,expectedId){const next=queue.catch(()=>{}).then(async()=>{const v=await read();if(v.id!==id)throw failure('حساب مجاز نیست.',403);if((v.organization?.id||null)!==expectedId)throw failure('حساب سازمانی هم‌زمان تغییر کرده است.',409);v.organization=organization;await save(v);return {saved:!organization.disabled}});queue=next;return next}}
}
export async function startSupportStandalone({root=path.dirname(fileURLToPath(import.meta.url)),directory=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'CombineSupport','user-data'),port=3049,lan=null,codec=dpapi,identity=windowsSid,validateCrm,identityRead,worker}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw failure('پورت معتبر نیست.')
 if(lan && (!isIPv4(lan.address) || !lan.pfx || !lan.passphrase))throw failure('تنظیم میزبان امن شبکه معتبر نیست.')
 const address=lan?.address||'127.0.0.1'
 const authority=address+':'+port
 const makeServer=lan?handler=>https.createServer({pfx:lan.pfx,passphrase:lan.passphrase,minVersion:'TLSv1.2'},handler):handler=>http.createServer(handler)
 const releaseProfile=await lockStandaloneProfile(directory)
 try{
 const origin=(lan?'https://':'http://')+authority,cookie='combine_support_'+port,store=await createStandaloneStore({directory,codec,identity}),repository=createWorkspaceStore({scope:store.scope,directory:path.join(directory,'workspace'),codec,identity}),sessions=new Map(),version=await componentVersion(root,'support')
 const send=(res,status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(type.includes('json')?JSON.stringify(value):value)}
 const bodyJson=async req=>{let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>1500000)throw failure('حجم درخواست بیش از حد مجاز است.',413)}try{return JSON.parse(content||'{}')}catch{throw failure('درخواست معتبر نیست.')}}
 const support=createSupportHttp({root,store,repository,bodyJson,send:(res,status,value,type)=>send(res,status,value?.metrics?{...value,standalone:true,passwordChangeAllowed:false}:value,type),...(identityRead?{identityRead}:{}),...(worker?{worker}:{})})
 const organization=createOrganizationHttp({store,send,bodyJson,...(validateCrm?{validateCrm}:{})})
 const mime={'.html':'text/html; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'}
 const publicAssets=new Set(['support-ui.mjs','support-account.mjs','support-crm-links.mjs','support.css','support-icon.svg','header-menus.mjs','combine-shell.js','combine-shell.css','combine-tokens.css','combine-components.css','combine-icons.svg','change-password.mjs','password-fields.mjs','logout.mjs','persian-date-picker.mjs','workspace-summary.mjs','fonts/Dana-Regular.woff2','fonts/Dana-Bold.woff2'])
 const rootId=createHash('sha256').update(path.resolve(root)).digest('hex')
 const server=makeServer(async(req,res)=>{try{
  if(req.headers.host!==authority||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw failure('مبدأ درخواست مجاز نیست.',403)
  const url=new URL(req.url,origin)
  if(req.method==='GET'&&url.pathname==='/api/health'){send(res,200,{ok:true,app:'combine-support-standalone',version,appRootId:rootId});return}
  if(req.method==='GET'&&url.pathname==='/launch'&&same(url.searchParams.get('token'),await store.launchSecret())){const session=randomBytes(32).toString('hex');sessions.set(session,Date.now()+8*3600000);const user=(await store.list())[0];res.writeHead(302,{'Set-Cookie':`${cookie}=${session}; HttpOnly; SameSite=Strict;${lan?' Secure;':''} Path=/; Max-Age=28800`,Location:user.organization&&!user.organization.disabled?'/support/':'/support/#settings','Referrer-Policy':'no-referrer'});res.end();return}
  if(req.method==='GET'&&url.pathname==='/login.html'){send(res,200,'<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>ورود به دستیار مدیر پشتیبانی</title><body><h1>دستیار مدیر پشتیبانی</h1><p>برای ورود امن محلی، فایل Start.cmd یا میان‌بر برنامه را اجرا کنید.</p><p>اطلاعات CRM پس از ورود، داخل تنظیمات ابزار وارد می‌شود.</p></body></html>','text/html; charset=utf-8');return}
  const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1),expiry=sessions.get(token)
  if(!expiry||expiry<Date.now()){if(req.method==='GET'&&['/','/support','/support/','/home.html'].includes(url.pathname)){res.writeHead(302,{Location:'/login.html'});res.end();return}throw failure('برنامه را از Start.cmd باز کنید.',401)}
  if(!['GET','HEAD'].includes(req.method)&&(req.headers.origin!==origin||!String(req.headers['content-type']||'').startsWith('application/json')))throw failure('درخواست باید از همین برنامه و به‌صورت JSON ارسال شود.',403)
  const user=(await store.list())[0]
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){sessions.clear();res.setHeader('Set-Cookie',`${cookie}=; HttpOnly; SameSite=Strict;${lan?' Secure;':''} Path=/; Max-Age=0`);send(res,200,{ok:true});return}
  if(req.method==='GET'&&['/','/home.html'].includes(url.pathname)){res.writeHead(302,{Location:'/support/'});res.end();return}
  if(await organization.handle(req,res,url,user))return
  if(await support.handle(req,res,url,user))return
  const relative=decodeURIComponent(url.pathname).replace(/^\//,'');if(req.method!=='GET'||!publicAssets.has(relative))throw failure('مسیر پیدا نشد.',404)
  send(res,200,await fs.readFile(path.join(root,'public',relative)),mime[path.extname(relative)])
 }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'درخواست انجام نشد؛ داده قبلی حفظ شد.'});else res.end()}})
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,address,resolve)})
 const timer=setInterval(()=>support.tick().catch(()=>{}),60000);timer.unref();server.on('close',()=>{clearInterval(timer);void releaseProfile()})
 const launch={pid:process.pid,port,rootId,url:origin+'/launch?token='+await store.launchSecret()};await fs.writeFile(path.join(directory,'launch.json'),JSON.stringify(launch),{mode:0o600})
 return {server,store,repository,launch,close:()=>new Promise(resolve=>server.close(async()=>{await releaseProfile();resolve()}))}
 }catch(error){await releaseProfile();throw error}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),option=name=>{const at=args.indexOf(name);return at>=0?args[at+1]:null}
 const app=await startSupportStandalone({...(option('--data-directory')?{directory:path.resolve(option('--data-directory'))}:{}),port:Number(option('--port')||3049)})
 console.log('Support development host listening on loopback port '+app.launch.port+'. Credentials are requested in the browser.')
 const stop=()=>app.close().finally(()=>process.exit());process.on('SIGINT',stop);process.on('SIGTERM',stop)
}
