/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import runtime from './src/config/runtime.config';

if (runtime.environment === 'staging') {
  // Order state remains in Firestore. The OS displays notification payloads.
  setBackgroundMessageHandler(getMessaging(), async () => {});
}

AppRegistry.registerComponent(appName, () => App);
