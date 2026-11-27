import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useSession } from '../../auth/SessionContext';
import { operationsData } from '../../services/operationsData';
import { realtimeData } from '../../services/realtimeData';
import { statusLabel } from '../../services/orderData';
import { Button, Card, Choice, Heading, Label, money, Muted, Notice, Page, PagedList, Row, Tile } from '../P02/CustomerUI';
import { assignmentLabel, useOperation } from './OperationsUI';
import { LiveList, useLiveFeed, useScopedOrder } from '../P05/LiveRead';

const queueStatuses = [['PENDING', 'Chờ xác nhận'], ['ACCEPTED', 'Đã nhận'], ['PREPARING', 'Đang làm'],
  ['READY_FOR_PICKUP', 'Sẵn sàng'], ['DELIVERING', 'Đang giao']];
const nextStatus = { PENDING: ['ACCEPTED', 'Nhận đơn'], ACCEPTED: ['PREPARING', 'Bắt đầu chế biến'],
  PREPARING: ['READY_FOR_PICKUP', 'Sẵn sàng giao'] };

export function MerchantQueue({ route, navigation }) {
  const { user, profile } = useSession();
  const uid = user.uid;
  const role = profile.role;
  const { shopId } = route.params;
  const [status, setStatus] = useState('PENDING');
  const listen = useCallback((size, next, error) => realtimeData.listenOrders({ uid, shopId, status, role }, size, next, error),
    [shopId, status, uid, role]);
  const feed = useLiveFeed({ listen });
  return <LiveList feed={feed} empty="Chưa có đơn ở trạng thái này."
    header={<Card><Row>{queueStatuses.map(([value, title]) => <Choice key={value} title={title} selected={status === value}
      onPress={() => setStatus(value)} />)}</Row>
      <Button outline title="Tải hàng đợi" onPress={feed.retry} />
    </Card>}
    render={order => <Tile title={order.addressSnapshot?.receiverName || 'Đơn hàng'} testID={`merchant-order-${order.id}`}
      detail={`${statusLabel[order.status]} · ${assignmentLabel[order.assignmentStatus]}`} trailing={money(order.grandTotalVnd)}
      onPress={() => navigation.navigate('MerchantOrderDetail', { shopId, orderId: order.id })} />} />;
}

export function MerchantOrderDetail({ route, navigation }) {
  const { shopId, orderId } = route.params;
  const { user, profile } = useSession();
  const observe = useCallback((next, error) => realtimeData.order({ uid: user.uid, shopId, role: profile.role }, orderId, next, error),
    [shopId, orderId, user.uid, profile.role]);
  const state = useScopedOrder(observe);
  return <Page>
    {state.waiting ? <ActivityIndicator accessibilityLabel="Đang tải trạng thái đơn" /> : null}
    <Notice>{state.error || (state.stale ? 'Đang kết nối lại. Trạng thái còn chờ xác nhận.' : '')}</Notice>
    {state.empty ? <Muted>Đơn không khả dụng.</Muted> : null}
    {state.error || state.waiting || state.stale ? <Button outline title="Tải lại đơn" onPress={state.retry} /> : null}
    {state.order ? <OrderPanel order={state.order} uid={user.uid} role={profile.role} navigation={navigation} stale={state.stale} /> : null}
  </Page>;
}

function OrderPanel({ order, uid, role, navigation, stale }) {
  const action = useOperation(uid);
  const next = nextStatus[order.status];
  const canAssign = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status) && order.assignmentStatus !== 'ACCEPTED';
  const expectedStatusVersion = order.statusVersion;
  const command = (name, input) => action.run(() => action.write('post', `/orders/${order.id}/${name}`, {
    expectedStatusVersion, ...input,
  }));
  function reject() {
    Alert.alert('Từ chối đơn?', 'Chọn lý do để hoàn suất và ưu đãi cho đơn.', [
      { text: 'Giữ đơn', style: 'cancel' },
      { text: 'Quán quá tải', onPress: () => command('reject', { reasonCode: 'CAPACITY' }) },
      { text: 'Món không khả dụng', style: 'destructive', onPress: () => command('reject', { reasonCode: 'ITEM_UNAVAILABLE' }) },
    ]);
  }
  return <>
    <Heading>{statusLabel[order.status]}</Heading>
    <Muted>Mã đơn · {order.id}</Muted>
    <Card>
      <Label>{order.addressSnapshot?.receiverName}</Label>
      <Muted>{order.addressSnapshot?.phone} · {order.addressSnapshot?.addressText}</Muted>
      {order.note ? <Muted>Ghi chú · {order.note}</Muted> : null}
    </Card>
    <Card>
      {order.items.map(item => <Muted key={item.lineId}>
        {item.quantity} × {item.nameSnapshot} · {money(item.lineTotalVnd)}
        {item.optionsSnapshot?.length ? ` · ${item.optionsSnapshot.map(option => option.name).join(', ')}` : ''}
      </Muted>)}
      <Label>COD · {money(order.amountDueVnd)}</Label>
    </Card>
    <Card>
      <Label>{assignmentLabel[order.assignmentStatus]}</Label>
      {order.driverUid ? <Muted>Mã tài xế · {order.driverUid}</Muted> : null}
    </Card>
    <Notice>{action.message}</Notice>
    <Button outline title="Tin nhắn theo đơn" testID="open-order-chat" disabled={stale}
      onPress={() => navigation.navigate('OrderChat', { orderId: order.id })} />
    {role === 'merchant' && next ? <Button title={next[1]} testID="merchant-transition" disabled={action.busy || stale}
      onPress={() => command('transitions', { targetStatus: next[0] })} /> : null}
    {order.status === 'PENDING' ? <Button outline title="Từ chối đơn" disabled={action.busy || stale} onPress={reject} /> : null}
    {canAssign ? <Button outline title={order.driverUid ? 'Đổi tài xế' : 'Gán tài xế'} testID="open-assignment" disabled={action.busy || stale}
      onPress={() => navigation.navigate('AssignDriver', { shopId: order.shopId, orderId: order.id, currentDriver: order.driverUid,
        expectedStatusVersion, expectedAssignmentVersion: order.assignmentVersion })} /> : null}
  </>;
}

export function AssignDriver({ route, navigation }) {
  const uid = useSession().user.uid;
  const { shopId, orderId, currentDriver, expectedStatusVersion, expectedAssignmentVersion } = route.params;
  const load = useCallback(async cursor => {
    const result = await operationsData.drivers(uid, shopId, cursor);
    return { ...result, rows: result.rows.filter(driver => driver.assignable && driver.id !== currentDriver) };
  }, [uid, shopId, currentDriver]);
  const action = useOperation(uid);
  return <PagedList load={load} empty="Chưa có tài xế đủ điều kiện ở trang này."
    header={<Card><Label>Chọn tài xế của quán</Label><Notice>{action.message}</Notice></Card>}
    render={driver => <Button outline title={driver.name} testID={`assign-${driver.id}`} disabled={action.busy}
      onPress={() => action.run(async () => {
        await action.write('post', `/orders/${orderId}/assign-driver`, {
          driverUid: driver.id, expectedStatusVersion, expectedAssignmentVersion,
        });
        navigation.goBack();
      })} />} />;
}

export function ShopDrivers({ route, navigation }) {
  const { user, profile } = useSession();
  const { shopId } = route.params;
  const admin = profile.role === 'admin';
  const load = useCallback(cursor => operationsData.drivers(user.uid, shopId, cursor), [user.uid, shopId]);
  const [revision, setRevision] = useState(0);
  const action = useOperation(user.uid);
  return <PagedList key={revision} load={load} refreshOnFocus empty="Chưa có tài xế trong danh sách này."
    header={<Card>
      {admin ? <Button title="Duyệt tài xế cho quán" testID="open-driver-approval" onPress={() => navigation.navigate('ApproveDriver', { shopId })} />
        : <Label>Tài xế đủ điều kiện phân công</Label>}
      <Notice>{action.message}</Notice>
    </Card>}
    render={driver => <Card>
      <Label>{driver.name}</Label>
      <Muted>{driver.assignable ? 'Đủ điều kiện phân công' : 'Chưa đủ điều kiện'}</Muted>
      {admin && driver.assignable ? <Button outline title="Thu hồi quyền tại quán" disabled={action.busy} onPress={() => action.run(async () => {
        await action.write('put', `/shops/${shopId}/drivers/${encodeURIComponent(driver.id)}`, { approved: false, active: false });
        setRevision(value => value + 1);
      })} /> : null}
    </Card>} />;
}
