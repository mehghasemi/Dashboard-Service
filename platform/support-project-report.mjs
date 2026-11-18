// Source registration dates must never be presented as inferred event dates.
export function projectEvidence(project,source={}) {
 const notes=(project.notes||project.evidence?.notes||[]).map(n=>({id:n.id,title:n.title||'',text:n.text||'',registeredAt:n.createdAt||null,modifiedAt:n.modifiedAt||n.date||null,eventDate:null})).sort((a,b)=>String(a.registeredAt||a.modifiedAt||'').localeCompare(String(b.registeredAt||b.modifiedAt||'')));
 return {projectId:project.id||project.crm_id,title:project.title,customer:project.customer,status:project.status||project.source_status,notes,coverage:{notes:source.coverage?.notes===true,attachments:false,correspondence:false},fetchedAt:source.fetchedAt||null,analysisStatus:'awaiting-analysis',warnings:['تاریخ ثبت یادداشت الزاماً تاریخ وقوع رویداد نیست.','فاصله بین یادداشت‌ها به معنی تأخیر یا زمان کار نیست.','پیوست‌ها و مکاتبات خارج از یادداشت‌های دریافت‌شده هنوز بررسی نشده‌اند.']};
}
export function calendarUnion(intervals){
 const spans=intervals.map(({start,end})=>{const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw Error('تاریخ کامل لازم است.');const t=Date.parse(s);if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error('تاریخ نامعتبر');return t};const a=parse(start),b=parse(end);if(b<a)throw Error('بازه معکوس');return [a,b]}).sort((a,b)=>a[0]-b[0]);let days=0,last=null;for(const [a,b]of spans){if(!last||a>last[1]){if(last)days+=(last[1]-last[0])/86400000;last=[a,b]}else last[1]=Math.max(last[1],b)}return days+(last?(last[1]-last[0])/86400000:0);
}
