// Release Time is a Persian year/month, not a sync date or proof of resolution.
export function releaseMonth(value){
 const s=String(value||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();
 let m=/^(14\d{2})[\/\-](0?[1-9]|1[0-2])(?:\D|$)/.exec(s);
 if(m)return {year:+m[1],month:+m[2]};
 m=/^(14\d{2})(0[1-9]|1[0-2])(?:\D|$)/.exec(s);if(m)return {year:+m[1],month:+m[2]};
 m=/^(\d{2})(0[1-9]|1[0-2])(?:\D|$)/.exec(s);return m?{year:1400+Number(m[1]),month:+m[2]}:null;
}
export function mergeUpgradeHistory(previous,records,fetchedAt){
 const history=structuredClone(previous||{});let unknown=0;
 for(const r of records){const month=releaseMonth(r.evidence?.release);if(!r.customer_id||!month){unknown++;continue}
 const old=history[r.customer_id],key=month.year*12+month.month;
 if(!old||key>old.year*12+old.month||key===old.year*12+old.month&&String(r.crm_id)<String(old.backlogId))history[r.customer_id]={...month,release:r.evidence.release,backlogId:r.crm_id,backlogNumber:r.number,status:r.source_status,customer:r.customer,observedAt:fetchedAt};
 }
 return {history,unknown};
}

export function mergeUpgradeRecords(previous,records,fetchedAt){
 const saved=new Map((previous||[]).map(r=>[r.backlogId,r]));
 for(const r of records){if(!r.crm_id)continue;const month=releaseMonth(r.evidence?.release);saved.set(r.crm_id,{backlogId:r.crm_id,backlogNumber:r.number,title:r.title,customerId:r.customer_id,customer:r.customer,release:r.evidence?.release||'',year:month?.year??null,month:month?.month??null,status:r.source_status,observedAt:fetchedAt})}
 return [...saved.values()].sort((a,b)=>(b.year||0)*12+(b.month||0)-((a.year||0)*12+(a.month||0))||String(a.backlogId).localeCompare(String(b.backlogId)));
}
