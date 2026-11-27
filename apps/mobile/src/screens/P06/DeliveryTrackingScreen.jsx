import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../../auth/SessionContext';
import { observeDelivery, shopPoint } from '../../services/deliveryTracking';
import { realtimeData } from '../../services/realtimeData';
import { Button, Card, Heading, Label, Muted, Notice, Page, palette, useRead } from '../P02/CustomerUI';
import { useScopedOrder } from '../P05/LiveRead';

const CUTOFF_MS = 60_000;

export function DeliveryTrackingScreen({ route }) {
  const uid = useSession().user.uid;
  const { orderId } = route.params;
  const observe = useCallback((next, error) => realtimeData.order({ uid, role: 'customer' }, orderId, next, error), [uid, orderId]);
  const state = useScopedOrder(observe);
  const order = state.order;
  return <Page>
    <Heading>Theo dõi giao món</Heading>
    {state.waiting ? <Muted>Đang xác nhận trạng thái đơn.</Muted> : null}
    {state.error ? <><Notice>{state.error}</Notice><Button outline title="Thử lại" onPress={state.retry} /></> : null}
    {state.empty ? <Muted>Đơn không khả dụng.</Muted> : null}
    {order?.status === 'DELIVERING' ? <DeliveryMap key={order.assignmentVersion} uid={uid} order={order} orderStale={state.stale} />
      : order ? <Muted>Chia sẻ vị trí đã kết thúc.</Muted> : null}
  </Page>;
}

function DeliveryMap({ uid, order, orderStale }) {
  const [state, setState] = useState({ waiting: true });
  const [revision, setRevision] = useState(0);
  const [expired, setExpired] = useState(false);
  const readShop = useCallback(() => order.shopLocationSnapshot === undefined
    ? shopPoint(uid, order.shopId) : Promise.resolve(order.shopLocationSnapshot), [uid, order.shopId, order.shopLocationSnapshot]);
  const shop = useRead(readShop);
  useFocusEffect(useCallback(() => {
    let active = true;
    let unsubscribe;
    setState({ waiting: true, revision });
    const onError = error => {
      if (active) setState({ error: error.code?.includes('permission-denied')
        ? 'Vị trí hiện không khả dụng với đơn này.' : 'Mất kết nối vị trí. Hãy thử lại.' });
    };
    try {
      unsubscribe = observeDelivery(uid, order.id, update => {
        if (!active) return;
        setState(previous => update.stale ? { ...previous, stale: true } : update);
      }, onError);
    } catch (error) { onError(error); }
    return () => { active = false; unsubscribe?.(); };
  }, [uid, order.id, revision]));
  const position = state.position?.assignmentVersion === order.assignmentVersion ? state.position : null;
  const receivedAt = position?.receivedAt?.toMillis?.();
  useEffect(() => {
    if (!receivedAt) return;
    const remaining = CUTOFF_MS - (Date.now() - receivedAt);
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [receivedAt]);
  const stale = Boolean(orderStale || state.stale || (receivedAt && expired));
  const pins = [
    { id: 'shop', label: 'Quán', point: shop.data, color: '#A33416' },
    { id: 'destination', label: 'Điểm giao', point: order.addressSnapshot?.location, color: '#315C87' },
    { id: 'driver', label: 'Tài xế', point: position, color: stale ? '#77706A' : '#247154' },
  ];
  return <>
    <Card>
      <Label>{order.shopNameSnapshot || 'Quán'}</Label>
      <Muted>{order.addressSnapshot?.addressText ?? 'Điểm giao theo đơn'}</Muted>
    </Card>
    <Card>
      <Label>Sơ đồ vị trí</Label>
      <PositionMap pins={pins} />
      {pins.map(pin => <View key={pin.id} style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: pin.color }]} />
        <Text style={styles.legendLabel}>{validPoint(pin.point) ? pin.label : `${pin.label} · Chưa có tọa độ`}</Text>
      </View>)}
      {receivedAt ? <Muted>Cập nhật lúc {new Date(receivedAt).toLocaleTimeString('vi-VN')} · Sai số khoảng {Math.ceil(position.accuracyMeters)} m</Muted>
        : !state.error ? <Muted>{state.waiting ? 'Đang chờ dữ liệu vị trí.' : 'Tài xế chưa chia sẻ vị trí.'}</Muted> : null}
      {stale ? <Notice>{state.stale || orderStale ? 'Đang kết nối lại. Vị trí gần nhất có thể đã cũ.' : 'Vị trí đã cũ.'}</Notice> : null}
      {state.error ? <><Notice>{state.error}</Notice><Button outline title="Tải lại vị trí" onPress={() => setRevision(value => value + 1)} /></> : null}
    </Card>
  </>;
}

function validPoint(point) {
  return Number.isFinite(point?.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point?.longitude) && Math.abs(point.longitude) <= 180;
}

function PositionMap({ pins }) {
  const drawn = pins.filter(pin => validPoint(pin.point));
  if (!drawn.length) return <Muted>Sơ đồ sẽ hiện khi có tọa độ.</Muted>;
  const origin = drawn[0].point;
  const longitudeScale = 111_320 * Math.max(0.01, Math.cos(origin.latitude * Math.PI / 180));
  const points = drawn.map(pin => ({ ...pin,
    x: ((pin.point.longitude - origin.longitude + 540) % 360 - 180) * longitudeScale,
    y: (pin.point.latitude - origin.latitude) * 110_574,
  }));
  const xValues = points.map(pin => pin.x);
  const yValues = points.map(pin => pin.y);
  const xMin = Math.min(...xValues);
  const yMin = Math.min(...yValues);
  const width = Math.max(...xValues) - xMin;
  const height = Math.max(...yValues) - yMin;
  const span = Math.max(100, width, height);
  return <View testID="delivery-map" accessibilityLabel="Sơ đồ các điểm theo tọa độ, hướng bắc ở phía trên" style={styles.map}>
    <Text style={styles.north}>↑ Bắc</Text>
    <View pointerEvents="none" style={styles.horizontal} />
    <View pointerEvents="none" style={styles.vertical} />
    {points.map(pin => <View accessible accessibilityLabel={pin.label} testID={`delivery-pin-${pin.id}`} key={pin.id}
      style={[styles.pin, { backgroundColor: pin.color,
        left: `${50 + (pin.x - xMin - width / 2) * 72 / span}%`,
        top: `${50 - (pin.y - yMin - height / 2) * 72 / span}%` }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  map: { alignSelf: 'center', width: '100%', maxWidth: 300, aspectRatio: 1, backgroundColor: '#F3EEE5',
    borderWidth: 1, borderColor: palette.border, borderRadius: 14, overflow: 'hidden' },
  north: { position: 'absolute', left: 12, top: 8, color: palette.ink, fontSize: 13 },
  horizontal: { position: 'absolute', top: '50%', width: '100%', borderTopWidth: 1, borderColor: palette.border },
  vertical: { position: 'absolute', left: '50%', height: '100%', borderLeftWidth: 1, borderColor: palette.border },
  pin: { position: 'absolute', marginLeft: -8, marginTop: -8, width: 16, height: 16,
    borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: palette.muted, fontSize: 14, lineHeight: 20 },
});
