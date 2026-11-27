import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setLogLevel, where } from 'firebase/firestore/lite';

const projectId = 'foodordernext-staging';
const appId = '1:201222548655:android:5b7a1135f131e25d7cf85a';
const packageName = 'com.foodordernext.app';
const configFile = new URL('../../apps/mobile/android/app/src/release/google-services.json', import.meta.url);
const emulatorVariables = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST'];
const report = { projectId, appId, checkedAt: new Date().toISOString(), checks: {} };

// Expected denied requests must not log URLs containing the client API key.
setLogLevel('silent');

let app;
let temporaryUser;
let step = 'androidConfig';
try {
  assert(!emulatorVariables.some(name => process.env[name]));
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  assert.equal(config.project_info.project_id, projectId);
  const client = config.client.find(item => item.client_info.mobilesdk_app_id === appId);
  assert.equal(client?.client_info.android_client_info.package_name, packageName);
  const apiKey = client.api_key[0]?.current_key;
  assert(apiKey);
  app = initializeApp({ apiKey, appId, projectId });
  report.checks[step] = 'PASS';

  step = 'apiConfiguration';
  const { values } = parseArgs({ options: { 'api-base-url': { type: 'string' } } });
  const api = values['api-base-url'] === undefined ? null : new URL(values['api-base-url']);
  if (api) {
    assert(api.protocol === 'https:' && api.pathname === '/api/v1' && !api.username && !api.password && !api.search && !api.hash);
    const meUrl = new URL('/api/v1/me', api);
    step = 'apiHealth';
    const health = await fetch(new URL('/health', api), { redirect: 'error', signal: AbortSignal.timeout(90_000) });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).data.service, 'foodordernext-api');
    report.checks[step] = 'PASS';

    step = 'apiRejectsMissingToken';
    const response = await fetch(meUrl, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
    report.checks[step] = 'PASS';
  }

  const db = getFirestore(app);
  const order = doc(db, 'orders', `staging-smoke-${randomUUID()}`);
  step = 'anonymousOrderReadDenied';
  await assert.rejects(getDoc(order), { code: 'permission-denied' });
  report.checks[step] = 'PASS';

  for (const [collectionId, sortField] of [['categories', 'sortOrder'], ['shops', 'name']]) {
    step = `${collectionId}CompoundRead`;
    const snapshot = await getDocs(query(collection(db, collectionId), where('active', '==', true), orderBy(sortField), limit(1)));
    report.checks[step] = { status: 'PASS', documentsReturned: snapshot.size };
  }

  const auth = getAuth(app);
  const email = `staging-smoke-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  step = 'emailPasswordSignup';
  temporaryUser = (await createUserWithEmailAndPassword(auth, email, password)).user;
  report.checks[step] = 'PASS';

  step = 'emailPasswordSignin';
  const signedIn = (await signInWithEmailAndPassword(auth, email, password)).user;
  assert.equal(signedIn.uid, temporaryUser.uid);
  temporaryUser = signedIn;
  report.checks[step] = 'PASS';

  step = 'orderReadDeniedWithoutProfile';
  await assert.rejects(getDoc(order), { code: 'permission-denied' });
  report.checks[step] = 'PASS';

  if (api) {
    step = 'apiVerifiesTokenAndReadsProfile';
    const response = await fetch(new URL('/api/v1/me', api), {
      headers: { Authorization: `Bearer ${await signedIn.getIdToken()}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    // A fresh Auth account has no profile until the user calls bootstrap.
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'PROFILE_NOT_FOUND');
    report.checks[step] = 'PASS';
  }
} catch (error) {
  report.failure = { step, code: error.code || 'CHECK_FAILED' };
} finally {
  if (temporaryUser) {
    try {
      await deleteUser(temporaryUser);
      report.checks.temporaryAuthAccountDeleted = 'PASS';
    } catch (error) {
      report.cleanupFailure = { code: error.code || 'DELETE_FAILED', uid: temporaryUser.uid };
    }
  }
  if (app) await deleteApp(app);
}

console.log(JSON.stringify(report, null, 2));
if (report.failure || report.cleanupFailure) process.exitCode = 1;
