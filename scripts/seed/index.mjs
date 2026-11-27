import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createSeedPlan,validateSeedPlan,DATASET_ID,PROJECT_ID} from './plan.mjs';
import {assertLocalEmulators} from './emulator-guard.mjs';

function normalize(value){
  if(value instanceof Date)return value.toISOString();
  if(value&&typeof value.toDate==='function')return value.toDate().toISOString();
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
  return value;
}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
export async function seed(args=process.argv.slice(2),env=process.env){
  assertLocalEmulators(env);
  const allowed=/^(--apply|--dry-run|--reset|--shops=[1-3]|--confirm-reset=demo-foodordernext\/foodordernext-seed-v1)$/;
  if(args.some(a=>!allowed.test(a)))throw new Error('Unsupported seed argument');
  if(args.includes('--apply')&&args.includes('--dry-run'))throw new Error('Choose --apply or --dry-run');
  const shopArg=args.find(a=>a.startsWith('--shops='));
  const plan=createSeedPlan(shopArg?Number(shopArg.split('=')[1]):3);
  validateSeedPlan(plan);
  const summary={projectId:PROJECT_ID,datasetId:DATASET_ID,mode:args.includes('--apply')?'APPLY':'DRY_RUN',
    fake:true,accounts:plan.accounts.map(({uid,role,active})=>({uid,role,active})),documentCount:Object.keys(plan.documents).length};
  if(!args.includes('--apply')){
    if(args.includes('--reset'))throw new Error('Reset requires explicit --apply and confirmation');
    console.log(JSON.stringify(summary,null,2));return summary;
  }
  const password=env.SEED_DEMO_PASSWORD;
  if(typeof password!=='string'||password.length<12)throw new Error('SEED_DEMO_PASSWORD must be supplied locally (at least 12 characters)');
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const {getFirestore}=await import('firebase-admin/firestore');
  const app=initializeApp({projectId:PROJECT_ID},'seed-'+Date.now());
  try{
    const db=getFirestore(app),auth=getAuth(app),manifestRef=db.doc('seedManifests/'+DATASET_ID);
    let manifest=await manifestRef.get();
    const paths=Object.keys(plan.documents).sort();
    if(manifest.exists){
      const record=manifest.data();
      if(record.datasetId!==DATASET_ID||record.fake!==true||JSON.stringify(record.ownedPaths)!==JSON.stringify(paths))
        throw new Error('Seed manifest/shops differ. Refusing to replace existing authority or counters.');
      const docs=await db.getAll(...paths.map(p=>db.doc(p)));
      if(docs.some(s=>!s.exists))throw new Error('Dataset has missing documents; refusing partial overwrite');
      if(!args.includes('--reset')){
        // Reruns preserve current roles, active flags, counters and user edits.
        const result={...summary,result:'PRESERVED_EXISTING_DATASET',created:0};console.log(JSON.stringify(result,null,2));return result;
      }
      if(!args.includes('--confirm-reset='+PROJECT_ID+'/'+DATASET_ID))throw new Error('Reset requires exact --confirm-reset='+PROJECT_ID+'/'+DATASET_ID);
      if(docs.some(s=>fingerprint(s.data())!==record.documentFingerprints[s.ref.path]))
        throw new Error('Dataset changed after seed; safe reset refused. Stop emulators and discard only the local emulator data to start clean.');
      const known=new Set(paths);
      for(const name of ['users','shops','menuItems','orders','reviews']){
        const existing=await db.collection(name).get();
        if(existing.docs.some(s=>!known.has(s.ref.path)))throw new Error('Extra '+name+' records present; refusing seed reset');
      }
      const batch=db.batch();for(const path of paths)batch.delete(db.doc(path));batch.delete(manifestRef);await batch.commit();
      for(const account of plan.accounts){
        try{await auth.deleteUser(account.uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
      }
      manifest=await manifestRef.get();
    }else if(args.includes('--reset')){
      if(!args.includes('--confirm-reset='+PROJECT_ID+'/'+DATASET_ID))throw new Error('Reset confirmation missing');
      throw new Error('No owned manifest; refusing reset');
    }
    const existing=await db.getAll(...paths.map(p=>db.doc(p)));
    if(existing.some(s=>s.exists))throw new Error('Existing documents without matching manifest; refusing authority overwrite');
    for(const person of plan.accounts){
      try{
        const old=await auth.getUser(person.uid);
        if(old.email!==person.email)throw new Error('UID collision for '+person.uid);
        // Existing Auth identity is not silently re-enabled or given a new password.
      }catch(error){
        if(error.code!=='auth/user-not-found')throw error;
        await auth.createUser({uid:person.uid,email:person.email,displayName:person.displayName,password,emailVerified:true,disabled:!person.active});
      }
    }
    const batch=db.batch();
    for(const [path,data]of Object.entries(plan.documents))batch.create(db.doc(path),data);
    batch.create(manifestRef,{datasetId:DATASET_ID,seedVersion:plan.seedVersion,fake:true,ownedPaths:paths,
      authUids:plan.accounts.map(a=>a.uid),documentFingerprints:Object.fromEntries(paths.map(p=>[p,fingerprint(plan.documents[p])])),createdAt:new Date()});
    await batch.commit();
    const result={...summary,result:'CREATED',created:paths.length};console.log(JSON.stringify(result,null,2));return result;
  }finally{await deleteApp(app);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  seed().catch(error=>{console.error('Seed failed: '+error.message);process.exitCode=1;});
}
