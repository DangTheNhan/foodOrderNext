import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as sdk from 'firebase/firestore';
import { menuPageQuery } from '../../apps/mobile/src/services/customerQueries.js';
import { orderFeed } from '../../apps/mobile/src/services/realtimeQueries.js';
import { AdminOperations } from '../../services/api/src/adminOperations.js';
import { createApp } from '../../services/api/src/app.js';
import { CatalogOperations } from '../../services/api/src/catalogOperations.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';
import { createBenchmarkFixture, datasetVersion, reportDay, reportShop } from './fixture.mjs';

const iterations = 20;
const warmups = 3;
const pageSize = 20;
const batchSize = 200;

async function seed(db, auth, fixture, password) {
  assert.deepEqual(await db.listCollections(), [], 'Benchmark requires a fresh Emulator session.');
  assert.equal((await auth.listUsers(1)).users.length, 0, 'Benchmark requires empty Auth.');
  for (const { uid, email } of fixture.accounts.filter(user => ['demo-customer', 'demo-merchant-1'].includes(user.uid))) {
    await auth.createUser({ uid, email, password, emailVerified: true });
  }
  const entries = Object.entries(fixture.documents);
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = db.batch();
    for (const [path, data] of entries.slice(offset, offset + batchSize)) batch.create(db.doc(path), data);
    await batch.commit();
    if (offset % 2000 === 0) console.info('Benchmark documents written:', Math.min(offset + batchSize, entries.length));
  }
  const orders = await db.collection('orders').count().get();
  assert.equal(orders.data().count, fixture.counts.orders);
}

async function client(config, apps, uid, email, password) {
  const app = initializeApp({ apiKey: 'local-benchmark-only', projectId: config.projectId }, uid);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://' + config.authEmulatorHost, { disableWarnings: true });
  const db = sdk.getFirestore(app);
  sdk.connectFirestoreEmulator(db, '127.0.0.1', Number(config.firestoreEmulatorHost.split(':').at(-1)));
  const credentials = await signInWithEmailAndPassword(auth, email, password);
  assert.equal(credentials.user.uid, uid);
  return { db, getToken: () => credentials.user.getIdToken() };
}

async function measure(action) {
  const durations = [];
  let result;
  for (let sample = 0; sample <= warmups + iterations; sample += 1) {
    const start = performance.now();
    result = await action(sample);
    const elapsed = performance.now() - start;
    if (sample === 0 || sample > warmups) durations.push(elapsed);
  }
  const firstMs = durations.shift();
  const sorted = [...durations].sort((a, b) => a - b);
  const rounded = value => Number(value.toFixed(2));
  const percentile = fraction => rounded(sorted[Math.ceil(sorted.length * fraction) - 1]);
  return { firstMs: rounded(firstMs), warmMs: durations.map(rounded), p50Ms: percentile(0.5),
    p95Ms: percentile(0.95), ...result };
}

async function measurePages(build) {
  return measure(async () => {
    const first = await sdk.getDocsFromServer(build());
    const second = await sdk.getDocsFromServer(build(first.docs.at(-1)));
    assert.equal(first.size, pageSize);
    assert.equal(second.size, pageSize);
    assert.equal(new Set([...first.docs, ...second.docs].map(doc => doc.id)).size, 2 * pageSize);
    return { returnedDocuments: first.size + second.size };
  });
}

function snapshotWhen(query, accept, act = () => {}) {
  let unsubscribe, timer;
  const observed = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Realtime benchmark snapshot timed out.')), 10000);
    unsubscribe = sdk.onSnapshot(query, { includeMetadataChanges: true }, snapshot => {
      if (!snapshot.metadata.fromCache && accept(snapshot)) resolve(snapshot);
    }, reject);
  });
  return Promise.all([observed, Promise.resolve().then(act)]).then(([snapshot]) => snapshot).finally(() => {
    clearTimeout(timer);
    unsubscribe?.();
  });
}

async function run() {
  const runName = process.env.P08_BENCHMARK_RUN || 'current';
  assert.match(runName, /^(baseline|after|current)$/);
  assert.equal(process.env.RUN_LOCAL_BENCHMARK, '1', 'Run npm run benchmark:local.');
  const project = 'demo-foodordernext-p08';
  assert.equal(process.env.FIREBASE_PROJECT_ID, project);
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.match(process.env[key] ?? '', /^127\.0\.0\.1:[1-9]\d{0,4}$/);
  }
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.equal(config.projectId, project);
  const fixture = createBenchmarkFixture();
  const password = randomUUID();
  const services = createFirebaseServices(config);
  const clients = [];
  let server;
  try {
    const seedStarted = performance.now();
    await seed(services.firestore, services.auth, fixture, password);
    const seedMs = Math.round(performance.now() - seedStarted);
    const customer = await client(config, clients, 'demo-customer', 'customer@example.invalid', password);
    const merchant = await client(config, clients, 'demo-merchant-1', 'merchant1@example.invalid', password);
    const app = createApp({ ...services, userRepository: new FirestoreUserRepository(services.firestore),
      operations: { catalog: new CatalogOperations(services.firestore, services.publishMenuImage, services.readMenuImage),
        adminUsers: new AdminOperations(services.firestore) } });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const reportUrl = `http://127.0.0.1:${server.address().port}/api/v1/shops/${reportShop}/reports/daily?day=${reportDay}`;
    const merchantToken = await merchant.getToken();
    async function report(url) {
      const response = await fetch(url, { headers: { Authorization: 'Bearer ' + merchantToken }, signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, 'Daily report must return HTTP 200.');
      const { data } = await response.json();
      return data;
    }
    const metrics = {};
    metrics.catalogTwoPages = await measurePages(cursor =>
      menuPageQuery(sdk, customer.db, reportShop, { mode: 'price' }, cursor, pageSize));
    metrics.customerHistoryTwoPages = await measurePages(cursor =>
      orderFeed(sdk, customer.db, { role: 'customer', uid: 'demo-customer' }, pageSize, cursor));
    metrics.merchantQueueTwoPages = await measurePages(cursor =>
      orderFeed(sdk, merchant.db, { role: 'merchant', shopId: reportShop, status: 'PENDING' }, pageSize, cursor));
    metrics.publicReviewsTwoPages = await measurePages(cursor => sdk.query(sdk.collection(customer.db, 'reviews'),
      sdk.where('shopId', '==', reportShop), sdk.where('verifiedCompletedOrder', '==', true),
      sdk.orderBy('createdAt', 'desc'), sdk.orderBy(sdk.documentId(), 'desc'),
      ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(pageSize)));
    metrics.dailyReport = await measure(async () => {
      const result = await report(reportUrl);
      for (const [key, value] of Object.entries(fixture.totals)) assert.equal(result[key], value, key);
      assert.equal(result.rows.length, pageSize);
      return { returnedRows: result.rows.length };
    });
    const firstReport = await report(reportUrl);
    assert.ok(firstReport.cursor);
    const nextReportUrl = reportUrl + '&cursor=' + encodeURIComponent(firstReport.cursor);
    const measureNext = async includeTotals => measure(async () => {
      const result = await report(nextReportUrl + (includeTotals ? '' : '&includeTotals=false'));
      assert.equal(result.rows.length, pageSize);
      assert.equal(new Set([...firstReport.rows, ...result.rows].map(row => row.id)).size, 2 * pageSize);
      for (const [key, value] of Object.entries(fixture.totals)) {
        assert.equal(result[key], includeTotals ? value : undefined, key);
      }
      return { returnedRows: result.rows.length };
    });
    metrics.dailyReportNext = await measureNext(true);
    if (runName !== 'baseline') metrics.dailyReportNextRowsOnly = await measureNext(false);
    const path = 'orders/demo-pending';
    const order = sdk.doc(customer.db, path);
    metrics.orderWriteAndListen = await measure(async sample => {
      const note = 'P08 listener test ' + sample;
      await snapshotWhen(order, snapshot => snapshot.exists() && snapshot.get('note') === note,
        () => services.firestore.doc(path).update({ note }));
      return { confirmedSnapshots: 1 };
    });
    const sourcePaths = ['scripts/performance/fixture.mjs', 'apps/mobile/src/services/customerQueries.js',
      'apps/mobile/src/services/realtimeQueries.js', 'services/api/src/adminOperations.js',
      'services/api/src/operationsRoutes.js', 'firebase/firestore.rules', 'firebase/firestore.indexes.json'];
    const sourceSha256 = Object.fromEntries(await Promise.all(sourcePaths.map(async path =>
      [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
    const result = { runName, recordedAt: new Date().toISOString(), project, datasetVersion, totalDocuments: Object.keys(fixture.documents).length,
      counts: fixture.counts, reportShop, reportDay, expectedReportTotals: fixture.totals, seedMs,
      environment: { node: process.version, platform: platform(), osRelease: release(), cpu: cpus()[0].model,
        logicalCores: cpus().length, memoryBytes: totalmem(), network: 'loopback', firebaseTools: '15.34.2' },
      methodology: { warmups, iterations, pageSize, firstMs: 'first observed call, not a clean process per metric',
        query: 'Node Firebase client server reads, 2 pages, counts are documents returned, not billable reads',
        api: 'local HTTP with verified Emulator Auth, parse and assert response',
        realtime: 'subscribe and Admin update until a server snapshot receives the synthetic note' },
      metrics, sourceSha256 };
    const output = runName === 'current' ? 'work/p08-benchmark.json' : 'artifacts/evidence/P08/benchmark-' + runName + '.json';
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(result, null, 2) + '\n');
    console.info(JSON.stringify({ output, counts: fixture.counts, timings: Object.fromEntries(Object.entries(metrics).map(
      ([name, { p50Ms, p95Ms }]) => [name, { p50Ms, p95Ms }])) }, null, 2));
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await Promise.all(clients.map(app => deleteApp(app)));
    await services.close();
  }
}

await run();
