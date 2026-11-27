import {userDocumentSchema,shopDocumentSchema,menuItemDocumentSchema,orderDocumentSchema} from '@foodordernext/contracts';

export const PROJECT_ID='demo-foodordernext';
export const DATASET_ID='foodordernext-seed-v1';
export const SEED_VERSION=1;
const date=new Date('2026-01-01T03:00:00.000Z');
const clone=()=>new Date(date);
export function createSeedPlan(shopCount=3){
  if(!Number.isInteger(shopCount)||shopCount<1||shopCount>3) throw new Error('shops must be an integer from 1 to 3');
  const accounts=[
    {uid:'demo-customer',email:'customer@example.invalid',displayName:'Khách demo A',role:'customer',active:true},
    {uid:'demo-customer-2',email:'customer2@example.invalid',displayName:'Khách demo B',role:'customer',active:true},
    {uid:'demo-driver',email:'driver@example.invalid',displayName:'Shipper demo',role:'driver',active:true},
    {uid:'demo-admin',email:'admin@example.invalid',displayName:'Admin demo',role:'admin',active:true},
    {uid:'demo-locked',email:'locked@example.invalid',displayName:'Tài khoản khóa demo',role:'customer',active:false},
    ...Array.from({length:shopCount},(_,i)=>({uid:'demo-merchant-'+(i+1),email:'merchant'+(i+1)+'@example.invalid',displayName:'Quán demo '+(i+1),role:'merchant',active:true}))
  ];
  const documents={};
  for(const person of accounts){
    documents['users/'+person.uid]={displayName:person.displayName,role:person.role,active:person.active,activeOrderCount:0,
      phone:null,avatarPath:null,defaultAddressId:null,settings:{notificationsEnabled:false},createdAt:clone(),updatedAt:clone()};
  }
  for(const uid of ['demo-customer','demo-customer-2']){
    documents['users/'+uid+'/addresses/campus']={label:'Khuôn viên demo',receiverName:'Người nhận demo',phone:'0000000000',
      addressText:'Địa chỉ tổng hợp trong khuôn viên thử nghiệm',location:null,locationSource:'MANUAL',createdAt:clone(),updatedAt:clone()};
    documents['users/'+uid].defaultAddressId='campus';
    documents['users/'+uid+'/carts/active']={shopId:null,items:[],version:1,updatedAt:clone()};
  }
  documents['categories/meals']={name:'Cơm và món chính',nameKey:'com va mon chinh',sortOrder:1,active:true};
  documents['categories/drinks']={name:'Đồ uống',nameKey:'do uong',sortOrder:2,active:true};
  for(let i=1;i<=shopCount;i++){
    const shopId='shop'+i;
    documents['shops/'+shopId]={ownerUid:'demo-merchant-'+i,name:'Quán campus demo '+i,addressText:'Điểm bán tổng hợp '+i,
      location:null,active:true,acceptingOrders:true,activeOrderCount:0,openingHours:{label:'Demo 08:00–18:00'},
      deliveryFeeVnd:5000,imagePath:null,ratingSum:0,ratingCount:0,ratingAverage:0,createdAt:clone(),updatedAt:clone()};
    documents['shops/'+shopId+'/drivers/demo-driver']={approved:true,active:true,approvedBy:'demo-admin',approvedAt:clone()};
    const menu=[['rice','Cơm gà demo','com ga demo',30000,'meals'],['noodles','Mì rau demo','mi rau demo',40000,'meals'],['tea','Trà demo','tra demo',10000,'drinks']];
    for(const [key,name,nameKey,priceVnd,categoryId] of menu){
      documents['menuItems/'+shopId+'-'+key]={shopId,categoryId,name,nameKey,description:'Thực đơn tổng hợp dùng phát triển; không phải dữ liệu bán thật.',
        priceVnd,currency:'VND',active:true,availablePortions:50,reservedPortions:0,soldPortions:0,imagePath:null,
        optionGroups:[],tags:[],revision:1,createdAt:clone(),updatedAt:clone()};
    }
  }
  const addressSnapshot={receiverName:'Người nhận demo',phone:'0000000000',addressText:'Địa chỉ giao tổng hợp',location:null};
  function order(id,shopId,customerUid,foodKey,quantity,status,driverUid=null){
    const foodId=shopId+'-'+foodKey,food=documents['menuItems/'+foodId],subtotalVnd=food.priceVnd*quantity;
    const completed=status==='COMPLETED',shop=documents['shops/'+shopId];
    const record={customerUid,shopId,shopNameSnapshot:shop.name,driverUid,activeParticipantUids:completed?[]:[customerUid,shop.ownerUid,...(driverUid?[driverUid]:[])],
      status,statusVersion:completed?6:status==='DELIVERING'?5:1,assignmentStatus:driverUid?'ACCEPTED':'UNASSIGNED',assignmentVersion:driverUid?2:0,
      assignedAt:driverUid?clone():null,acceptedAssignmentAt:driverUid?clone():null,
      items:[{lineId:foodId+'-plain',foodId,nameSnapshot:food.name,unitPriceVnd:food.priceVnd,quantity,optionsSnapshot:[],lineTotalVnd:subtotalVnd,imagePathSnapshot:null}],
      currency:'VND',subtotalVnd,discountVnd:0,deliveryFeeVnd:5000,grandTotalVnd:subtotalVnd+5000,amountDueVnd:subtotalVnd+5000,
      stockReservation:completed?'CONSUMED':'RESERVED',voucherId:null,voucherReservation:'NONE',reservationReleasedAt:null,
      addressSnapshot,note:'Fixture tổng hợp, không phải giao dịch thật.',paymentMethod:'COD',paymentStatus:completed?'COD_CONFIRMED':'UNPAID',
      codCollectedVnd:completed?subtotalVnd+5000:null,codConfirmedBy:completed?driverUid:null,codConfirmedAt:completed?clone():null,
      reviewId:completed?'demo-review-completed':null,createdAt:clone(),updatedAt:clone(),
      acceptedAt:status==='PENDING'?null:clone(),pickedUpAt:driverUid?clone():null,completedAt:completed?clone():null,cancelledAt:null,rejectedAt:null};
    documents['orders/'+id]=record;
    documents['orders/'+id+'/events/fixture']={type:'SYNTHETIC_FIXTURE',toStatus:status,statusVersion:record.statusVersion,assignmentVersion:record.assignmentVersion,
      actorUid:'demo-admin',actorRole:'admin',note:'Synthetic seed fixture, not an executed lifecycle',createdAt:clone()};
    food.availablePortions-=quantity;
    if(completed)food.soldPortions+=quantity;
    else{
      food.reservedPortions+=quantity;shop.activeOrderCount++;
      for(const uid of record.activeParticipantUids)documents['users/'+uid].activeOrderCount++;
    }
  }
  order('demo-completed','shop1','demo-customer','rice',2,'COMPLETED','demo-driver');
  order('demo-pending','shop1','demo-customer','noodles',1,'PENDING');
  order('demo-delivering',shopCount>1?'shop2':'shop1','demo-customer-2','rice',1,'DELIVERING','demo-driver');
  documents['reviews/demo-review-completed']={shopId:'shop1',authorAliasSnapshot:'Khách demo A',rating:4,
    text:'Phản hồi tổng hợp: món dễ dùng, mong rút ngắn thời gian chuẩn bị.',imagePaths:[],verifiedCompletedOrder:true,createdAt:clone()};
  Object.assign(documents['shops/shop1'],{ratingSum:4,ratingCount:1,ratingAverage:4});
  documents['vouchers/demo-welcome']={codeKey:'DEMO10K',shopId:'shop1',active:true,startsAt:new Date('2025-01-01T00:00:00Z'),endsAt:new Date('2030-01-01T00:00:00Z'),
    minSubtotalVnd:30000,discountType:'FIXED',fixedDiscountVnd:10000,percentBps:null,maxDiscountVnd:10000,maxUses:20,perUserLimit:1,
    reservedCount:0,redeemedCount:0,createdAt:clone(),updatedAt:clone()};
  documents['voucherCodes/DEMO10K']={voucherId:'demo-welcome',shopId:'shop1'};
  documents['vouchers/demo-welcome/userCounters/demo-customer']={reservedCount:0,redeemedCount:0,updatedAt:clone()};
  documents['system/adminRegistry']={activeAdminUids:['demo-admin'],activeAdminCount:1,updatedAt:clone()};
  return {projectId:PROJECT_ID,datasetId:DATASET_ID,seedVersion:SEED_VERSION,fake:true,accounts,documents};
}
export function validateSeedPlan(plan){
  const d=plan.documents;
  for(const [path,item]of Object.entries(d)){
    const schema=/^users\/[^/]+$/.test(path)?userDocumentSchema:
      /^shops\/[^/]+$/.test(path)?shopDocumentSchema:
      /^menuItems\/[^/]+$/.test(path)?menuItemDocumentSchema:
      /^orders\/[^/]+$/.test(path)?orderDocumentSchema:null;
    if(schema&&!schema.safeParse(item).success)throw new Error('Seed does not satisfy shared data contract at '+path);
    if(path.startsWith('menuItems/')){
      for(const field of ['priceVnd','availablePortions','reservedPortions','soldPortions'])
        if(!Number.isSafeInteger(item[field])||item[field]<0)throw new Error('Invalid money/stock at '+path);
    }
    if(path.startsWith('reviews/')){
      for(const key of ['customerUid','orderId','phone','email','address','addressSnapshot','paymentStatus','location'])
        if(key in item)throw new Error('Private field in public review: '+key);
    }
  }
  const expected={};
  for(const [path,item]of Object.entries(d)){
    if(!/^orders\/[^/]+$/.test(path))continue;
    if(item.items.length>20||item.currency!=='VND')throw new Error('Invalid order fixture');
    if(item.status==='COMPLETED'&&(item.paymentStatus!=='COD_CONFIRMED'||item.codCollectedVnd!==item.amountDueVnd))throw new Error('COD fixture inconsistent');
    if(!['COMPLETED','CANCELLED','REJECTED'].includes(item.status)){
      for(const uid of item.activeParticipantUids)expected['users/'+uid]=(expected['users/'+uid]||0)+1;
      expected['shops/'+item.shopId]=(expected['shops/'+item.shopId]||0)+1;
    }
  }
  for(const [path,item]of Object.entries(d))
    if(/^users\/[^/]+$/.test(path)||/^shops\/[^/]+$/.test(path))
      if(item.activeOrderCount!==(expected[path]||0))throw new Error('Counter mismatch at '+path);
  return true;
}
