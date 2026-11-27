export const ROLES = ['customer', 'merchant', 'driver', 'admin'];
export function sessionPhase(user, profile) {
  if (!user) {
    return 'signedOut';
  }
  if (!profile || profile.uid !== user.uid || !ROLES.includes(profile.role)) {
    return 'error';
  }
  if (profile.active !== true) {
    return 'locked';
  }
  return user.emailVerified && profile.emailVerified === true ? 'ready' : 'needsVerification';
}

// Framework-free to test request/listener races and account switching.
export function createSessionController({ observeAuth, bootstrap, getProfile, observeProfile, clearPrivateState, onChange, prepareUser }) {
  let state = { phase: 'loading', user: null, profile: null, error: null };
  let generation = 0;
  let authUnsubscribe;
  let profileUnsubscribe;
  let stopped = false;
  let suspended = false;
  const publish = next => { state = next; if (!stopped) { onChange(next); } };
  const clearProfileListener = () => { profileUnsubscribe?.(); profileUnsubscribe = undefined; };
  async function hydrate(user) {
    const currentGeneration = ++generation;
    const keepReady = state.phase === 'ready' && state.user?.uid === user?.uid
      && user?.emailVerified === true && state.profile?.emailVerified === true;
    clearProfileListener();
    if (state.user?.uid !== user?.uid) {
      clearPrivateState();
    }
    if (!user) {
      publish({ phase: 'signedOut', user: null, profile: null, error: null });
      return;
    }
    // Refreshing the same verified account must not destroy a password/profile
    // form. Commands still verify authority at the API; failure clears the UI.
    if (!keepReady) { publish({ phase: 'loading', user, profile: null, error: null }); }
    try {
      if (prepareUser) {
        const expectedUid = user.uid;
        user = await prepareUser(user);
        if (stopped || currentGeneration !== generation) { return; }
        if (!user || user.uid !== expectedUid) { throw new Error('Tài khoản đã thay đổi.'); }
      }
      await bootstrap(user.displayName || undefined);
      const profile = await getProfile();
      if (stopped || currentGeneration !== generation) { return; }
      const phase = sessionPhase(user, profile);
      publish({ phase, user, profile: ['ready', 'needsVerification'].includes(phase) ? profile : null,
        error: phase === 'error' ? 'Hồ sơ hoặc vai trò không hợp lệ. Vui lòng thử lại.' : null });
      if (!['ready', 'needsVerification'].includes(phase)) { clearPrivateState(); return; }
      profileUnsubscribe = observeProfile(user.uid, (data, fromCache) => {
        if (stopped || currentGeneration !== generation || fromCache) { return; }
        const nextProfile = data ? { ...data, uid: user.uid, emailVerified: profile.emailVerified } : null;
        const nextPhase = sessionPhase(user, nextProfile);
        if (!['ready', 'needsVerification'].includes(nextPhase)) { clearPrivateState(); }
        publish({ phase: nextPhase, user, profile: ['ready', 'needsVerification'].includes(nextPhase) ? nextProfile : null,
          error: nextPhase === 'error' ? 'Hồ sơ không còn hợp lệ. Hãy tải lại phiên.' : null });
      }, error => {
        if (stopped || currentGeneration !== generation) { return; }
        clearPrivateState();
        publish({ phase: error.code?.includes('permission-denied') ? 'locked' : 'error', user, profile: null,
          error: error.code?.includes('permission-denied') ? null : 'Không xác minh được hồ sơ trực tiếp. Kiểm tra mạng rồi thử lại.' });
      });
    } catch (error) {
      if (stopped || currentGeneration !== generation) { return; }
      clearPrivateState();
      const locked = ['ACCOUNT_INACTIVE', 'USER_INACTIVE', 'ACCOUNT_DISABLED', 'auth/user-disabled'].includes(error.code);
      publish({ phase: locked ? 'locked' : 'error', user, profile: null,
        error: locked ? null : (error.message || 'Không tải được hồ sơ. Vui lòng thử lại.') });
    }
  }
  return {
    getState: () => state,
    start() {
      stopped = false;
      authUnsubscribe = observeAuth(user => {
        if (suspended && user) { return; }
        if (!user) { suspended = false; }
        return hydrate(user);
      });
    },
    refresh(user) { suspended = false; return hydrate(user); },
    clear() {
      suspended = true; ++generation; clearProfileListener(); clearPrivateState();
      publish({ phase: 'signedOut', user: null, profile: null, error: null });
    },
    stop() {
      stopped = true; ++generation; clearProfileListener(); authUnsubscribe?.(); authUnsubscribe = undefined;
    },
  };
}
