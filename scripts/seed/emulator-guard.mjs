import {PROJECT_ID} from './plan.mjs';
const endpoints={FIREBASE_AUTH_EMULATOR_HOST:9099,FIRESTORE_EMULATOR_HOST:8080,FIREBASE_STORAGE_EMULATOR_HOST:9199};
export function assertLocalEmulators(env=process.env){
  const projectId=PROJECT_ID;
  for(const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','FIREBASE_PROJECT_ID'])
    if(env[key]&&env[key]!==PROJECT_ID)throw new Error('Seed only supports '+PROJECT_ID+'; conflicting '+key);
  for(const [key,port]of Object.entries(endpoints)){
    const value=env[key];
    if(!value||!['127.0.0.1:'+port,'localhost:'+port].includes(value))
      throw new Error(key+' must explicitly point to local emulator port '+port+'; cloud seeding is disabled');
  }
  if(env.GOOGLE_APPLICATION_CREDENTIALS)throw new Error('Unset GOOGLE_APPLICATION_CREDENTIALS for emulator seed');
  return projectId;
}
