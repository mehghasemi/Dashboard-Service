import {randomUUID} from 'node:crypto'
const error=(message,status=400)=>Object.assign(Error(message),{status})
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw error('متن درخواست یا نتیجه معتبر نیست.');return value.trim()}
export function createReferral(state,input,actor,records,at=new Date().toISOString()){
 if(!actor?.id)throw error('ورود لازم است.',401)
 if(!Array.isArray(input.recordIds)||!input.recordIds.length||input.recordIds.length>100)throw error('کیس‌های ارجاع را انتخاب کنید.')
 const ids=[...new Set(input.recordIds)].sort(),selected=ids.map(id=>records.find(r=>(r.crm_id||r.id)===id));if(selected.some(r=>!r))throw error('کیس خارج از محدوده دسترسی است.',403)
 if(ids.length>1&&(!selected[0].parent_id||selected.some(r=>r.parent_id!==selected[0].parent_id)))throw error('ارجاع مشترک باید برای کیس‌های یک بکلاگ باشد.')
 const owner=text(input.owner,150),ownerId=text(input.ownerId,150),title=text(input.title,300)
 if(!['normal','important','urgent'].includes(input.priority))throw error('اولویت معتبر نیست.')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.due||'')||!Number.isFinite(Date.parse(input.due))||new Date(input.due).toISOString().slice(0,10)!==input.due)throw error('موعد معتبر لازم است.')
 state.referrals??=[]
 const existing=state.referrals.find(r=>r.status!=='accepted'&&r.module===input.module&&JSON.stringify(r.recordIds)===JSON.stringify(ids));if(existing)return existing
 if(state.referrals.length>=5000)throw error('ظرفیت اقدام‌ها پر شده است.')
 const row={id:randomUUID(),module:input.module,recordIds:ids,records:selected.map(r=>({id:r.crm_id||r.id,title:r.title,customer:r.customer,number:r.number})),owner,ownerId,title,due:input.due,priority:input.priority,status:'open',actor:actor.id,actorName:actor.name,revision:0,createdAt:at,events:[{type:'created',actor:actor.id,name:actor.name,at}]};state.referrals.unshift(row);return row
}
export function updateReferral(state,input,actor,at=new Date().toISOString()){
 const row=state.referrals?.find(r=>r.id===input.id);if(!row)throw error('اقدام پیدا نشد.',404)
 if(row.revision!==input.revision)throw error('اقدام هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',409)
 if(!['progress','waiting','result','accept','return'].includes(input.event))throw error('عملیات معتبر نیست.')
 const deciding=['accept','return'].includes(input.event)
 if(deciding&&actor.id!==row.actor)throw error('تأیید یا بازگشت با ثبت‌کننده اقدام است.',403)
 if(deciding&&row.status!=='result'||!deciding&&row.status==='accepted')throw error('وضعیت اقدام با این عملیات سازگار نیست.',409)
 if(!deciding&&actor.id!==row.ownerId)throw error('ثبت نتیجه با مسئول اقدام است.',403)
 const result=text(input.text,4000)
 row.status={progress:'progress',waiting:'waiting',result:'result',accept:'accepted',return:'open'}[input.event];row.revision++;row.updatedAt=at;row.events.push({type:input.event,text:result,actor:actor.id,name:actor.name,at});return row
}
