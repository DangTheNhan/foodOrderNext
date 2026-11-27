import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { onIdTokenChanged } from '@react-native-firebase/auth';
import { doc, onSnapshot } from '@react-native-firebase/firestore';
import { getFirebaseRuntime } from '../firebase/runtime';
import { ProfileService } from '../services/ProfileService';
import { AuthService } from '../services/AuthService';
import { createSessionController } from './sessionController';
import { clearPrivateState, removeLegacySession } from './privateState';
import { detachPushBeforeLogout } from '../services/pushRegistration';

const SessionContext = createContext(null);
export function SessionProvider({ children }) {
  const [state, setState] = useState({ phase: 'loading', user: null, profile: null, error: null });
  const controller = useMemo(() => createSessionController({ onChange: setState,
    observeAuth: listener => onIdTokenChanged(getFirebaseRuntime().auth, listener),
    prepareUser: AuthService.prepareSession,
    bootstrap: ProfileService.bootstrap, getProfile: ProfileService.getProfile,
    observeProfile: (uid, next, error) => onSnapshot(doc(getFirebaseRuntime().db, 'users', uid),
      { includeMetadataChanges: true }, snapshot => {
        const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
        next(exists ? snapshot.data() : null, snapshot.metadata.fromCache);
      }, error), clearPrivateState }), []);
  useEffect(() => {
    let mounted = true;
    removeLegacySession().then(() => { if (mounted) { controller.start(); } }).catch(() => {
      if (mounted) { setState({ phase: 'error', user: null, profile: null, error: 'Không dọn được phiên cũ. Khởi động lại ứng dụng.' }); }
    });
    const subscription = AppState.addEventListener('change', async value => {
      if (value === 'active' && getFirebaseRuntime().auth.currentUser) {
        try {
          const user = await AuthService.reloadSession();
          if (mounted) { await controller.refresh(user); }
        } catch (error) {
          if (mounted) {
            controller.clear();
            setState({ phase: 'error', user: null, profile: null, error: 'Chưa xác minh được phiên. Kiểm tra mạng và thử lại.' });
          }
        }
      }
    });
    return () => { mounted = false; subscription.remove(); controller.stop(); clearPrivateState(); };
  }, [controller]);
  const value = { ...state,
    async refresh() { await controller.refresh(await AuthService.reloadSession()); },
    async logout() {
      await detachPushBeforeLogout(state.user?.uid).catch(() => {});
      controller.clear();
      try { await AuthService.logout(); } catch (error) {
        setState({ phase: 'error', user: null, profile: null, error: 'Chưa đăng xuất được Firebase. Hãy thử lại.' });
        throw error;
      }
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) { throw new Error('useSession cần SessionProvider.'); }
  return session;
}
