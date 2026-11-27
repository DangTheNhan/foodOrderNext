import { NativeModules, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from '@react-native-firebase/firestore';
import inputConfig from '../config/runtime.config';
import { validateConfig } from '../config/validateConfig';

let runtime;
export function getFirebaseRuntime() {
  if (runtime) {
    return runtime;
  }
  const app = getApp();
  const buildConfig = Platform.OS === 'android' && !__DEV__
    ? {
        environment: 'staging',
        projectId: app.options.projectId,
        apiBaseUrl: NativeModules.FoodOrderRuntimeConfig?.apiBaseUrl,
        emulatorHost: null,
      }
    : inputConfig;
  const config = validateConfig(buildConfig, { isDevelopment: __DEV__, platform: Platform.OS });
  if (app.options.projectId !== config.projectId) {
    throw new Error('Firebase native projectId khác runtime.config.js; dừng để tránh đọc nhầm dữ liệu.');
  }
  const auth = getAuth(app);
  // P01 profile uses memory only; native Auth owns session persistence.
  const db = initializeFirestore(app, { persistence: false });
  if (config.environment === 'emulator') {
    connectAuthEmulator(auth, `http://${config.emulatorHost}:${config.authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, config.emulatorHost, config.firestorePort);
  }
  runtime = { app, auth, db, config };
  return runtime;
}
