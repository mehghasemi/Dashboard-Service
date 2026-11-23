import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createTool} from './server.mjs'

const root=path.dirname(fileURLToPath(import.meta.url))
const id='11111111-1111-4111-8111-111111111111'

async function fixture(){
  let user={id,name:'آزمایش',enabled:true,revision:1,toolRoles:{'dashboard-service':'user'}}
  const files=new Map()
  const repository={read:async key=>structuredClone(files.get(key)||{}),mutate:async(key,fn)=>{
    const value=structuredClone(files.get(key)||{})
    const result=await fn(value)
    files.set(key,value)
    return result
  }}
  const store={get:async()=>user,list:async()=>[user]}
  const sent=[]
  const tool=await createTool({root,toolId:'dashboard-service',store,repository,
    send:(_res,status,value)=>sent.push({status,value}),bodyJson:async()=>({}),
    requireTool:current=>{if(current.toolRoles['dashboard-service']==='none')throw Object.assign(Error('denied'),{status:403})},
    readerFor:async()=>async()=>({UserId:'22222222-2222-4222-8222-222222222222'}),
    worker:async()=>({main:{rows:[]},coverage:{}}),
    identityRead:async()=>({UserId:'22222222-2222-4222-8222-222222222222'}),
    version:async()=>'0.1.0'})
  const call=async pathname=>{
    sent.length=0
    const handled=await tool.handle({method:'GET'}, {},new URL('http://localhost'+pathname),user)
    return {handled,...sent[0]}
  }
  return {call,update:value=>{user={...user,...value}},getUser:()=>user}
}

test('server extension serves support state and installed version under its own API',async()=>{
  const app=await fixture()
  assert.equal((await app.call('/api/dashboard-service/support-info')).value.version,'0.1.0')
  const state=await app.call('/api/dashboard-service/state')
  assert.equal(state.status,200)
  assert.ok(state.value.settings.planning)
  assert.equal((await app.call('/api/another-tool/state')).handled,false)
})

test('server extension rejects a revoked tool role',async()=>{
  const app=await fixture()
  app.update({toolRoles:{'dashboard-service':'none'}})
  await assert.rejects(app.call('/api/dashboard-service/state'),/denied/)
})
