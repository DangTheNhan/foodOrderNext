import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, getFirestore, setLogLevel } from 'firebase/firestore/lite';
import { createSeedPlan, validateSeedPlan } from './plan.mjs';

const root = resolve(import.meta.dirname, '../..');
const projectId = 'foodordernext-staging';
const apiBase = 'https://foodordernext-api-staging.onrender.com/api/v1';
const datasetId = 'p09-staging-demo-v1';
const shopId = `${datasetId}-shop`;
const foodId = `${datasetId}-rice`;
const work = join(root, 'work', datasetId);
const vault = join(work, 'accounts.dpapi');
const roles = { customer: 'demo-customer', merchant: 'demo-merchant-1', driver: 'demo-driver' };
const report = { projectId, apiBase, datasetId, shopId, result: 'FAIL', checkedAt: new Date().toISOString(), checks: {} };
const apps = {};
let step = 'guard';

function powershell(script, input) {
  const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference = 'Stop'; ${script}`],
    { input, encoding: 'utf8', timeout: 15_000 });
  assert(result.status === 0 && result.stdout.trim(), 'Windows credential file operation failed');
  return result.stdout.trim();
}

function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isSafeInteger(value)
    ? { integerValue: String(value) } : { doubleValue: value };
  assert.equal(typeof value, 'object');
  return { mapValue: { fields: fields(value) } };
}

function seedDocuments(accounts) {
  const { documents: source } = createSeedPlan(1);
  const { customer, merchant, driver } = accounts;
  const documents = {
    [`users/${customer.uid}/addresses/campus`]: source['users/demo-customer/addresses/campus'],
    [`users/${customer.uid}/carts/active`]: source['users/demo-customer/carts/active'],
    [`shops/${shopId}`]: { ...source['shops/shop1'], name: 'Quán Campus Demo Staging', ownerUid: merchant.uid,
      ratingSum: 0, ratingCount: 0, ratingAverage: 0, activeOrderCount: 0 },
    [`shops/${shopId}/drivers/${driver.uid}`]: { active: true, approved: true, authorityVersion: 0,
      approvedBy: `${datasetId}-fixture`, approvedAt: new Date() },
  };
  for (const [role, user] of Object.entries(accounts)) {
    documents[`users/${user.uid}`] = { ...source[`users/${roles[role]}`], activeOrderCount: 0 };
  }
  for (const category of ['meals', 'drinks']) {
    documents[`categories/${datasetId}-${category}`] = source[`categories/${category}`];
  }
  for (const food of ['rice', 'noodles', 'tea']) {
    const item = source[`menuItems/shop1-${food}`];
    documents[`menuItems/${datasetId}-${food}`] = { ...item, shopId, categoryId: `${datasetId}-${item.categoryId}`,
      availablePortions: 50, reservedPortions: 0, soldPortions: 0 };
  }
  validateSeedPlan({ documents });
  return documents;
}

async function signIn(role, accounts) {
  const { uid, email, password } = accounts[role];
  const identity = (await signInWithEmailAndPassword(getAuth(apps[role]), email, password)).user;
  assert(identity.uid === uid && identity.emailVerified, 'Unexpected Firebase test identity');
  return identity;
}

async function provisionAccounts(accounts, createMissing, identity) {
  const missing = [];
  for (const [role, account] of Object.entries(accounts)) {
    try {
      await signIn(role, accounts);
    } catch (error) {
      if (!createMissing || !['auth/invalid-credential', 'auth/user-not-found'].includes(error.code)) throw error;
      const salt = randomBytes(16);
      missing.push({ localId: account.uid, email: account.email, emailVerified: true, displayName: account.displayName,
        passwordHash: createHash('sha256').update(salt).update(account.password).digest('base64'),
        salt: salt.toString('base64'), createdAt: String(Date.now()) });
    }
  }
  if (missing.length === 0) return;
  const existing = await identity.post(`/v1/projects/${projectId}/accounts:lookup`, {
    localId: missing.map(account => account.localId), email: missing.map(account => account.email),
  }, { resolveOnHTTPError: true });
  assert.equal(existing.status, 200, `Firebase Auth existence check HTTP ${existing.status}`);
  assert(!existing.body.users?.length, 'A demo identity already exists with different credentials');
  const fixtureFile = join(work, `auth-import-${randomUUID()}.json`);
  try {
    await writeFile(fixtureFile, JSON.stringify({ users: missing }), { flag: 'wx' });
    const cli = join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
    const result = spawnSync(process.execPath, [cli, 'auth:import', fixtureFile, '--hash-algo', 'SHA256', '--rounds', '1',
      '--hash-input-order', 'SALT_FIRST', '--project', projectId, '--non-interactive'],
    { cwd: work, env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 60_000 });
    assert(result.status === 0 && result.stdout.includes('Imported successfully.'), 'Firebase Auth fixture import failed');
  } finally {
    await rm(fixtureFile, { force: true });
  }
}

function apiCaller(users) {
  return async (role, path, expectedStatus, input, key = randomUUID()) => {
    const headers = { Authorization: `Bearer ${await users[role].getIdToken()}` };
    if (input) Object.assign(headers, { 'Content-Type': 'application/json', 'Idempotency-Key': key });
    const res = await fetch(`${apiBase}${path}`, { method: input ? 'POST' : 'GET', headers,
      body: input && JSON.stringify(input), redirect: 'error', signal: AbortSignal.timeout(90_000) });
    const body = await res.json();
    assert.equal(res.status, expectedStatus, `${path}: HTTP ${res.status} ${body.error?.code ?? ''}`);
    return body;
  };
}

async function reportFixture(users, firestore, parent) {
  const reportShop = 'p08-staging-report-v1';
  const day = '2026-01-02';
  const count = 21;
  const marker = `seedManifests/${reportShop}`;
  const commitPath = `/v1/${parent}`;
  const prior = await firestore.get(`${commitPath}/${marker}`, { resolveOnHTTPError: true });
  assert([200, 404].includes(prior.status), 'Unable to inspect the staging report manifest');
  if (prior.status === 404) {
    const { documents: demo } = createSeedPlan(1);
    const name = 'P08 · Quán mẫu phân trang';
    const start = Date.parse(day + 'T08:00:00+07:00');
    const documents = { [`shops/${reportShop}`]: { ...demo['shops/shop1'], ownerUid: users.merchant.uid, name,
      active: false, acceptingOrders: false, activeOrderCount: 0, ratingSum: 0, ratingCount: 0, ratingAverage: 0 } };
    for (let index = 0; index < count; index++) {
      const createdAt = new Date(start + index * 60_000);
      const completedAt = new Date(createdAt.getTime() + 30 * 60_000);
      documents[`orders/${reportShop}-${String(index + 1).padStart(2, '0')}`] = {
        ...demo['orders/demo-completed'], shopId: reportShop, shopNameSnapshot: name,
        customerUid: `${reportShop}-customer`, driverUid: `${reportShop}-driver`,
        codConfirmedBy: `${reportShop}-driver`, reviewId: null, note: 'Dữ liệu tổng hợp cho kiểm thử phân trang P08.',
        createdAt, assignedAt: createdAt, acceptedAssignmentAt: createdAt, acceptedAt: createdAt, pickedUpAt: createdAt,
        updatedAt: completedAt, completedAt, codConfirmedAt: completedAt,
      };
    }
    validateSeedPlan({ documents });
    documents[marker] = { datasetId: reportShop, synthetic: true, shopId: reportShop, day, count, ownerUid: users.merchant.uid };
    const writes = Object.entries(documents).map(([path, value]) => ({
      update: { name: `${parent}/${path}`, fields: fields(value) }, currentDocument: { exists: false },
    }));
    const written = await firestore.post(`${commitPath}:commit`, { writes }, { resolveOnHTTPError: true });
    assert.equal(written.status, 200, `Report fixture write HTTP ${written.status}`);
  } else {
    assert.equal(prior.body.fields.ownerUid?.stringValue, users.merchant.uid);
    assert.equal(prior.body.fields.count?.integerValue, String(count));
  }

  const request = apiCaller(users);
  const path = `/shops/${reportShop}/reports/daily?day=${day}`;
  const { data: page1 } = await request('merchant', path, 200);
  assert.equal(page1.createdCount, count);
  assert.equal(page1.completedCount, count);
  assert.equal(page1.codVnd, count * 65_000);
  assert.equal(page1.rows.length, 20);
  assert(page1.cursor);
  const { data: page2 } = await request('merchant', `${path}&cursor=${encodeURIComponent(page1.cursor)}&includeTotals=false`, 200);
  assert.equal(page2.rows.length, 1);
  assert.equal(page2.cursor, null);
  assert(!('createdCount' in page2));
  assert.equal(new Set([...page1.rows, ...page2.rows].map(row => row.id)).size, count);
  report.reportFixture = { synthetic: true, shopId: reportShop, day, count, pageSizes: [20, 1],
    codConfirmedTotalVnd: page1.codVnd, created: prior.status === 404 };
  report.checks.reportFixture = 'PASS';
}

async function journey(users, resumeOrderId) {
  const call = apiCaller(users);
  const clientDoc = (role, path) => getDoc(doc(getFirestore(apps[role]), path));
  const foodPath = `menuItems/${foodId}`;
  async function completeAndReview(orderId, total, before) {
    const orderPath = `orders/${orderId}`;
    const command = (role, name, input, status = 200, key) => call(role, `/${orderPath}/${name}`, status, input, key);
    step = 'exactCodAndStock';
    const cod = { expectedStatusVersion: 5, expectedAssignmentVersion: 2, codCollectedVnd: total };
    const wrong = await command('driver', 'complete', { ...cod, codCollectedVnd: 1 }, 422);
    assert.equal(wrong.error.code, 'COD_AMOUNT_MISMATCH');
    const completeKey = randomUUID();
    await command('driver', 'complete', cod, 200, completeKey);
    assert.equal((await command('driver', 'complete', cod, 200, completeKey)).meta.idempotencyReplayed, true);
    const [stored, after] = await Promise.all([clientDoc('customer', orderPath), clientDoc('customer', foodPath)]);
    const order = stored.data();
    assert.equal(order.status, 'COMPLETED');
    assert.equal(order.paymentStatus, 'COD_CONFIRMED');
    assert.equal(order.codCollectedVnd, cod.codCollectedVnd);
    assert.equal(order.codConfirmedBy, users.driver.uid);
    const stock = after.data();
    assert.deepEqual([stock.availablePortions, stock.reservedPortions, stock.soldPortions],
      [before.availablePortions, before.reservedPortions - 1, before.soldPortions + 1]);
    report.order = { status: order.status, paymentStatus: order.paymentStatus, codCollectedVnd: order.codCollectedVnd,
      stock: { available: stock.availablePortions, reserved: stock.reservedPortions, sold: stock.soldPortions } };
    report.checks[step] = 'PASS';

    step = 'verifiedReview';
    const review = (await command('customer', 'review', { rating: 5, text: 'Kiểm thử staging: đơn giao thành công.' }, 201)).data;
    const published = (await clientDoc('customer', `reviews/${review.reviewId}`)).data();
    assert.equal(published?.verifiedCompletedOrder, true);
    assert.equal(published?.rating, 5);
    report.checks[step] = 'PASS';
  }

  step = 'roleProfiles';
  for (const role of Object.keys(roles)) {
    assert.equal((await call(role, '/me', 200)).data.role, role);
  }
  report.checks[step] = 'PASS';
  if (resumeOrderId) {
    step = 'resumeDemoOrder';
    const order = (await clientDoc('customer', `orders/${resumeOrderId}`)).data();
    assert(order?.shopId === shopId && order.customerUid === users.customer.uid && order.driverUid === users.driver.uid
      && order.status === 'DELIVERING' && order.statusVersion === 5 && order.assignmentVersion === 2 && order.amountDueVnd === 35_000
      && order.paymentStatus === 'UNPAID' && order.items.length === 1 && order.items[0].foodId === foodId && order.items[0].quantity === 1,
    'Expected a delivering order created by this staging fixture');
    report.orderId = resumeOrderId;
    report.checks[step] = 'PASS';
    await completeAndReview(resumeOrderId, order.amountDueVnd, (await clientDoc('customer', foodPath)).data());
    return;
  }
  step = 'quoteAndCreateOnlyOneOrder';
  const before = (await clientDoc('customer', foodPath)).data();
  const orderInput = { shopId, items: [{ foodId, quantity: 1, optionIds: [] }], addressId: 'campus' };
  const quote = (await call('customer', '/orders/quote', 200, orderInput)).data;
  assert.equal(quote.grandTotalVnd, 35_000);
  const purchase = { ...orderInput, paymentMethod: 'COD', expectedGrandTotalVnd: quote.grandTotalVnd, expectedQuoteKey: quote.quoteKey };
  const createKey = randomUUID();
  const { orderId } = (await call('customer', '/orders', 201, purchase, createKey)).data;
  report.orderId = orderId;
  const replay = await call('customer', '/orders', 200, purchase, createKey);
  assert(replay.data.orderId === orderId && replay.meta.idempotencyReplayed === true);
  const orderPath = `orders/${orderId}`;
  const command = (role, name, input, status = 200, key) => call(role, `/${orderPath}/${name}`, status, input, key);
  const transition = (targetStatus, expectedStatusVersion) => command('merchant', 'transitions', { targetStatus, expectedStatusVersion });
  report.checks[step] = 'PASS';

  step = 'merchantAndDriverAssignment';
  await command('customer', 'transitions', { targetStatus: 'ACCEPTED', expectedStatusVersion: 1 }, 403);
  await transition('ACCEPTED', 1);
  await command('merchant', 'assign-driver', { driverUid: users.driver.uid, expectedStatusVersion: 2, expectedAssignmentVersion: 0 });
  await command('driver', 'accept-assignment', { expectedAssignmentVersion: 1 });
  await transition('PREPARING', 2);
  await transition('READY_FOR_PICKUP', 3);
  await command('driver', 'pickup', { expectedStatusVersion: 4, expectedAssignmentVersion: 2 });
  const trackingPath = `${orderPath}/deliveryTracking/current`;
  const sequence = Date.now();
  const fix = { latitude: 10.001, longitude: 106.001, accuracyMeters: 7, sequence,
    recordedAt: new Date(sequence).toISOString(), expectedAssignmentVersion: 2 };
  await command('driver', 'location', fix);
  assert.equal((await clientDoc('customer', trackingPath)).data()?.sequence, sequence);
  report.checks[step] = 'PASS';
  const reserved = (await clientDoc('customer', foodPath)).data();
  assert.deepEqual([reserved.availablePortions, reserved.reservedPortions, reserved.soldPortions],
    [before.availablePortions - 1, before.reservedPortions + 1, before.soldPortions]);
  await completeAndReview(orderId, quote.grandTotalVnd, reserved);
}

try {
  const [mode, target, resumeOrderId, extra] = process.argv.slice(2);
  const modes = ['--seed-only', '--journey', '--realtime', '--report-fixture', '--push-device'];
  assert(modes.includes(mode) && target === projectId && !extra
    && (!resumeOrderId || (mode === '--journey' && /^[A-Za-z0-9]{20}$/.test(resumeOrderId))),
  'Use a staging check mode followed by foodordernext-staging and optional journey order ID');
  assert(!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIRESTORE_URL);
  const config = JSON.parse(await readFile(join(root, 'apps/mobile/android/app/src/release/google-services.json'), 'utf8'));
  assert.equal(config.project_info.project_id, projectId);
  const android = config.client.find(client => client.client_info.android_client_info.package_name === 'com.foodordernext.app');
  assert.equal(android.client_info.mobilesdk_app_id, '1:201222548655:android:5b7a1135f131e25d7cf85a');
  report.checks[step] = 'PASS';

  step = 'firestoreAccess';
  const require = createRequire(import.meta.url);
  const { getProjectDefaultAccount } = require('firebase-tools/lib/auth.js');
  const { requireAuth } = require('firebase-tools/lib/requireAuth.js');
  const { Client } = require('firebase-tools/lib/apiv2.js');
  const account = getProjectDefaultAccount(root);
  assert(account, 'Firebase CLI login is required');
  await requireAuth({ ...account, project: projectId, nonInteractive: true });
  const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com' });
  const parent = `projects/${projectId}/databases/(default)/documents`;
  const manifestPath = `seedManifests/${datasetId}`;
  const manifest = await firestore.get(`/v1/${parent}/${manifestPath}`, { resolveOnHTTPError: true });
  assert([200, 404].includes(manifest.status), `Firestore read HTTP ${manifest.status}`);
  if (['--realtime', '--report-fixture', '--push-device'].includes(mode)) {
    assert.equal(manifest.status, 200, 'Run --seed-only before this staging check');
  }
  report.checks[step] = 'PASS';

  step = 'localDemoCredentials';
  await mkdir(work, { recursive: true });
  const ciphertext = await readFile(vault, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  let accounts;
  if (ciphertext) {
    accounts = JSON.parse(powershell('$value = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()); (New-Object System.Net.NetworkCredential("demo", $value)).Password', ciphertext));
  } else {
    assert.equal(manifest.status, 404, 'Existing demo needs the original Windows account credential file');
    accounts = Object.fromEntries(Object.keys(roles).map(role => {
      const uid = `${datasetId}-${role}-${randomBytes(8).toString('hex')}`;
      return [role, { uid, email: `${uid}@example.invalid`, password: `Z8a${randomBytes(18).toString('hex')}`, displayName: `Staging Demo ${role}` }];
    }));
    const encrypted = powershell('ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force | ConvertFrom-SecureString', JSON.stringify(accounts));
    await writeFile(vault, encrypted, { flag: 'wx' });
  }
  assert.deepEqual(Object.keys(accounts).sort(), Object.keys(roles).sort());
  for (const [role, { uid, email, password }] of Object.entries(accounts)) {
    assert(new RegExp(`^${datasetId}-${role}-[0-9a-f]{16}$`).test(uid)
      && email === `${uid}@example.invalid` && /^Z8a[0-9a-f]{36}$/.test(password), 'Unexpected local demo identity');
  }
  const uids = Object.fromEntries(Object.entries(accounts).map(([role, value]) => [role, value.uid]));
  if (manifest.status === 200) {
    assert.deepEqual(manifest.body.fields.accountUids, firestoreValue(uids));
    assert.equal(manifest.body.fields.shopId?.stringValue, shopId);
  }
  report.checks[step] = 'PASS';

  step = 'authAndFirestoreSeed';
  setLogLevel('silent');
  for (const role of Object.keys(roles)) {
    apps[role] = initializeApp({ apiKey: android.api_key[0].current_key, projectId, appId: android.client_info.mobilesdk_app_id }, role);
  }
  await provisionAccounts(accounts, manifest.status === 404, new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com' }));
  const users = Object.fromEntries(await Promise.all(Object.keys(roles).map(async role => [role, await signIn(role, accounts)])));
  if (manifest.status === 404) {
    const documents = seedDocuments(accounts);
    documents[manifestPath] = { datasetId, synthetic: true, accountUids: uids, shopId,
      documentCount: Object.keys(documents).length, createdAt: new Date() };
    const writes = Object.entries(documents).map(([path, value]) => ({
      update: { name: `${parent}/${path}`, fields: fields(value) }, currentDocument: { exists: false },
    }));
    const result = await firestore.post(`/v1/${parent}:commit`, { writes }, { resolveOnHTTPError: true });
    assert.equal(result.status, 200, `Firestore seed HTTP ${result.status} ${result.body.error?.status ?? ''}`);
  }
  report.seed = { created: manifest.status === 404, accounts: 3, categories: 2, dishes: 3, shops: 1 };
  report.checks[step] = 'PASS';
  if (mode === '--journey') await journey(users, resumeOrderId);
  if (mode === '--realtime') {
    step = 'realtime';
    const { runStagingRealtime } = await import('./staging-realtime.mjs');
    await runStagingRealtime({ apps, users, call: apiCaller(users), shopId, foodId, admin: firestore, parent, report });
  }
  if (mode === '--report-fixture') {
    step = 'reportFixture';
    await reportFixture(users, firestore, parent);
  }
  if (mode === '--push-device') {
    step = 'pushDevice';
    const { verifyStagingPushDevice } = await import('./staging-push-device.mjs');
    await verifyStagingPushDevice({ root, accounts, users, call: apiCaller(users), apiBase, admin: firestore, parent, report });
  }
  report.result = 'PASS';
} catch (error) {
  report.failure = { step, code: error.code || 'CHECK_FAILED' };
  const message = error.message?.split('\n')[0];
  if (error.code === 'ERR_ASSERTION' && message) report.failure.detail = message;
  process.exitCode = 1;
} finally {
  await Promise.all(Object.values(apps).map(deleteApp));
  const proofNames = { '--seed-only': 'staging-demo-seed.json', '--realtime': 'staging-realtime.json',
    '--report-fixture': 'staging-report-fixture.json', '--push-device': 'staging-push-device.json',
    '--journey': process.argv[4] ? 'staging-cod-resumed.json' : 'staging-cod-journey.json' };
  const proofPhases = { '--realtime': 'P05', '--report-fixture': 'P08', '--push-device': 'P05' };
  const proof = join(root, 'artifacts/evidence', proofPhases[process.argv[2]] ?? 'P09',
    proofNames[process.argv[2]] ?? 'staging-demo-seed.json');
  if (report.result === 'PASS') await writeFile(proof, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
