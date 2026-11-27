import { getIdToken } from '@react-native-firebase/auth';
import { getFirebaseRuntime } from '../firebase/runtime';
import { createFirebaseApiClient } from './clientCore';

let api;
export function getApi() {
  if (!api) {
    const { auth, config } = getFirebaseRuntime();
    api = createFirebaseApiClient({ baseURL: config.apiBaseUrl,
      getCurrentUser: () => auth.currentUser,
      getToken: (user, forceRefresh) => getIdToken(user, forceRefresh) });
  }
  return api;
}
export function cancelPendingRequests() { api?.cancelPending(); }

// Baseline SQL-era screens are kept as UI references, never mounted in P01.
const compatibilityClient = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map(method => [method, (path, ...args) => {
  if (path !== '/me' && path !== '/me/bootstrap') {
    return Promise.reject(new Error('LEGACY_ENDPOINT_DISABLED: màn hình này chưa chuyển sang FoodOrderNext.'));
  }
  return getApi().client[method](path, ...args);
}]));
export default compatibilityClient;
