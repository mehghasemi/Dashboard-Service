import test from 'node:test'
import assert from 'node:assert/strict'
import {supportCrmUrl} from './public/support-crm-links.mjs'
test('CRM links use the exact entity and real GUID for every supported record source',()=>{for(const [source,entity]of Object.entries({planning:'incident',backlogs:'incident',periodic:'incident',projects:'brd_project',customers:'account',activities:'activitypointer'})){const url=new URL(supportCrmUrl(source,'10000000-0000-4000-8000-000000000001'));assert.equal(url.origin,'https://crm.baridsoft.ir');assert.equal(url.pathname,'/Main/main.aspx');assert.equal(url.searchParams.get('etn'),entity);assert.equal(url.searchParams.get('pagetype'),'entityrecord')}})
test('missing, invented and injected record IDs do not produce CRM links',()=>{for(const id of ['',null,'local-action','javascript:alert(1)','<img src=x>'])assert.equal(supportCrmUrl('planning',id),null);assert.equal(supportCrmUrl('unknown','10000000-0000-4000-8000-000000000001'),null)})
