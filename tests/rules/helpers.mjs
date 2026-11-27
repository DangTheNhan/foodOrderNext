import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, setDoc, Timestamp} from 'firebase/firestore';

export function localEndpoint(name, expectedPort) {
  const value = process.env[name];
  if (!value || !/^(127\.0\.0\.1|localhost):\d+$/.test(value)) {
    throw new Error(name + ' must point to a local emulator; refusing cloud access');
  }
  const [host, rawPort] = value.split(':');
  const port = Number(rawPort);
  const isolated = process.env.FOODORDER_EMULATOR_ISOLATED === '1' && process.env.RUN_EMULATOR_TESTS === '1';
  if (port < 1 || port > 65535 || (!isolated && port !== expectedPort)) {
    throw new Error(name + ' has the wrong emulator port');
  }
  return {host, port};
}
export async function testEnvironment(suffix, storage = false) {
  // Storage emulator's cross-service firestore.get resolves against the CLI
  // project, not an arbitrary bucket/testing suffix. Run these files serially.
  const projectId = storage ? 'demo-foodordernext' : 'demo-foodordernext-rules-' + suffix;
  const firestore = {...localEndpoint('FIRESTORE_EMULATOR_HOST',8080),
    rules:await readFile(new URL('../../firebase/firestore.rules',import.meta.url),'utf8')};
  const config = {projectId, firestore};
  if(storage) config.storage = {...localEndpoint('FIREBASE_STORAGE_EMULATOR_HOST',9199),
    rules:await readFile(new URL('../../firebase/storage.rules',import.meta.url),'utf8')};
  return initializeTestEnvironment(config);
}
export const stamp=Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
export const people={
  customer:{role:'customer',active:true},
  other:{role:'customer',active:true},
  merchant:{role:'merchant',active:true},
  merchant2:{role:'merchant',active:true},
  driver:{role:'driver',active:true},
  strangerDriver:{role:'driver',active:true},
  admin:{role:'admin',active:true},
  locked:{role:'customer',active:false}
};
export function context(env, uid, claims={}) {
  return env.authenticatedContext(uid,{email_verified:true,...claims});
}
export async function baseData(env) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    const documents={
      ...Object.fromEntries(Object.entries(people).map(([uid,value])=>['users/'+uid,{...value,displayName:uid,activeOrderCount:0}])),
      'shops/shop1':{ownerUid:'merchant',active:true,name:'Demo shop',imagePath:null},
      'shops/shop2':{ownerUid:'merchant2',active:true,name:'Other demo shop'},
      'shops/hidden':{ownerUid:'merchant',active:false,name:'Hidden shop'},
      'shops/shop1/drivers/driver':{approved:true,active:true},
      'shops/shop1/drivers/strangerDriver':{approved:false,active:true},
      'categories/main':{active:true,sortOrder:1,name:'Meals'},
      'categories/hidden':{active:false,sortOrder:2,name:'Hidden'},
      'menuItems/meal':{shopId:'shop1',active:true,name:'Meal',nameKey:'meal',priceVnd:30000,imagePath:null},
      'menuItems/hidden':{shopId:'shop1',active:false,name:'Hidden',nameKey:'hidden',priceVnd:30000},
      'menuItems/hiddenShop':{shopId:'hidden',active:true,name:'Hidden shop meal',nameKey:'hidden shop meal',priceVnd:30000},
      'users/customer/addresses/a1':{addressText:'Synthetic campus address'},
      'users/customer/favorites/meal':{foodId:'meal',shopId:'shop1'},
      'users/customer/carts/active':{shopId:'shop1',items:[]},
      'users/customer/notifications/e1':{title:'Demo update',createdAt:stamp},
      'users/customer/devices/device1':{token:'synthetic-device-value'},
      'orders/delivering':{customerUid:'customer',shopId:'shop1',driverUid:'driver',assignmentStatus:'ACCEPTED',status:'DELIVERING',createdAt:stamp},
      'orders/assigned':{customerUid:'customer',shopId:'shop1',driverUid:'driver',assignmentStatus:'ASSIGNED',status:'PREPARING',createdAt:stamp},
      'orders/completed':{customerUid:'customer',shopId:'shop1',driverUid:'driver',assignmentStatus:'ACCEPTED',status:'COMPLETED',paymentStatus:'COD_CONFIRMED',reviewId:'public1',createdAt:stamp},
      'orders/other':{customerUid:'other',shopId:'shop2',driverUid:null,assignmentStatus:'UNASSIGNED',status:'PENDING',createdAt:stamp},
      'reviews/public1':{shopId:'shop1',authorAliasSnapshot:'Demo guest',rating:4,text:'Synthetic review',verifiedCompletedOrder:true,imagePaths:[],createdAt:stamp},
      'reviews/unverified':{shopId:'shop1',verifiedCompletedOrder:false},
      'operations/private':{resourceId:'private'},
      'notificationOutbox/private':{status:'PENDING'},
      'adminAudit/private':{action:'DEMO'},
      'system/adminRegistry':{activeAdminUids:['admin']},
      'vouchers/private':{reservedCount:0}
    };
    for(const orderId of ['delivering','assigned','completed']){
      documents['orders/'+orderId+'/events/e1']={type:'DEMO',createdAt:stamp};
      documents['orders/'+orderId+'/messages/m1']={senderUid:'customer',text:'Synthetic message',sentAt:stamp};
      documents['orders/'+orderId+'/deliveryTracking/current']={driverUid:'driver',latitude:10,longitude:106,receivedAt:stamp};
    }
    await Promise.all(Object.entries(documents).map(([path,data])=>setDoc(doc(db,path),data)));
  });
}
