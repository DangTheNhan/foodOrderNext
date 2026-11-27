import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSeedPlan,validateSeedPlan} from './plan.mjs';
import {assertLocalEmulators} from './emulator-guard.mjs';
const env={GCLOUD_PROJECT:'demo-foodordernext',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'};
test('seed is deterministic, bounded and reconciles stock/participants for 1–3 shops',()=>{
  for(const count of [1,2,3]){
    const plan=createSeedPlan(count);assert.equal(validateSeedPlan(plan),true);
    assert.deepEqual(plan,createSeedPlan(count));
    const orders=Object.entries(plan.documents).filter(([p])=>/^orders\/[^/]+$/.test(p)).map(([,d])=>d);
    for(const [path,food]of Object.entries(plan.documents).filter(([p])=>p.startsWith('menuItems/'))){
      const foodId=path.split('/')[1];
      const reserved=orders.filter(o=>o.stockReservation==='RESERVED').flatMap(o=>o.items).filter(i=>i.foodId===foodId).reduce((n,i)=>n+i.quantity,0);
      assert.equal(food.reservedPortions,reserved);assert.equal(food.availablePortions+food.reservedPortions+food.soldPortions,50);
    }
  }
});
test('public review fixture contains no private link or credential',()=>{
  const review=createSeedPlan().documents['reviews/demo-review-completed'];
  for(const field of ['customerUid','orderId','email','phone','addressSnapshot','paymentStatus'])assert.equal(field in review,false);
  assert.equal(review.verifiedCompletedOrder,true);
});

test('seeded profiles satisfy the API contract and reject an empty phone string',()=>{
  const plan=createSeedPlan();
  assert.equal(plan.documents['users/demo-customer'].phone,null);
  plan.documents['users/demo-customer'].phone='';
  assert.throws(()=>validateSeedPlan(plan),/shared data contract/);
});
test('guard fails closed without explicit local emulators, on cloud host/project or credentials',()=>{
  assert.equal(assertLocalEmulators(env),'demo-foodordernext');
  for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']){
    const copy={...env};delete copy[key];assert.throws(()=>assertLocalEmulators(copy));
    assert.throws(()=>assertLocalEmulators({...env,[key]:'firebase.example:8080'}));
  }
  assert.throws(()=>assertLocalEmulators({...env,GCLOUD_PROJECT:'real-project'}));
  assert.throws(()=>assertLocalEmulators({...env,FIREBASE_PROJECT_ID:'real-project'}));
  assert.throws(()=>assertLocalEmulators({...env,GOOGLE_CLOUD_PROJECT:'real-project'}));
  assert.throws(()=>assertLocalEmulators({...env,GOOGLE_APPLICATION_CREDENTIALS:'some-file'}));
});
