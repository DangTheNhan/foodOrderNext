import { ApiError, createFirebaseApiClient } from '../src/api/clientCore';

function harness(adapter) {
  let currentUser = { uid: 'a' };
  const getToken = jest.fn(async (user, force) => force ? 'fresh-id-token' : 'initial-id-token');
  const api = createFirebaseApiClient({ baseURL: 'http://localhost:5000/api/v1',
    getCurrentUser: () => currentUser, getToken, adapter });
  return { ...api, getToken, switchUser: value => { currentUser = value; } };
}
const ok = config => ({ config, status: 200, statusText: 'OK', headers: {}, data: { data: { uid: 'a' }, meta: { apiVersion: 'v1' } } });
const fail = (config, status, code = 'AUTH_INVALID') => {
  const error = new Error('HTTP failed'); error.config = config;
  error.response = { status, data: { error: { code, message: 'Request rejected' }, meta: { traceId: 'trace-test' } } };
  return error;
};
test('attaches Firebase ID token per request and returns envelope', async () => {
  const adapter = jest.fn(async config => ok(config)); const api = harness(adapter);
  const response = await api.client.get('/me');
  expect(response.data.data.uid).toBe('a');
  expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer initial-id-token');
  expect(api.getToken).toHaveBeenCalledWith({ uid: 'a' }, false);
});
test('one Firebase refresh retries 401 retaining mutation body and idempotency key', async () => {
  const adapter = jest.fn().mockImplementationOnce(async config => { throw fail(config, 401); }).mockImplementation(async config => ok(config));
  const api = harness(adapter);
  await api.client.patch('/me', { displayName: 'New' }, { headers: { 'Idempotency-Key': 'test-intent-00000001' } });
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(adapter.mock.calls[1][0].headers.Authorization).toBe('Bearer fresh-id-token');
  expect(adapter.mock.calls[1][0].headers['Idempotency-Key']).toBe('test-intent-00000001');
  expect(adapter.mock.calls[1][0].data).toBe(adapter.mock.calls[0][0].data);
});
test('repeated 401 stops after one refresh and preserves safe server error', async () => {
  const adapter = jest.fn(async config => { throw fail(config, 401); }); const api = harness(adapter);
  await expect(api.client.get('/me')).rejects.toMatchObject({ code: 'AUTH_INVALID', status: 401, traceId: 'trace-test' });
  expect(adapter).toHaveBeenCalledTimes(2);
});
test('403 is not refreshed/replayed', async () => {
  const adapter = jest.fn(async config => { throw fail(config, 403, 'USER_INACTIVE'); }); const api = harness(adapter);
  await expect(api.client.get('/me')).rejects.toMatchObject({ code: 'USER_INACTIVE' });
  expect(adapter).toHaveBeenCalledTimes(1);
});
test('signed-out requests never hit transport', async () => {
  const adapter = jest.fn(); const api = harness(adapter); api.switchUser(null);
  await expect(api.client.get('/me')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  expect(adapter).not.toHaveBeenCalled();
});
test('response from an old principal is rejected after account switch', async () => {
  let release; let started;
  const began = new Promise(resolve => { started = resolve; });
  const api = harness(config => new Promise(resolve => { release = () => resolve(ok(config)); started(); }));
  const pending = api.client.get('/me'); await began;
  api.switchUser({ uid: 'b' }); release();
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
});
test('cancelPending aborts requests before private data can be applied', async () => {
  let release; let started;
  const began = new Promise(resolve => { started = resolve; });
  const api = harness(config => new Promise(resolve => { release = () => resolve(ok(config)); started(); }));
  const pending = api.client.get('/me'); await began; api.cancelPending(); release();
  await expect(pending).rejects.toBeInstanceOf(ApiError);
});
test('a location request cancelled during token acquisition never reaches transport', async () => {
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const adapter = jest.fn(async config => ok(config));
  const api = createFirebaseApiClient({ baseURL: 'http://localhost:5000/api/v1',
    getCurrentUser: () => ({ uid: 'a' }), adapter,
    getToken: () => new Promise(resolve => { release = resolve; started(); }) });
  const controller = new AbortController();
  const pending = api.client.post('/orders/test/location', { sequence: 1 }, { signal: controller.signal });
  await began;
  controller.abort();
  release('demo-session-token');
  await expect(pending).rejects.toBeInstanceOf(ApiError);
  expect(adapter).not.toHaveBeenCalled();
});
test('invalid envelopes fail closed', async () => {
  const api = harness(async config => ({ ...ok(config), data: { user: 'legacy' } }));
  await expect(api.client.get('/me')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});

test('401 retry never rebinds account A mutation to account B in the retry gap', async () => {
  const adapter = jest.fn().mockImplementationOnce(async config => { throw fail(config, 401); })
    .mockImplementation(async config => ok(config));
  const api = harness(adapter);
  // This interceptor runs before the client's interceptor (Axios LIFO), exactly
  // between the response's retry decision and the retry's token acquisition.
  api.client.interceptors.request.use(config => {
    if (config._forceRefresh) { api.switchUser({ uid: 'b' }); }
    return config;
  });
  await expect(api.client.patch('/me', { displayName: 'Account A edit' },
    { headers: { 'Idempotency-Key': 'account-a-intent-0001' } }))
    .rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(api.getToken).toHaveBeenCalledTimes(1);
});

test('cancelling a session also invalidates a request still waiting for its token', async () => {
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const adapter = jest.fn(async config => ok(config));
  const api = createFirebaseApiClient({ baseURL: 'http://localhost:5000/api/v1',
    getCurrentUser: () => ({ uid: 'a' }), adapter,
    getToken: () => new Promise(resolve => { release = resolve; started(); }) });
  const pending = api.client.patch('/me', { displayName: 'Old session' });
  await began;
  api.cancelPending();
  release('old-session-token');
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(adapter).not.toHaveBeenCalled();
});

test('an account switch before the initial Axios interceptor cannot move a mutation', async () => {
  const adapter = jest.fn(async config => ok(config));
  const api = harness(adapter);
  api.client.interceptors.request.use(config => { api.switchUser({ uid: 'b' }); return config; });
  await expect(api.client.patch('/me', { displayName: 'Account A edit' }))
    .rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(adapter).not.toHaveBeenCalled();
  expect(api.getToken).not.toHaveBeenCalled();
});
