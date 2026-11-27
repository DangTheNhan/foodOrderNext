import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectMapping} from './dry-run.mjs';
test('mapping inspection has zero writes and never declares import-ready',()=>{
  const result=inspectMapping({users:[{legacyId:'legacy1',targetUid:'demo-customer'}],
    menuItems:[{legacyId:'meal1',shopId:'shop1',priceVnd:30000,currency:'VND'}],
    orders:[{legacyId:'order1',customerLegacyId:'legacy1',shopId:'shop1',status:'COMPLETED',grandTotalVnd:35000}]});
  assert.equal(result.writes,0);assert.equal(result.readyForImport,false);assert.deepEqual(result.issues,[]);
});
test('mapping reports duplicate orphan unconverted prices and legacy states',()=>{
  const result=inspectMapping({users:[{legacyId:'u',targetUid:'demo-customer'},{legacyId:'u',targetUid:'demo-customer-2'}],
    menuItems:[{legacyId:'m',shopId:'shop1',priceVnd:2.5,currency:'USD'}],
    orders:[{legacyId:'o',customerLegacyId:'missing',shopId:'shop1',status:'ongoing',grandTotalVnd:-1}]});
  assert.equal(result.issues.length,5);
});
test('mapping rejects credential/personal fields instead of logging values',()=>{
  assert.throws(()=>inspectMapping({users:[{legacyId:'u',targetUid:'demo-customer',password:'never-log'}]}),/Unexpected fields/);
  assert.throws(()=>inspectMapping({rawSql:[]}),/Only users/);
  const duplicate=inspectMapping({users:[{legacyId:'u1',targetUid:'demo-customer'},{legacyId:'u2',targetUid:'demo-customer'}]});
  assert.equal(duplicate.issues[0].code,'DUPLICATE_TARGET_UID');
});
