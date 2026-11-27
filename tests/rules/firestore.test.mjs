import {before, after, beforeEach, test} from 'node:test';
import {assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, collection, query, where, limit, setDoc, updateDoc, deleteDoc} from 'firebase/firestore';
import {testEnvironment,baseData,context} from './helpers.mjs';

let env;
before(async()=>{env=await testEnvironment('firestore');});
after(async()=>{if(env) await env.cleanup();});
beforeEach(async()=>baseData(env));
const read=(uid,path,claims)=>getDoc(doc(context(env,uid,claims).firestore(),path));

test('anonymous sees active catalog and sanitized verified reviews only',async()=>{
  const db=env.unauthenticatedContext().firestore();
  for(const path of ['shops/shop1','categories/main','menuItems/meal','reviews/public1'])
    await assertSucceeds(getDoc(doc(db,path)));
  for(const path of ['shops/hidden','categories/hidden','menuItems/hidden','menuItems/hiddenShop','reviews/unverified','orders/delivering'])
    await assertFails(getDoc(doc(db,path)));
});
test('catalog queries require active and shop scope, not rules-as-filters',async()=>{
  const db=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(query(collection(db,'shops'),where('active','==',true),limit(20))));
  await assertFails(getDocs(query(collection(db,'shops'),limit(20))));
  await assertSucceeds(getDocs(query(collection(db,'menuItems'),where('shopId','==','shop1'),where('active','==',true),limit(20))));
  await assertFails(getDocs(query(collection(db,'menuItems'),where('shopId','==','shop1'),limit(20))));
  await assertSucceeds(getDocs(query(collection(db,'reviews'),where('verifiedCompletedOrder','==',true),limit(20))));
  await assertFails(getDocs(collection(db,'reviews')));
});
test('own private profile and allowlisted children; device tokens never client-readable',async()=>{
  for(const path of ['users/customer','users/customer/addresses/a1','users/customer/favorites/meal','users/customer/carts/active','users/customer/notifications/e1'])
    await assertSucceeds(read('customer',path));
  await assertFails(read('other','users/customer'));
  await assertFails(read('admin','users/customer'));
  await assertFails(read('customer','users/customer/devices/device1'));
  await assertFails(read('admin','users/customer/devices/device1'));
  await assertFails(getDocs(collection(context(env,'admin').firestore(),'users')));
});
test('missing or inactive current authority fails closed even with forged claims',async()=>{
  await assertFails(read('missing','orders/delivering',{role:'admin',admin:true}));
  await assertFails(read('locked','orders/delivering',{role:'admin',active:true}));
  await assertFails(read('other','orders/delivering',{role:'admin',admin:true}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'users/customer'),{active:false}));
  await assertFails(read('customer','users/customer'));
  await assertFails(read('customer','orders/delivering'));
});
test('order participants read scoped detail and events; unrelated accounts cannot',async()=>{
  for(const uid of ['customer','merchant','driver','admin']){
    await assertSucceeds(read(uid,'orders/delivering'));
    await assertSucceeds(read(uid,'orders/delivering/events/e1'));
  }
  for(const uid of ['other','merchant2','strangerDriver'])
    await assertFails(read(uid,'orders/delivering'));
});
test('customer and merchant order queries are scoped; driver has no public jobs feed',async()=>{
  await assertSucceeds(getDocs(query(collection(context(env,'customer').firestore(),'orders'),where('customerUid','==','customer'),limit(20))));
  await assertSucceeds(getDocs(query(collection(context(env,'merchant').firestore(),'orders'),where('shopId','==','shop1'),limit(20))));
  await assertSucceeds(getDocs(query(collection(context(env,'driver').firestore(),'orders'),where('driverUid','==','driver'),limit(20))));
  await assertFails(getDocs(query(collection(context(env,'driver').firestore(),'orders'),where('status','==','PENDING'),limit(20))));
  await assertFails(getDocs(collection(context(env,'customer').firestore(),'orders')));
});
test('driver reads assigned detail but chat only after assignment ACCEPTED',async()=>{
  await assertSucceeds(read('driver','orders/assigned'));
  await assertFails(read('driver','orders/assigned/messages/m1'));
  await assertSucceeds(read('driver','orders/delivering/messages/m1'));
  await assertSucceeds(read('driver','orders/completed/messages/m1'));
  await assertSucceeds(read('customer','orders/completed/messages/m1'));
  await assertFails(read('strangerDriver','orders/delivering/messages/m1'));
});
test('current active and role authority immediately remove driver access',async()=>{
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'users/driver'),{active:false}));
  await assertFails(read('driver','orders/delivering'));
  await env.withSecurityRulesDisabled(async ctx=>{
    await updateDoc(doc(ctx.firestore(),'users/driver'),{role:'customer',active:true});
  });
  await assertFails(read('driver','orders/delivering'));
});
test('tracking is current-document only while DELIVERING for participants',async()=>{
  for(const uid of ['customer','merchant','driver','admin'])
    await assertSucceeds(read(uid,'orders/delivering/deliveryTracking/current'));
  await assertFails(read('other','orders/delivering/deliveryTracking/current'));
  await assertFails(read('customer','orders/assigned/deliveryTracking/current'));
  await assertFails(read('customer','orders/completed/deliveryTracking/current'));
  await assertFails(getDocs(collection(context(env,'customer').firestore(),'orders/delivering/deliveryTracking')));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'shops/shop1/drivers/driver'),{approved:false}));
  await assertFails(read('driver','orders/delivering/deliveryTracking/current'));
});
test('merchant can inspect own hidden menu/approvals, never other shop private data',async()=>{
  await assertSucceeds(read('merchant','menuItems/hidden'));
  await assertSucceeds(read('merchant','shops/hidden'));
  await assertSucceeds(read('merchant','shops/shop1/drivers/driver'));
  await assertFails(read('merchant2','menuItems/hidden'));
  await assertFails(read('driver','shops/shop1/drivers/driver'));
});
test('even active admin cannot read backend-only operations/tokens/counters',async()=>{
  for(const uid of ['customer','admin'])
    for(const path of ['operations/private','notificationOutbox/private','adminAudit/private','system/adminRegistry','vouchers/private'])
      await assertFails(read(uid,path));
});
test('ALL client creates updates deletes are denied, including self and admin',async()=>{
  for(const uid of ['customer','merchant','driver','admin']){
    const db=context(env,uid).firestore();
    await assertFails(setDoc(doc(db,'users/'+uid+'/addresses/new'),{addressText:'attempt'}));
    await assertFails(updateDoc(doc(db,'users/'+uid),{role:'admin'}));
    await assertFails(setDoc(doc(db,'orders/injected'),{customerUid:uid,status:'COMPLETED'}));
    await assertFails(setDoc(doc(db,'orders/delivering/messages/injected'),{text:'attempt'}));
    await assertFails(deleteDoc(doc(db,'reviews/public1')));
  }
});
