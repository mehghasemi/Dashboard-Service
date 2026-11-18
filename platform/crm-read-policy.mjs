export const CRM_BASE='https://crm.baridsoft.ir/Main/api/data/v9.1/'
const metadata=/^EntityDefinitions\(LogicalName='[a-z][a-z0-9_]*'\)\/Attributes(?:\(LogicalName='[a-z][a-z0-9_]*'\))?\/Microsoft\.Dynamics\.CRM\.(?:State|Status|Picklist|Boolean|MultiSelectPicklist|Lookup)AttributeMetadata$/i
const resourcePattern=/^(?:[a-z][a-z0-9_]*|EntityDefinitions(?:\(LogicalName='[a-z][a-z0-9_]*'\)\/(?:OneToManyRelationships|Attributes(?:\/Microsoft\.Dynamics\.CRM\.LookupAttributeMetadata)?))?)$/i
export function crmReadUrl(resource,params={}){
  if(typeof resource!=='string'||(!resourcePattern.test(resource)&&!metadata.test(resource)))throw new Error('مسیر خواندن CRM معتبر نیست.')
  const url=new URL(resource,CRM_BASE)
  for(const [key,value] of Object.entries(params)){
    if(!['$select','$filter','$top','$orderby','$count'].includes(key)&&!(key==='$expand'&&value==='OptionSet'&&metadata.test(resource)))throw new Error('پارامتر CRM مجاز نیست.')
    url.searchParams.set(key,String(value))
  }
  return url.href
}
export function validateNextLink(link,initialUrl){
  const initial=new URL(initialUrl),url=new URL(link,CRM_BASE)
  if(initial.origin!==new URL(CRM_BASE).origin||initial.username||initial.password||initial.hash||!initial.pathname.startsWith(new URL(CRM_BASE).pathname))throw new Error('مسیر اولیهٔ صفحه‌بندی معتبر نیست.')
  crmReadUrl(decodeURIComponent(initial.pathname.slice(new URL(CRM_BASE).pathname.length)),Object.fromEntries(initial.searchParams))
  if(url.origin!==new URL(CRM_BASE).origin||url.username||url.password||url.hash||url.pathname!==initial.pathname||!url.pathname.startsWith(new URL(CRM_BASE).pathname)||/\$batch/i.test(url.pathname))throw new Error('مسیر صفحهٔ بعد CRM مجاز نیست؛ خواندن متوقف شد.')
  for(const key of url.searchParams.keys())if(!['$select','$filter','$top','$orderby','$count','$skiptoken','$expand'].includes(key))throw new Error('پارامتر صفحهٔ بعد CRM مجاز نیست.')
  for(const key of ['$select','$filter','$orderby','$count','$expand'])if(url.searchParams.get(key)!==initial.searchParams.get(key))throw new Error('دامنهٔ صفحه‌بندی CRM تغییر کرده است؛ خواندن متوقف شد.')
  return url.href
}
export function crmTransportUrl(resource,params={}){
  if(resource&&typeof resource==='object'&&Object.keys(resource).every(k=>['nextLink','initialUrl'].includes(k))&&Object.keys(params).length===0)return validateNextLink(resource.nextLink,resource.initialUrl)
  return crmReadUrl(resource,params)
}
export async function readCrmPages(read,resource,params={}, {maxPages=20,maxRows=2000,maxMs=90000,requireComplete=false}={}){
  const initialUrl=crmReadUrl(resource,params),started=Date.now(),seen=new Set(),rows=[]
  let target=resource,arguments_=params,response,pages=0,next=null
  do{
    response=await read(target,arguments_);pages++
    if(!Array.isArray(response.value))throw new Error('پاسخ فهرست CRM معتبر نیست.')
    const available=Math.max(0,maxRows-rows.length),overflow=response.value.length>available
    rows.push(...response.value.slice(0,available))
    next=response['@odata.nextLink']||null
    if(overflow)next=next||'row-limit'
    if(!next)break
    if(next==='row-limit')break
    const checked=validateNextLink(next,initialUrl)
    if(seen.has(checked))throw new Error('صفحه‌بندی CRM تکراری است؛ خواندن متوقف شد.')
    seen.add(checked);target={nextLink:checked,initialUrl};arguments_={}
  }while(pages<maxPages&&rows.length<maxRows&&Date.now()-started<maxMs)
  if(requireComplete&&next)throw new Error('ساختار CRM کامل خوانده نشد؛ نتیجهٔ ناقص استفاده نشد.')
  return {...response,value:rows,'@odata.nextLink':next||undefined,pages,complete:!next}
}
