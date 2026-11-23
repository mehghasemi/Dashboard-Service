import test from 'node:test';
import assert from 'node:assert/strict';
import {crmRecordUrl} from './crm-record-link.mjs';
const id='10000000-0000-4000-8000-000000000001';
test('case, customer and program links use the correct CRM entity',()=>{
 for(const [source,entity] of [['planning','incident'],['backlogs','incident'],['customer','account'],['projects','brd_project']]){
  const u=new URL(crmRecordUrl(source,id));
  assert.equal(u.origin,'https://crm.baridsoft.ir');
  assert.equal(u.pathname,'/Main/main.aspx');
  assert.equal(u.searchParams.get('etn'),entity);
  assert.equal(u.searchParams.get('pagetype'),'entityrecord');
  assert.equal(u.searchParams.get('id'),id);
 }
});
test('invalid IDs and unknown sources have no link',()=>{
 for(const value of [null,'','local-action','javascript:alert(1)','<img>'])assert.equal(crmRecordUrl('planning',value),null);
 assert.equal(crmRecordUrl('unknown',id),null);
});
test('CRM base address is configurable and HTTPS only',()=>{
 assert.equal(new URL(crmRecordUrl('cases',id,{baseUrl:'https://other.example.test/app/main.aspx'})).host,'other.example.test');
 assert.throws(()=>crmRecordUrl('cases',id,{baseUrl:'http://other.example.test/main.aspx'}));
});
