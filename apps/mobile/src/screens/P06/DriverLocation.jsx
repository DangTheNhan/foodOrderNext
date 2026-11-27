import React, { useCallback, useRef, useState } from 'react';
import { AppState, Linking, NativeModules, PermissionsAndroid } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { sendDeliveryFix } from '../../services/deliveryTracking';
import { Button, Card, Label, Muted } from '../P02/CustomerUI';

const location = NativeModules.DeliveryLocation;
const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
const labels = {
  finding: 'Đang chờ tín hiệu GPS.',
  sent: 'Đã cập nhật vị trí.',
  paused: 'Đã tạm dừng khi app xuống nền.',
  offline: 'Đang chờ kết nối để chia sẻ tiếp.',
  permission: 'Cần cấp quyền vị trí chính xác khi dùng app.',
  gps: 'Hãy bật vị trí trên thiết bị để tiếp tục.',
  noFix: 'Chưa lấy được vị trí. Hãy thử ở nơi thoáng hơn.',
  unavailable: 'Vị trí chưa được máy chủ chấp nhận.',
};

export function DriverLocation({ uid, orderId, assignmentVersion, stale, completing }) {
  const [sharing, setSharing] = useState(false);
  const [state, setState] = useState({});
  const requesting = useRef(false);
  const focusGeneration = useRef(0);

  useFocusEffect(useCallback(() => {
    if (!sharing || stale || completing || !location) return;
    let alive = true;
    let run = null;
    let timer;

    function stop() {
      run?.abort();
      run = null;
      clearTimeout(timer);
      location.cancel();
    }

    async function update(controller) {
      if (!alive || controller.signal.aborted || AppState.currentState !== 'active') return;
      try {
        const fix = await location.getFix();
        if (!alive || controller.signal.aborted || AppState.currentState !== 'active') return;
        const data = await sendDeliveryFix(uid, orderId, fix, assignmentVersion, controller.signal);
        if (!controller.signal.aborted) setState({ status: 'sent', last: data.receivedAt });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.code === 'PERMISSION' || error.status === 403 || error.status === 404) {
          setSharing(false);
          setState({ status: error.code === 'PERMISSION' ? 'permission' : 'unavailable' });
          return;
        }
        if (!['PAUSED', 'LOCATION_RATE_LIMITED', 'LOCATION_UNCHANGED', 'LOCATION_OUT_OF_ORDER'].includes(error.code)) {
          const status = { GPS_OFF: 'gps', NO_FIX: 'noFix', NETWORK_ERROR: 'offline', DATA_SERVICE_UNAVAILABLE: 'offline' }[error.code];
          setState(previous => ({ ...previous, status: status ?? 'unavailable' }));
        }
      }
      if (alive && !controller.signal.aborted) timer = setTimeout(() => update(controller), 12_000);
    }

    function appState(value) {
      stop();
      if (value !== 'active') {
        setState(previous => ({ ...previous, status: 'paused' }));
        return;
      }
      run = new AbortController();
      setState(previous => ({ ...previous, status: 'finding' }));
      update(run);
    }

    const subscription = AppState.addEventListener('change', appState);
    appState(AppState.currentState);
    return () => { alive = false; stop(); subscription.remove(); };
  }, [uid, orderId, assignmentVersion, sharing, stale, completing]));

  useFocusEffect(useCallback(() => () => { focusGeneration.current += 1; }, []));

  async function start() {
    if (!location || requesting.current) return;
    const generation = focusGeneration.current;
    requesting.current = true;
    try {
      const result = await PermissionsAndroid.requestMultiple(permissions);
      if (focusGeneration.current !== generation) return;
      if (result[permissions[0]] === PermissionsAndroid.RESULTS.GRANTED) {
        setSharing(true);
        setState({ status: 'finding' });
      } else {
        setState({ status: 'permission' });
      }
    } catch {
      if (focusGeneration.current === generation) setState({ status: 'permission' });
    } finally { requesting.current = false; }
  }

  return <Card>
    <Label>Chia sẻ vị trí chuyến</Label>
    <Muted>Vị trí chỉ cập nhật khi bạn mở màn hình chuyến này.</Muted>
    {!location ? <Muted>Tính năng vị trí hiện hỗ trợ Android.</Muted> : <>
      <Muted>{stale && sharing ? labels.offline : labels[state.status]}</Muted>
      {state.last ? <Muted>Cập nhật cuối · {new Date(state.last).toLocaleTimeString('vi-VN')}</Muted> : null}
      {sharing ? <Button outline title="Dừng chia sẻ vị trí" testID="stop-driver-location"
        onPress={() => { setSharing(false); setState({}); }} />
        : <Button outline title="Chia sẻ vị trí" testID="start-driver-location" disabled={stale || completing} onPress={start} />}
      {state.status === 'permission' ? <Button outline title="Mở quyền ứng dụng" onPress={() => Linking.openSettings().catch(() => {})} /> : null}
      {state.status === 'gps' ? <Button outline title="Mở cài đặt vị trí"
        onPress={() => Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {})} /> : null}
    </>}
  </Card>;
}
