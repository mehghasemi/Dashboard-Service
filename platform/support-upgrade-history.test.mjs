import test from 'node:test'
import assert from 'node:assert/strict'
import {releaseMonth,mergeUpgradeHistory,mergeUpgradeRecords} from './support-upgrade-history.mjs'
test('Release parsing rejects missing/invalid months',()=>{assert.deepEqual(releaseMonth('۰۵۰۸ - آبان ماه'),{year:1405,month:8});assert.deepEqual(releaseMonth('1405/08'),{year:1405,month:8});assert.equal(releaseMonth('0513'),null);assert.equal(releaseMonth('آبان'),null)})
test('latest Release wins, missing and older rows preserve history',()=>{const row=(release,id)=>({customer_id:'a',crm_id:id,evidence:{release}});const a=mergeUpgradeHistory({},[row('0507','1'),row('0508','2'),row('نامشخص','3')],'now');assert.equal(a.history.a.month,8);assert.equal(a.unknown,1);assert.deepEqual(mergeUpgradeHistory(a.history,[],'later').history,a.history);assert.equal(mergeUpgradeHistory(a.history,[row('0506','4')],'later').history.a.month,8)})

test('history retains missing backlogs, updates existing ones without duplicates',()=>{const make=(id,release)=>({crm_id:id,customer_id:'a',evidence:{release}});const first=mergeUpgradeRecords([],[make('1','0507'),make('2','0508')],'first');const second=mergeUpgradeRecords(first,[make('2','0506')],'second');assert.equal(second.length,2);assert.equal(second[0].month,7);assert.equal(second.find(r=>r.backlogId==='2').month,6)})
