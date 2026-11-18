import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {fileURLToPath} from 'node:url'
import {startSupportStandalone,createStandaloneStore} from './support-standalone.mjs'
const root=path.dirname(fileURLToPath(import.meta.url)),codec=async value=>value,id='10000000-0000-4000-8000-000000000001'
async function temp(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'combine-support-handoff-'));t.after(async()=>{if(!path.resolve(directory).startsWith(path.join(os.tmpdir(),'combine-support-handoff-')))throw Error('Unsafe test cleanup');await fs.rm(directory,{recursive:true,force:true})});return directory}
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port}
test('standalone store never exports launch secret, persists organization and refuses another Windows identity',async t=>{const directory=await temp(t),store=await createStandaloneStore({directory,codec,identity:async()=>'test-sid'}),u=(await store.list())[0];assert.equal(u.toolRoles.support,'user');assert.equal(Object.hasOwn(u,'launchSecret'),false);await store.setOrganization(u.id,{id:'one',crm:{userId:id}},null);assert.equal((await store.get(u.id)).organization.id,'one');await assert.rejects(store.setOrganization(u.id,{id:'two'},null),e=>e.status===409);await assert.rejects(createStandaloneStore({directory,codec,identity:async()=>'other-sid'}),e=>e.status===503)})
test('single-tool web host requires local launch, protects Origin, obtains personal CRM and hides irrelevant app password',async t=>{const directory=await temp(t),port=await freePort(),app=await startSupportStandalone({root,directory,port,codec,identity:async()=>'test-sid',validateCrm:async c=>({...c,userId:id,displayName:'Synthetic CRM user',verifiedAt:new Date().toISOString()}),identityRead:async()=>({UserId:id})});t.after(()=>app.close());const origin='http://127.0.0.1:'+port;
 assert.equal((await fetch(origin+'/support/',{redirect:'manual'})).status,302)
 assert.equal((await fetch(origin+'/api/support/state')).status,401)
 assert.equal((await fetch(origin+'/launch?token='+'x'.repeat(64),{redirect:'manual'})).status,401)
 const opened=await fetch(app.launch.url,{redirect:'manual'});assert.equal(opened.status,302);assert.equal(opened.headers.get('location'),'/support/#settings');const cookie=opened.headers.get('set-cookie').split(';')[0]
 const request=(route,body,extra={})=>fetch(origin+route,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/json',origin}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})})
 const info=await (await request('/api/support/info')).json();assert.equal(info.standalone,true);assert.equal(info.passwordChangeAllowed,false);assert.equal(info.crmConnected,false)
 assert.equal((await request('/api/support/connection/check',{}, {origin:'https://attacker.example'})).status,403)
 assert.equal((await request('/api/support/connection/check',{}, {origin:''})).status,403)
 assert.equal((await request('/.env')).status,404)
 const saved=await request('/api/account/organization',{username:'DOMAIN\\synthetic',password:'only-synthetic-test-secret',crm:true,calendar:false});assert.equal(saved.status,200);assert.equal((await saved.json()).crm.state,'connected')
 const checked=await request('/api/support/connection/check',{});assert.equal(checked.status,200);assert.equal((await checked.json()).state,'connected');assert.equal(JSON.stringify(await (await request('/api/support/info')).json()).includes('only-synthetic-test-secret'),false)
 assert.equal((await request('/api/auth/logout',{})).status,200);assert.equal((await request('/api/support/state')).status,401)
})
