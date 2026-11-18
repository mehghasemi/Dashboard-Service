import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
export async function lockStandaloneProfile(directory){
 await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'running.lock'),nonce=randomUUID(),record=JSON.stringify({pid:process.pid,nonce})
 for(let attempt=0;attempt<2;attempt++){
  try{const handle=await fs.open(file,'wx',0o600);try{await handle.writeFile(record)}finally{await handle.close()};return async()=>{try{if(await fs.readFile(file,'utf8')===record)await fs.unlink(file)}catch(e){if(e.code!=='ENOENT')throw e}}}
  catch(e){if(e.code!=='EEXIST')throw e;const previous=await fs.readFile(file,'utf8');let state;try{state=JSON.parse(previous)}catch{throw Error('Private profile lock is invalid; preserved for review.')}if(!Number.isSafeInteger(state.pid)||state.pid<=0)throw Error('Invalid lock PID');let alive=true;try{process.kill(state.pid,0)}catch(e){if(e.code==='ESRCH')alive=false}if(alive)throw Object.assign(Error('این فضای کار در حال اجراست؛ ابتدا همان اجرا را متوقف کنید.'),{status:409});if(await fs.readFile(file,'utf8')===previous)await fs.unlink(file)}
 }
 throw Error('Profile is locked')
}
