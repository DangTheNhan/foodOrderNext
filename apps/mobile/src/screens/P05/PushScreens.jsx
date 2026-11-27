import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { getInitialNotification, onMessage, onNotificationOpenedApp, onTokenRefresh } from '@react-native-firebase/messaging';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../../auth/SessionContext';
import { customerData } from '../../services/customerData';
import { openInboxEvent } from '../../services/realtimeData';
import { activatePushSession, messagingFor, notificationPermission, syncPushDevice } from '../../services/pushRegistration';
import { navigationRef } from '../../navigation/navigationRef';
import { Button, Card, Heading, Label, Muted, Notice, Page, useAction } from '../P02/CustomerUI';

export function PushBridge({ uid, enabled }) {
  const optedIn = useRef(enabled);
  useEffect(() => { optedIn.current = enabled; }, [enabled]);
  useEffect(() => { activatePushSession(uid); }, [uid]);
  useEffect(() => {
    const messaging = messagingFor(uid);
    if (!messaging) return;
    let mounted = true;
    const alive = () => mounted;
    const sync = token => { syncPushDevice(uid, { token, enabled, alive }).catch(() => {}); };
    const tokenSub = onTokenRefresh(messaging, sync);
    const activeSub = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    sync();
    return () => { mounted = false; tokenSub(); activeSub.remove(); };
  }, [uid, enabled]);

  useEffect(() => {
    const messaging = messagingFor(uid);
    if (!messaging) return;
    let mounted = true;
    let queued = null;
    const shown = new Set();
    const open = message => {
      const eventId = message?.data?.eventId;
      const orderId = message?.data?.orderId;
      if (!mounted || !eventId || !orderId) return;
      if (!navigationRef.isReady()) { queued = message; return; }
      openInboxEvent(uid, eventId, (screen, params) => {
        if (mounted && navigationRef.isReady()) navigationRef.navigate(screen, params);
      }, orderId).catch(() => {
        if (mounted) Alert.alert('Thông báo không còn khả dụng', 'Mở hộp thư để xem các cập nhật hiện tại.');
      });
    };
    const ready = navigationRef.addListener('ready', () => {
      const message = queued;
      queued = null;
      open(message);
    });
    const opened = onNotificationOpenedApp(messaging, open);
    const foreground = onMessage(messaging, message => {
      const id = message.data?.eventId;
      if (!mounted || !optedIn.current || !id || shown.has(id)) return;
      shown.add(id);
      if (shown.size > 80) shown.delete(shown.values().next().value);
      Alert.alert('Có cập nhật đơn hàng', 'Mở ứng dụng để xem chi tiết.', [
        { text: 'Để sau', style: 'cancel' }, { text: 'Mở', onPress: () => open(message) },
      ]);
    });
    getInitialNotification(messaging).then(open).catch(() => {});
    return () => { mounted = false; ready(); opened(); foreground(); };
  }, [uid]);
  return null;
}

const permissionLabel = {
  local: 'Môi trường local dùng hộp thư trong app.',
  system: 'Kiểm tra quyền thông báo trong cài đặt của thiết bị.',
  granted: 'Thiết bị đã cấp quyền thông báo.',
  denied: 'Thiết bị chưa cấp quyền thông báo.',
};

export function NotificationSettings({ navigation }) {
  const { user, profile } = useSession();
  const uid = user.uid;
  const enabled = profile.settings?.notificationsEnabled !== false;
  const [permission, setPermission] = useState('');
  const action = useAction();
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => notificationPermission(uid).then(value => { if (active) setPermission(value); }).catch(() => {});
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    refresh();
    return () => { active = false; sub.remove(); };
  }, [uid]));
  function toggle() {
    action.run(async () => {
      await customerData.mutate(uid, 'patch', '/me/settings', { notificationsEnabled: !enabled });
      if (!enabled) setPermission(await notificationPermission(uid, true));
    });
  }
  return <Page>
    <Heading>Thông báo đơn hàng</Heading>
    <Card><Label>{enabled ? 'Đã bật thông báo đẩy' : 'Đã tắt thông báo đẩy'}</Label>
      <Muted>{permissionLabel[permission] ?? 'Đang kiểm tra quyền thiết bị.'}</Muted>
      <Button title={enabled ? 'Tắt thông báo đẩy' : 'Bật thông báo đẩy'} disabled={action.busy} onPress={toggle} />
      {enabled && permission === 'denied' ? <Button outline title="Cấp quyền thông báo" disabled={action.busy}
        onPress={() => action.run(async () => setPermission(await notificationPermission(uid, true)))} /> : null}
      {permission !== 'local' ? <Button outline title="Mở cài đặt thiết bị" onPress={() => action.run(() => Linking.openSettings())} /> : null}
    </Card>
    <Notice>{action.message}</Notice>
    <Button outline title="Mở hộp thư trong app" onPress={() => navigation.navigate('NotificationInbox')} />
  </Page>;
}
