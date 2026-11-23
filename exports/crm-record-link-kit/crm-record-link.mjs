const ENTITIES=Object.freeze({
 planning:'incident',cases:'incident',backlogs:'incident',periodic:'incident',
 projects:'brd_project',customers:'account',customer:'account',account:'account',
 activities:'activitypointer',incident:'incident',brd_project:'brd_project',
 task:'task',annotation:'annotation',activitypointer:'activitypointer'
});
const GUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function crmRecordUrl(source,id,{baseUrl='https://crm.baridsoft.ir/Main/main.aspx'}={}){
 const entity=ENTITIES[source],value=String(id||'');
 if(!entity||!GUID.test(value))return null;
 const base=new URL(baseUrl);
 if(base.protocol!=='https:'||base.username||base.password||base.hash)throw Error('CRM base URL must be HTTPS');
 base.searchParams.set('etn',entity);
 base.searchParams.set('pagetype','entityrecord');
 base.searchParams.set('id',value);
 return base.href;
}
export function createCrmRecordLink(source,id,{label='بازکردن در CRM',baseUrl,className='ui-button'}={}){
 const href=crmRecordUrl(source,id,{baseUrl});
 if(!href)return null;
 const a=document.createElement('a');
 a.href=href;
 a.textContent=label;
 a.className=className;
 a.target='_blank';
 a.rel='noopener noreferrer';
 return a;
}
export function appendCrmRecordLink(container,source,id,options={}){
 const link=createCrmRecordLink(source,id,options);
 if(link)container.append(link);
 return link;
}
