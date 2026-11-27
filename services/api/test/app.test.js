import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createCustomerProfile, patchOperation } from '../src/users.js';
import { ApiError, requireValidProfile } from '../src/errors.js';
import { assertShopOwner, assertAssignedDriver, requireRoles } from '../src/auth.js';

const identity = { uid: 'customer-test', email: 'student@example.test', email_verified: true, name: 'Sinh viên' };
const initialProfile = overrides => ({ ...createCustomerProfile({ uid: identity.uid, email: identity.email, name: identity.name }, {}, new Date('2026-11-03T00:00:00Z')), ...overrides });

// This fake tests request/auth behavior only. The real transaction race is tested
// separately against Auth+Firestore emulators, not claimed from this fake.
class MemoryUsers {
  constructor(profile) { this.users = new Map(profile ? [[identity.uid, profile]] : []); this.operations = new Map(); this.pending = Promise.resolve(); }
  async exclusive(action) {
    const previous = this.pending;
    let release;
    this.pending = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await action(); } finally { release(); }
  }
  async findByUid(uid) { return structuredClone(this.users.get(uid) ?? null); }
  async bootstrap(actor, input) {
    return this.exclusive(async () => {
      let profile = this.users.get(actor.uid);
      const created = !profile;
      if (!profile) { profile = createCustomerProfile(actor, input, new Date()); this.users.set(actor.uid, profile); }
      requireValidProfile(profile);
      return { profile: structuredClone(profile), created };
    });
  }
  async patch(actor, patch, key) {
    return this.exclusive(async () => {
      const profile = requireValidProfile(this.users.get(actor.uid));
      const operation = patchOperation(actor, key, patch);
      const stored = this.operations.get(operation.id);
      if (stored && stored !== operation.fingerprint) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã dùng.');
      if (!stored) { Object.assign(profile, patch, { updatedAt: new Date() }); this.operations.set(operation.id, operation.fingerprint); }
      return { profile: structuredClone(profile), replayed: Boolean(stored) };
    });
  }
}

function setup({ profile = initialProfile(), decoded = identity, verifier, validateAvatar } = {}) {
  const users = new MemoryUsers(profile);
  const app = createApp({ userRepository: users, verifyIdToken: verifier ?? (async token => { if (token !== 'valid-token') throw new Error('not a real token'); return decoded; }), validateAvatar, logger: { error() {} } });
  return { app, users };
}
const authenticated = (app, method = 'get', path = '/api/v1/me') => request(app)[method](path).set('Authorization', 'Bearer valid-token');
const patchProfile = (app, body, key = 'profile-update-key-0001') => authenticated(app, 'patch').set('Idempotency-Key', key).send(body);

test('health is public and returns envelope + generated trace ID', async () => {
  const { app } = setup();
  const response = await request(app).get('/health').set('X-Request-ID', 'untrusted-user-input');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.meta.apiVersion, 'v1');
  assert.match(response.body.meta.traceId, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers['x-request-id'], response.body.meta.traceId);
  assert.equal(response.headers['x-powered-by'], undefined);
});
test('missing and invalid token fail closed', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/v1/me')).body.error.code, 'AUTH_REQUIRED');
  const bad = await request(app).get('/api/v1/me').set('Authorization', 'Bearer invalid-token');
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'TOKEN_INVALID');
  assert.ok(!JSON.stringify(bad.body).includes('not a real token'));
});
test('malformed authorization and malformed decoded UID cannot authenticate', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/v1/me').set('Authorization', 'Basic abc')).status, 401);
  const invalid = setup({ decoded: { uid: '../other-user' } });
  assert.equal((await authenticated(invalid.app)).status, 401);
});
test('profile missing can bootstrap but cannot GET protected profile', async () => {
  const { app } = setup({ profile: null });
  assert.equal((await authenticated(app)).body.error.code, 'PROFILE_NOT_FOUND');
  const response = await authenticated(app, 'post', '/api/v1/me/bootstrap').send({ displayName: ' Bạn mới ' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.role, 'customer');
  assert.equal(response.body.data.active, true);
  assert.equal(response.body.data.displayName, 'Bạn mới');
});
test('bootstrap retry and parallel requests preserve a single identity and role', async () => {
  const { app, users } = setup({ profile: null });
  const responses = await Promise.all([1, 2].map(() => authenticated(app, 'post', '/api/v1/me/bootstrap').send({})));
  assert.deepEqual(responses.map(result => result.status).sort(), [200, 201]);
  assert.equal(users.users.size, 1);
  users.users.get(identity.uid).role = 'merchant';
  const retry = await authenticated(app, 'post', '/api/v1/me/bootstrap').send({ displayName: 'Override' });
  assert.equal(retry.body.data.role, 'merchant');
  assert.notEqual(retry.body.data.displayName, 'Override');
});
for (const body of [{ role: 'admin' }, { active: true }, { uid: 'victim' }, { displayName: 'Valid', role: 'merchant' }]) {
  test(`bootstrap rejects protected input ${Object.keys(body).join(',')}`, async () => {
    const { app, users } = setup({ profile: null });
    const response = await authenticated(app, 'post', '/api/v1/me/bootstrap').send(body);
    assert.equal(response.status, 422);
    assert.equal(users.users.size, 0);
  });
}
test('inactive profile cannot read, patch or reactivate via bootstrap', async () => {
  const { app, users } = setup({ profile: initialProfile({ active: false }) });
  for (const response of [await authenticated(app), await patchProfile(app, { displayName: 'New' }), await authenticated(app, 'post', '/api/v1/me/bootstrap').send({})]) {
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'USER_INACTIVE');
  }
  assert.equal(users.users.get(identity.uid).active, false);
});
test('unverified identity may hydrate/bootstrap but cannot mutate profile', async () => {
  const { app } = setup({ decoded: { ...identity, email_verified: false } });
  assert.equal((await authenticated(app)).body.data.emailVerified, false);
  assert.equal((await authenticated(app, 'post', '/api/v1/me/bootstrap').send({})).status, 200);
  assert.equal((await patchProfile(app, { displayName: 'New' })).body.error.code, 'EMAIL_NOT_VERIFIED');
});
test('token spoofed role and persisted extra fields are not trusted or leaked', async () => {
  const { app } = setup({ decoded: { ...identity, role: 'admin' }, profile: initialProfile({ seedVersion: 'test', internalSecretNote: 'never-export-me' }) });
  const response = await authenticated(app);
  assert.equal(response.body.data.role, 'customer');
  assert.equal(response.body.data.internalSecretNote, undefined);
  assert.equal(response.body.data.seedVersion, undefined);
});
for (const body of [{ role: 'admin' }, { active: true }, { emailDisplay: 'attacker@example.test' }, { activeOrderCount: 0 }, { unexpected: 1 }, {}]) {
  test(`PATCH rejects unknown/protected/empty fields ${Object.keys(body).join(',') || 'empty'}`, async () => {
    const { app } = setup();
    assert.equal((await patchProfile(app, body)).status, 422);
  });
}
test('allowed patch is trimmed, remains customer, replay does not repeat write', async () => {
  const { app, users } = setup();
  const first = await patchProfile(app, { displayName: ' Tên mới ', phone: '+84 901 234 567' });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.displayName, 'Tên mới');
  assert.equal(first.body.data.role, 'customer');
  const retry = await patchProfile(app, { phone: '+84 901 234 567', displayName: ' Tên mới ' });
  assert.equal(retry.body.meta.idempotencyReplayed, true);
  assert.equal(retry.body.data.updatedAt, first.body.data.updatedAt);
  assert.equal(users.operations.size, 1);
  assert.equal((await patchProfile(app, { displayName: 'Different' })).status, 409);
});
test('PATCH requires idempotency key', async () => {
  const { app } = setup();
  const response = await authenticated(app, 'patch').send({ displayName: 'New' });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
});
test('avatar must belong to identity and pass storage validation', async () => {
  const checked = [];
  const { app } = setup({ validateAvatar: async (uid, path) => checked.push({ uid, path }) });
  assert.equal((await patchProfile(app, { avatarPath: 'users/other/avatars/avatar.png' })).status, 422);
  assert.equal(checked.length, 0);
  const response = await patchProfile(app, { avatarPath: `users/${identity.uid}/avatars/avatar.png` });
  assert.equal(response.status, 200);
  assert.equal(checked.length, 1);
});
test('malformed JSON and unknown endpoint have safe error envelopes', async () => {
  const { app } = setup();
  const malformed = await authenticated(app, 'post', '/api/v1/me/bootstrap').set('Content-Type', 'application/json').send('{invalid');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  assert.equal((await request(app).get('/api/v1/admin/users')).status, 404);
});
test('repository errors are sanitized and auth dependency errors are distinguished', async () => {
  const { app, users } = setup();
  users.findByUid = async () => { throw new Error('secret=value'); };
  const response = await authenticated(app);
  assert.equal(response.status, 500);
  assert.ok(!JSON.stringify(response.body).includes('secret'));
  const unavailable = setup({ verifier: async () => { throw Object.assign(new Error('hidden'), { code: 'auth/internal-error' }); } });
  assert.equal((await authenticated(unavailable.app)).status, 503);
});
test('role and ownership helpers use active database authority', () => {
  let passed;
  requireRoles('admin')({ profile: initialProfile({ role: 'customer' }), identity: { role: 'admin' } }, {}, error => { passed = error; });
  assert.equal(passed.code, 'FORBIDDEN');
  const merchant = { uid: 'merchant-test', profile: initialProfile({ role: 'merchant' }) };
  assert.doesNotThrow(() => assertShopOwner(merchant, { ownerUid: merchant.uid }));
  assert.throws(() => assertShopOwner(merchant, { ownerUid: 'other' }), /quyền/);
  const driver = { uid: 'driver-test', profile: initialProfile({ role: 'driver' }) };
  assert.throws(() => assertAssignedDriver(driver, { driverUid: 'other' }, { active: true, approved: true }));
  assert.doesNotThrow(() => assertAssignedDriver(driver, { driverUid: driver.uid }, { active: true, approved: true }));
});
