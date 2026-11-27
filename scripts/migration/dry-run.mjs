import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createSeedPlan,validateSeedPlan} from '../seed/plan.mjs';
const states=new Set(['PENDING','ACCEPTED','PREPARING','READY_FOR_PICKUP','DELIVERING','COMPLETED','CANCELLED','REJECTED']);
const fields={users:['legacyId','targetUid'],menuItems:['legacyId','shopId','priceVnd','currency'],orders:['legacyId','customerLegacyId','shopId','status','grandTotalVnd']};
export function inspectMapping(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected sanitized mapping object');
  if(Object.keys(input).some(k=>!Object.hasOwn(fields,k)))throw new Error('Only users/menuItems/orders mapping sections are supported');
  const issues=[],counts={},uidMapping=[],targetUids=new Set();
  for(const [section,allowlist]of Object.entries(fields)){
    const rows=input[section]||[];
    if(!Array.isArray(rows))throw new Error(section+' must be an array');
    counts[section]=rows.length;const seen=new Set();
    for(let i=0;i<rows.length;i++){
      const row=rows[i];
      if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid mapping row');
      if(Object.keys(row).some(k=>!allowlist.includes(k)))throw new Error('Unexpected fields in '+section+'; remove personal/credential/unknown fields before inspection');
      if(typeof row.legacyId!=='string'||!row.legacyId||seen.has(row.legacyId))issues.push({section,index:i,code:'INVALID_OR_DUPLICATE_LEGACY_ID'});
      seen.add(row.legacyId);
      if(section==='users'){
        if(typeof row.targetUid!=='string'||!row.targetUid)issues.push({section,index:i,code:'MISSING_EXPLICIT_FIREBASE_UID'});
        else {
          if(targetUids.has(row.targetUid))issues.push({section,index:i,code:'DUPLICATE_TARGET_UID'});
          targetUids.add(row.targetUid);uidMapping.push({legacyId:row.legacyId,targetUid:row.targetUid});
        }
      }
      if(section==='menuItems'&&(!Number.isSafeInteger(row.priceVnd)||row.priceVnd<0||row.currency!=='VND'))
        issues.push({section,index:i,code:'INVALID_VND_PRICE_NO_AUTO_CONVERSION'});
      if(section==='orders'){
        if(!states.has(row.status))issues.push({section,index:i,code:'UNMAPPED_LEGACY_STATUS'});
        if(!Number.isSafeInteger(row.grandTotalVnd)||row.grandTotalVnd<0)issues.push({section,index:i,code:'INVALID_TOTAL'});
        if(!(input.users||[]).some(u=>u.legacyId===row.customerLegacyId))issues.push({section,index:i,code:'ORPHAN_CUSTOMER_MAPPING'});
      }
    }
  }
  return {mode:'DRY_RUN_ONLY',writes:0,counts,uidMapping,issues,readyForImport:false,
    note:'Diagnostic mapping only. No importer, Auth creation, stock reservation or verified review migration is implemented.'};
}
export async function main(args=process.argv.slice(2)){
  if(args.length===0){
    const plan=createSeedPlan();validateSeedPlan(plan);
    console.log(JSON.stringify({mode:'SYNTHETIC_SEED_DEFAULT',writes:0,legacyImport:false,accountCount:plan.accounts.length,documentCount:Object.keys(plan.documents).length},null,2));
    return;
  }
  if(args.length!==1||!args[0].startsWith('--input='))throw new Error('Usage: node scripts/migration/dry-run.mjs [--input=SANITIZED_MAPPING.json]');
  const path=args[0].slice('--input='.length);
  if((await stat(path)).size>1024*1024)throw new Error('Mapping input exceeds 1 MiB');
  const result=inspectMapping(JSON.parse(await readFile(path,'utf8')));
  console.log(JSON.stringify(result,null,2));
  if(result.issues.length)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error('Migration dry-run failed: '+error.message);process.exitCode=1;});
