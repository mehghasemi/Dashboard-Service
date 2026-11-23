import {createHash} from 'node:crypto'
import path from 'node:path'
import {createSupportHttp} from './lib/support-http.mjs'
import {supportCrm} from './lib/support-crm.mjs'

const scope=createHash('sha256').update('combine:dashboard-service:workspace:v1').digest('hex')

export async function createTool({root,toolId,store,send,bodyJson,requireTool,readerFor,repository,worker,identityRead,version}){
  if(toolId!=='dashboard-service'||typeof readerFor!=='function')throw Error('Support extension requires organization CRM reading')
  const platformRoot=path.resolve(root,'../../..')
  if(!repository){const {createWorkspaceStore}=await import('../../../workspace-store.mjs');repository=createWorkspaceStore({scope})}
  const checkedWorker=worker||(async(_root,connection,operation,options)=>{
    const read=await readerFor(options.user)
    const result=await supportCrm(root,connection,operation,options)
    await read('WhoAmI')
    return result
  })
  const checkedIdentity=identityRead||(async(_connection,resource,user)=>{
    const read=await readerFor(user)
    return read(resource)
  })
  const support=createSupportHttp({root,store,repository,send,bodyJson,
    requireAccess:requireTool,worker:checkedWorker,identityRead:checkedIdentity,
    version:version||(async()=>{const {componentVersion}=await import('../../../component-status.mjs');return componentVersion(platformRoot,toolId)})})
  const timer=setInterval(()=>support.tick().catch(()=>{}),60000)
  timer.unref()
  return {handle:support.handle}
}
