import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../services/api/src/app.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';

const enabled = process.env.RUN_EMULATOR_TESTS === '1';

test('real Firebase Auth + Firestore P01 API integration', { skip: !enabled }, async t => {
  const config = readConfig();
  assert.equal(config.mode, 'emulator', 'Integration tests are local emulator only');
  assert.ok(config.projectId.startsWith('demo-'));
  const firebase = createFirebaseServices(config);
  const app = createApp({ ...firebase, userRepository: new FirestoreUserRepository(firebase.firestore), logger: { error() {} } });
  const email = `p01-${randomUUID()}@example.test`;
  const password = 'Local-emulator-test-71!';
  let uid;
  const authCall = async (method, body) => {
    const response = await fetch(`http://${config.authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=local-emulator-only`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200, `Auth emulator ${method} must succeed`);
    return response.json();
  };
  try {
    const signup = await authCall('signUp', { email, password, returnSecureToken: true });
    uid = signup.localId;
    let token = signup.idToken;
    const api = (method, path = '/api/v1/me') => request(app)[method](path).set('Authorization', `Bearer ${token}`);

    await t.test('real verifier blocks missing/forged token and missing profile', async () => {
      assert.equal((await request(app).get('/api/v1/me')).status, 401);
      assert.equal((await request(app).get('/api/v1/me').set('Authorization', 'Bearer not-a-firebase-token')).status, 401);
      assert.equal((await api('get')).body.error.code, 'PROFILE_NOT_FOUND');
    });
    await t.test('parallel bootstrap uses a real Firestore transaction and preserves authority', async () => {
      const results = await Promise.all([1, 2].map(() => api('post', '/api/v1/me/bootstrap').send({ displayName: 'Sinh viên demo' })));
      assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
      for (const response of results) { assert.equal(response.body.data.role, 'customer'); assert.equal(response.body.data.active, true); }
      const stored = await firebase.firestore.collection('users').doc(uid).get();
      assert.equal(stored.data().activeOrderCount, 0);
      assert.ok(stored.data().createdAt.toDate() instanceof Date);
      assert.equal((await api('post', '/api/v1/me/bootstrap').send({ role: 'admin' })).status, 422);
    });
    await t.test('email verification is enforced before protected mutation', async () => {
      const response = await api('patch').set('Idempotency-Key', 'emulator-profile-patch-001').send({ displayName: 'Chưa xác minh' });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'EMAIL_NOT_VERIFIED');
      await firebase.auth.updateUser(uid, { emailVerified: true });
      token = (await authCall('signInWithPassword', { email, password, returnSecureToken: true })).idToken;
      assert.equal((await api('get')).body.data.emailVerified, true);
    });
    await t.test('profile patch replay is atomic and different payload conflicts', async () => {
      const responses = await Promise.all([1, 2].map(() => api('patch').set('Idempotency-Key', 'emulator-profile-patch-001').send({ displayName: 'Đã xác minh', phone: '+84 901 234 567' })));
      assert.ok(responses.every(response => response.status === 200));
      assert.deepEqual(responses.map(response => response.body.meta.idempotencyReplayed).sort(), [false, true]);
      const operations = await firebase.firestore.collection('operations').where('uid', '==', uid).get();
      assert.equal(operations.size, 1);
      const conflict = await api('patch').set('Idempotency-Key', 'emulator-profile-patch-001').send({ displayName: 'Nội dung khác' });
      assert.equal(conflict.status, 409);
      assert.equal((await api('patch').set('Idempotency-Key', 'emulator-profile-patch-002').send({ role: 'admin' })).status, 422);
    });
    await t.test('database role and active changes are effective without trusting token claims', async () => {
      await firebase.firestore.collection('users').doc(uid).update({ role: 'merchant' });
      assert.equal((await api('get')).body.data.role, 'merchant');
      await firebase.firestore.collection('users').doc(uid).update({ active: false });
      assert.equal((await api('get')).body.error.code, 'USER_INACTIVE');
      assert.equal((await api('post', '/api/v1/me/bootstrap').send({})).body.error.code, 'USER_INACTIVE');
    });
  } finally {
    // Only remove records created by this test. No global emulator reset.
    if (uid) {
      const operations = await firebase.firestore.collection('operations').where('uid', '==', uid).get();
      const batch = firebase.firestore.batch();
      operations.docs.forEach(document => batch.delete(document.ref));
      batch.delete(firebase.firestore.collection('users').doc(uid));
      await batch.commit();
      await firebase.auth.deleteUser(uid);
    }
    await firebase.close();
  }
});
