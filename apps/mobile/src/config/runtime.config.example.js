// Public LOCAL values only. This demo project has no real Firebase resources.
export const emulatorConfig = {
  environment: 'emulator',
  projectId: 'demo-foodordernext',
  emulatorHost: null, // Android emulator10.0.2.2; iOS localhost; real phone: LAN IP.
  apiBaseUrl: null, // null -> http://<host>:5000/api/v1
  authPort: 9099,
  firestorePort: 8080,
};
// Android release takes its project ID from the native Firebase app and its API
// URL from FOODORDER_ANDROID_API_BASE_URL at build time.
// For other staging builds, use a real projectId, HTTPS /api/v1 and emulatorHost:null.
// Admin credentials and AI keys NEVER belong in mobile configuration.
