import React, { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useSession } from '../../auth/SessionContext';
import { realtimeData } from '../../services/realtimeData';
import { statusLabel } from '../../services/orderData';
import { Button, Card, Choice, Heading, Label, money, Muted, Notice, Page, Row, Tile } from '../P02/CustomerUI';
import { assignmentLabel, useOperation } from '../P04/OperationsUI';
import { LiveList, useLiveFeed, useScopedOrder } from './LiveRead';
import { DriverLocation } from '../P06/DriverLocation';

export function DriverTrips({ navigation }) {
  const [finished, setFinished] = useState(false);
  return <TripFeed key={String(finished)} navigation={navigation} finished={finished} changeTab={setFinished} />;
}

function TripFeed({ navigation, finished, changeTab }) {
  const uid = useSession().user.uid;
  const listen = useCallback((size, next, error) => realtimeData.listenOrders(
    { uid, role: 'driver', finished }, size, next, error), [uid, finished]);
  const older = useCallback((size, cursor) => realtimeData.olderOrders(
    { uid, role: 'driver', finished }, size, cursor), [uid, finished]);
  const feed = useLiveFeed({ listen, older });
  return <LiveList feed={feed} empty={finished ? 'Chưa có chuyến đã giao.' : 'Chưa có chuyến đang được phân công.'} testID="driver-trips"
    header={<Card>
      <Heading>Khu vực Tài xế</Heading>
      <Button outline title="Thông báo" testID="open-inbox" onPress={() => navigation.navigate('NotificationInbox')} />
      <Button outline title="Hồ sơ và bảo mật" testID="open-profile" onPress={() => navigation.navigate('Profile')} />
      <Row>
        <Choice title="Đang xử lý" selected={!finished} onPress={() => changeTab(false)} />
        <Choice title="Đã giao" selected={finished} onPress={() => changeTab(true)} />
      </Row>
    </Card>}
    render={order => <Tile title={order.shopNameSnapshot || 'Quán'} testID={`driver-order-${order.id}`}
      detail={`${statusLabel[order.status]} · ${assignmentLabel[order.assignmentStatus]}`}
      onPress={() => navigation.navigate('DriverOrderDetail', { orderId: order.id })} />} />;
}

export function DriverOrderDetail({ navigation, route }) {
  const uid = useSession().user.uid;
  const orderId = route.params.orderId;
  const observe = useCallback((next, error) => realtimeData.order({ uid, role: 'driver' }, orderId, next, error), [uid, orderId]);
  const state = useScopedOrder(observe);
  const order = state.order;
  return <Page>
    {state.waiting ? <ActivityIndicator /> : null}
    <Notice>{state.error || (state.stale ? 'Đang kết nối lại. Trạng thái còn chờ xác nhận.' : '')}</Notice>
    {state.error || state.waiting ? <Button outline title="Tải lại chuyến" onPress={state.retry} /> : null}
    {state.empty ? <Muted>Chuyến không còn được phân công.</Muted> : null}
    {order ? <TripActions key={order.id} uid={uid} order={order} stale={state.stale} navigation={navigation} /> : null}
  </Page>;
}

function TripActions({ uid, order, stale, navigation }) {
  const action = useOperation(uid);
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const waiting = receipt && (order.statusVersion < receipt.statusVersion || order.assignmentVersion < receipt.assignmentVersion);
  const disabled = Boolean(stale || action.busy || waiting);
  const accepted = order.assignmentStatus === 'ACCEPTED';
  const delivering = accepted && order.status === 'DELIVERING';
  const versions = { expectedStatusVersion: order.statusVersion, expectedAssignmentVersion: order.assignmentVersion };
  const submit = (command, input) => action.run(async () => {
    if (disabled) return;
    setReceipt(await action.write('post', `/orders/${order.id}/${command}`, input));
    setConfirming(false);
  });
  return <>
    <Heading>{order.shopNameSnapshot || 'Quán'}</Heading>
    <Label>{statusLabel[order.status]}</Label>
    <Muted>{assignmentLabel[order.assignmentStatus]}</Muted>
    <Card>
      <Label>{order.paymentStatus === 'COD_CONFIRMED' ? 'Đã thu COD' : 'COD'} · {money(order.amountDueVnd)}</Label>
      {accepted && order.addressSnapshot ? <Muted>{order.addressSnapshot.addressText}</Muted> : null}
    </Card>
    <Notice>{action.message}</Notice>
    {waiting ? <Muted>Đã ghi nhận. Đang đồng bộ trạng thái chuyến.</Muted> : null}
    {order.assignmentStatus === 'ASSIGNED' ? <Button title="Nhận chuyến" testID="accept-driver-trip" disabled={disabled}
      onPress={() => submit('accept-assignment', { expectedAssignmentVersion: order.assignmentVersion })} /> : null}
    {accepted && order.status === 'READY_FOR_PICKUP' ? <Button title="Xác nhận đã lấy món" testID="pickup-driver-trip"
      disabled={disabled} onPress={() => submit('pickup', versions)} /> : null}
    {delivering ? <>
      {confirming ? <Card>
        <Label>Đã giao món và nhận {money(order.amountDueVnd)}?</Label>
        <Button title="Xác nhận giao và thu COD" testID="confirm-driver-cod" disabled={disabled}
          onPress={() => submit('complete', { ...versions, codCollectedVnd: order.amountDueVnd })} />
        <Button outline title="Quay lại" disabled={action.busy} onPress={() => setConfirming(false)} />
      </Card> : <Button title="Hoàn tất giao hàng" testID="complete-driver-trip" disabled={disabled}
        onPress={() => setConfirming(true)} />}
    </> : null}
    {accepted ? <Button outline title="Tin nhắn theo đơn" testID="open-order-chat"
      disabled={stale} onPress={() => navigation.navigate('OrderChat', { orderId: order.id })} /> : null}
    {delivering ? <DriverLocation key={order.assignmentVersion} uid={uid} orderId={order.id}
      assignmentVersion={order.assignmentVersion} stale={stale} completing={confirming || Boolean(waiting)} /> : null}
  </>;
}
