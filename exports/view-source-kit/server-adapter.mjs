import {createViewSource,validateSelection} from './view-source.mjs';
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw Error('Request too large')}return JSON.parse(text||'{}')}
export function createViewApi({baseUrl,requestJsonForUser,loadSettings,saveSettings,modules}){
 if(!requestJsonForUser||!loadSettings||!saveSettings||!modules)throw Error('Missing adapter');
 return async function handle(req,res,user){if(!user?.id){json(res,401,{error:'Sign in required'});return}
  try{const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/view-sources/')){json(res,404,{error:'Not found'});return}
   const source=createViewSource({baseUrl,requestJson:requestJsonForUser(user)}),action=path.slice('/api/view-sources/'.length);
   if(req.method==='GET'&&action==='catalog'){json(res,200,{views:await source.listViews()});return}
   if(req.method==='GET'&&action==='settings'){const state=await loadSettings(user.id);json(res,200,{revision:state.revision,settings:state.settings});return}
   if(req.method==='POST'&&action==='settings'){const input=await body(req),module=modules[input.module];if(!module||![60,120,240,480,1440].includes(input.interval)||typeof input.auto!=='boolean')throw Error('Invalid settings');const catalog=await source.listViews(),views=validateSelection(input.views,catalog,module.mainEntity);const saved=await saveSettings(user.id,{revision:input.revision,module:input.module,views,auto:input.auto,interval:input.interval});json(res,200,{revision:saved.revision});return}
   if(req.method==='POST'&&action==='sync'){const input=await body(req),module=modules[input.module];if(!module)throw Error('Invalid module');const state=await loadSettings(user.id),selected=state.settings?.[input.module]?.views?.main;if(!selected)throw Error('Main View missing');const catalog=await source.listViews(),views=validateSelection({main:selected},catalog,module.mainEntity);const result=await source.readRows(views.main);json(res,200,{view:result.view,rows:result.rows});return}
   json(res,404,{error:'Not found'});
  }catch(error){json(res,400,{error:error.message})}
 }
}
