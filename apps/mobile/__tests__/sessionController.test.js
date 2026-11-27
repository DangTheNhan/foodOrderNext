import { createSessionController, sessionPhase } from '../src/auth/sessionController';

const user = (uid = 'a', emailVerified = true) => ({ uid, emailVerified, displayName: 'Demo' });
const profile = (uid = 'a', role = 'customer', active = true) => ({ uid, role, active, displayName: 'Demo', emailVerified: true });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness() {
  const listeners = [];
  const dependencies = {
    observeAuth: jest.fn(() => jest.fn()), bootstrap: jest.fn().mockResolvedValue({}),
    getProfile: jest.fn().mockResolvedValue(profile()),
    observeProfile: jest.fn((uid, next, error) => {
      const unsubscribe = jest.fn(); listeners.push({ uid, next, error, unsubscribe }); return unsubscribe;
    }), clearPrivateState: jest.fn(), onChange: jest.fn(),
  };
  return { dependencies, listeners, controller: createSessionController(dependencies) };
}

test.each(['customer', 'merchant', 'driver', 'admin'])('verified active %s gets its own authorized session', role => {
  expect(sessionPhase(user(), profile('a', role))).toBe('ready');
});
test('unverified user cannot open role workspace', () => {
  expect(sessionPhase(user('a', false), profile())).toBe('needsVerification');
  expect(sessionPhase(user(), { ...profile(), emailVerified: false })).toBe('needsVerification');
});
test('missing/unknown/cross-user authority fails closed and inactive remains locked', () => {
  expect(sessionPhase(user(), null)).toBe('error');
  expect(sessionPhase(user(), profile('b'))).toBe('error');
  expect(sessionPhase(user(), profile('a', 'superuser'))).toBe('error');
  expect(sessionPhase(user(), profile('a', 'admin', false))).toBe('locked');
});
test('bootstrap precedes hydration and missing profile can recover by retry', async () => {
  const { controller, dependencies } = harness();
  dependencies.bootstrap.mockRejectedValueOnce(new Error('offline'));
  await controller.refresh(user());
  expect(controller.getState()).toMatchObject({ phase: 'error', profile: null });
  expect(dependencies.getProfile).not.toHaveBeenCalled();
  await controller.refresh(user());
  expect(controller.getState().phase).toBe('ready');
  expect(dependencies.bootstrap.mock.invocationCallOrder[1]).toBeLessThan(dependencies.getProfile.mock.invocationCallOrder[0]);
});

test('initial sign-in cannot create a fallback profile while registration sets its name', async () => {
  const { dependencies } = harness();
  const registration = deferred();
  const controller = createSessionController({ ...dependencies, prepareUser: () => registration.promise });
  const pending = controller.refresh({ ...user(), displayName: null });
  expect(dependencies.bootstrap).not.toHaveBeenCalled();
  registration.resolve({ ...user(), displayName: 'Entered name' });
  await pending;
  expect(dependencies.bootstrap).toHaveBeenCalledWith('Entered name');
  expect(controller.getState().phase).toBe('ready');
});

test('refresh of the same verified user preserves its form until fresh authority arrives', async () => {
  const { controller, dependencies } = harness();
  await controller.refresh(user());
  const refreshed = deferred();
  dependencies.getProfile.mockReturnValueOnce(refreshed.promise);
  const pending = controller.refresh(user());
  await Promise.resolve();
  expect(controller.getState().phase).toBe('ready');
  refreshed.resolve(profile('a', 'merchant'));
  await pending;
  expect(controller.getState().profile.role).toBe('merchant');
});
test('late response from previous account cannot replace new account', async () => {
  const { controller, dependencies } = harness();
  const oldResponse = deferred();
  dependencies.getProfile.mockImplementationOnce(() => oldResponse.promise).mockResolvedValueOnce(profile('b', 'driver'));
  const pendingA = controller.refresh(user('a'));
  await Promise.resolve();
  await controller.refresh(user('b'));
  oldResponse.resolve(profile('a', 'admin'));
  await pendingA;
  expect(controller.getState()).toMatchObject({ phase: 'ready', profile: { uid: 'b', role: 'driver' } });
});
test('account switch unsubscribes profile, clears data and ignores old listener', async () => {
  const { controller, dependencies, listeners } = harness();
  await controller.refresh(user());
  dependencies.getProfile.mockResolvedValueOnce(profile('b'));
  await controller.refresh(user('b'));
  expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
  listeners[0].next({ role: 'admin', active: true }, false);
  expect(controller.getState().profile.uid).toBe('b');
  expect(dependencies.clearPrivateState).toHaveBeenCalledTimes(2);
});
test('cached role or active flag never overwrites server authority', async () => {
  const { controller, listeners } = harness();
  await controller.refresh(user());
  listeners[0].next({ role: 'admin', active: true }, true);
  expect(controller.getState().profile.role).toBe('customer');
  listeners[0].next({ role: 'customer', active: false }, false);
  expect(controller.getState()).toMatchObject({ phase: 'locked', profile: null });
});
test('rules revocation removes private UI immediately', async () => {
  const { controller, listeners, dependencies } = harness();
  await controller.refresh(user());
  listeners[0].error({ code: 'firestore/permission-denied' });
  expect(controller.getState()).toMatchObject({ phase: 'locked', profile: null });
  expect(dependencies.clearPrivateState).toHaveBeenCalledTimes(2);
});
test('logout during pending hydration prevents private UI resurrection', async () => {
  const { controller, dependencies } = harness();
  const response = deferred(); dependencies.getProfile.mockReturnValue(response.promise);
  const pending = controller.refresh(user()); await Promise.resolve();
  controller.clear(); response.resolve(profile()); await pending;
  expect(controller.getState()).toMatchObject({ phase: 'signedOut', user: null, profile: null });
});
test('native token callback during signOut cannot resurrect cleared session', async () => {
  const { controller, dependencies } = harness(); controller.start();
  const authChanged = dependencies.observeAuth.mock.calls[0][0];
  await authChanged(user()); controller.clear();
  await authChanged(user());
  expect(controller.getState().phase).toBe('signedOut');
  await authChanged(null);
  await authChanged(user());
  expect(controller.getState().phase).toBe('ready');
});
test('stop cleans both subscriptions and ignores future callbacks', async () => {
  const { controller, dependencies, listeners } = harness();
  const unsubscribeAuth = jest.fn(); dependencies.observeAuth.mockReturnValue(unsubscribeAuth);
  controller.start(); await controller.refresh(user());
  controller.stop(); const changes = dependencies.onChange.mock.calls.length;
  listeners[0].next({ role: 'admin', active: true }, false);
  expect(unsubscribeAuth).toHaveBeenCalled(); expect(listeners[0].unsubscribe).toHaveBeenCalled();
  expect(dependencies.onChange).toHaveBeenCalledTimes(changes);
});
