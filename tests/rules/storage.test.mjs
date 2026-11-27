import {before,after,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,uploadBytes,getMetadata,updateMetadata,listAll} from 'firebase/storage';
import {doc,updateDoc} from 'firebase/firestore';
import {testEnvironment,baseData,context} from './helpers.mjs';

let env;
before(async()=>{env=await testEnvironment('storage',true);});
after(async()=>{
  if(env){
    // This suite shares the CLI demo project for cross-service lookups. Leave
    // no authority fixture behind for the following API/seed integration run.
    await env.clearStorage();await env.clearFirestore();await env.cleanup();
  }
});
beforeEach(async()=>baseData(env));
const image=new Uint8Array([137,80,78,71,13,10,26,10]);
const meta=uid=>({contentType:'image/png',customMetadata:{ownerUid:uid,state:'pending'}});
const avatar=uid=>'users/'+uid+'/avatars/'+randomUUID();
const object=(uid,path,claims)=>ref(context(env,uid,claims).storage(),path);
test('active verified owner creates private pending avatar; other user cannot read',async()=>{
  const path=avatar('customer'), item=object('customer',path);
  await assertSucceeds(uploadBytes(item,image,meta('customer')));
  await assertSucceeds(getMetadata(item));
  await assertFails(getMetadata(object('other',path)));
  await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(),path)));
  await assertFails(listAll(ref(context(env,'customer').storage(),'users/customer/avatars')));
});
test('rejects anonymous inactive unverified or wrong owner uploads',async()=>{
  await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(),avatar('customer')),image,meta('customer')));
  await assertFails(uploadBytes(object('locked',avatar('locked')),image,meta('locked')));
  await assertFails(uploadBytes(object('customer',avatar('customer'),{email_verified:false}),image,meta('customer')));
  await assertFails(uploadBytes(object('other',avatar('customer')),image,meta('other')));
});
test('rejects MIME size published state and unexpected application metadata',async()=>{
  await assertFails(uploadBytes(object('customer',avatar('customer')),image,{...meta('customer'),contentType:'text/plain'}));
  await assertFails(uploadBytes(object('customer',avatar('customer')),new Uint8Array(5*1024*1024+1),meta('customer')));
  await assertFails(uploadBytes(object('customer',avatar('customer')),image,{contentType:'image/png',customMetadata:{ownerUid:'customer',state:'published'}}));
  await assertFails(uploadBytes(object('customer',avatar('customer')),image,{contentType:'image/png',customMetadata:{ownerUid:'customer',state:'pending',foodId:'spoof'}}));
});
test('client cannot overwrite or publish an uploaded object',async()=>{
  const item=object('customer',avatar('customer'));
  await assertSucceeds(uploadBytes(item,image,meta('customer')));
  await assertFails(uploadBytes(item,image,meta('customer')));
  await assertFails(updateMetadata(item,{customMetadata:{ownerUid:'customer',state:'published'}}));
});
test('merchant upload requires current shop ownership and stays private',async()=>{
  const path='shops/shop1/menu/'+randomUUID();
  await assertSucceeds(uploadBytes(object('merchant',path),image,meta('merchant')));
  await assertFails(getMetadata(object('customer',path)));
  await assertFails(uploadBytes(object('merchant2','shops/shop1/menu/'+randomUUID()),image,meta('merchant2')));
});
test('public menu image requires backend published metadata and exact active Firestore attach',async()=>{
  const path='shops/shop1/menu/'+randomUUID();
  await env.withSecurityRulesDisabled(async ctx=>{
    await uploadBytes(ref(ctx.storage(),path),image,{contentType:'image/png',customMetadata:{state:'published',ownerUid:'merchant',foodId:'meal'}});
    await updateDoc(doc(ctx.firestore(),'menuItems/meal'),{imagePath:path});
  });
  await assertSucceeds(getMetadata(ref(env.unauthenticatedContext().storage(),path)));
  await assertSucceeds(getMetadata(object('customer',path)));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'menuItems/meal'),{imagePath:'not-attached'}));
  await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(),path)));
});
test('review pending upload requires own COMPLETED COD-confirmed order',async()=>{
  await assertSucceeds(uploadBytes(object('customer','reviews/customer/completed/'+randomUUID()),image,meta('customer')));
  await assertFails(uploadBytes(object('customer','reviews/customer/delivering/'+randomUUID()),image,meta('customer')));
  await assertFails(uploadBytes(object('other','reviews/other/completed/'+randomUUID()),image,meta('other')));
});
test('public review image requires exact verified review attach; no pending folder leak',async()=>{
  const path='reviews/customer/completed/'+randomUUID();
  await env.withSecurityRulesDisabled(async ctx=>{
    await uploadBytes(ref(ctx.storage(),path),image,{contentType:'image/png',customMetadata:{state:'published',ownerUid:'customer',reviewId:'public1'}});
    await updateDoc(doc(ctx.firestore(),'reviews/public1'),{imagePaths:[path]});
  });
  await assertSucceeds(getMetadata(ref(env.unauthenticatedContext().storage(),path)));
  await assertSucceeds(getMetadata(object('other',path)));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'reviews/public1'),{imagePaths:[]}));
  await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(),path)));
});
