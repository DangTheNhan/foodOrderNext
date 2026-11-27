// The mounted P01 app uses native Firebase + SessionContext, no second auth store.
// Baseline screens stay unmounted UI references for later phases.
export { useSession as useAuthStore } from '../auth/SessionContext';
