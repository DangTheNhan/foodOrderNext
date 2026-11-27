import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { AuthorizationStatus, getMessaging, getToken, hasPermission, isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages, requestPermission } from '@react-native-firebase/messaging';
import { getApi } from '../api/axiosClient';
import { newIntentKey } from '../api/clientCore';
import { operatorRuntime } from './operationsData';
import { getFirebaseRuntime } from '../firebase/runtime';

const installationKey = 'foodordernext-push-installation-v1';
let installationPromise;
let queue = Promise.resolve();
let exitingUid = null;

function installationId() {
  if (!installationPromise) {
    installationPromise = (async () => {
      const current = await AsyncStorage.getItem(installationKey);
      if (/^[A-Za-z0-9-]{24,128}$/.test(current ?? '')) return current;
      const id = newIntentKey();
      await AsyncStorage.setItem(installationKey, id);
      return id;
    })().catch(error => { installationPromise = undefined; throw error; });
  }
  return installationPromise;
}

function serialize(task) {
  const next = queue.then(task);
  queue = next.catch(() => {});
  return next;
}

export function messagingFor(uid) {
  const { app, config, auth } = getFirebaseRuntime();
  return config.environment === 'staging' && auth.currentUser?.uid === uid ? getMessaging(app) : null;
}

export async function notificationPermission(uid, request = false) {
  const messaging = messagingFor(uid);
  if (!messaging) return 'local';
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) return 'system';
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const granted = request ? await PermissionsAndroid.request(permission) === PermissionsAndroid.RESULTS.GRANTED
      : await PermissionsAndroid.check(permission);
    return granted ? 'granted' : 'denied';
  }
  const status = request ? await requestPermission(messaging) : await hasPermission(messaging);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL ? 'granted' : 'denied';
}

export function activatePushSession(uid) {
  if (exitingUid === uid) exitingUid = null;
}

export async function syncPushDevice(uid, { token, enabled, alive }) {
  if (!alive() || exitingUid === uid) return;
  const messaging = messagingFor(uid);
  if (!messaging) return;
  const permission = await notificationPermission(uid);
  if (enabled && permission !== 'denied' && Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }
  const nextToken = enabled && permission !== 'denied' ? token ?? await getToken(messaging) : null;
  const id = await installationId();
  return serialize(() => {
    if (!alive() || exitingUid === uid) return;
    operatorRuntime(uid);
    const client = getApi().client;
    const path = `/me/devices/${id}`;
    return nextToken ? client.put(path, { token: nextToken, platform: Platform.OS, notificationsEnabled: true }) : client.delete(path);
  });
}

export async function detachPushBeforeLogout(uid) {
  if (!uid) return;
  exitingUid = uid;
  if (!messagingFor(uid)) return;
  let timer;
  try {
    const id = await installationId();
    const removed = serialize(() => {
      if (exitingUid !== uid) return;
      operatorRuntime(uid);
      return getApi().client.delete(`/me/devices/${id}`);
    });
    await Promise.race([removed, new Promise(resolve => { timer = setTimeout(resolve, 2000); })]);
  } finally { clearTimeout(timer); }
}
