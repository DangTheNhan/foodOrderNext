import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';
import { orderData, statusLabel } from '../../services/orderData';
import { realtimeData } from '../../services/realtimeData';
import { Button, Card, Choice, Field, Heading, Label, money, Muted, Notice, Page,
  Row, Tile, useAction } from '../P02/CustomerUI';
import { LiveList, useLiveFeed, useScopedOrder } from '../P05/LiveRead';

const dateLabel = value => value?.toDate?.()?.toLocaleString('vi-VN') ?? '';
const orderTitle = order => order.shopNameSnapshot || 'Quán';

export function OrderSuccessScreen({ navigation, route }) {
  const { receipt } = route.params;
  return <Page>
    <Heading>Đã gửi đơn cho quán</Heading>
    <Card>
      <Label>{statusLabel[receipt.status]}</Label>
      <Muted>Mã đơn · {receipt.orderId}</Muted>
      <Label>COD · {money(receipt.amountDueVnd)}</Label>
    </Card>
    <Button title="Xem chi tiết đơn" testID="open-order-detail"
      onPress={() => navigation.replace('CustomerOrderDetail', { orderId: receipt.orderId })} />
    <Button outline title="Về trang chủ" onPress={() => navigation.popToTop()} />
  </Page>;
}

export function OrderHistoryScreen({ navigation }) {
  const uid = useSession().user.uid;
  const listen = useCallback((count, next, error) => realtimeData.listenOrders({ uid, role: 'customer' }, count, next, error), [uid]);
  const older = useCallback((count, cursor) => realtimeData.olderOrders({ uid, role: 'customer' }, count, cursor), [uid]);
  const feed = useLiveFeed({ listen, older });
  return <LiveList feed={feed} empty="Bạn chưa có đơn nào."
    render={order => <Tile testID={`order-${order.id}`} title={orderTitle(order)} trailing={money(order.grandTotalVnd)}
      detail={`${statusLabel[order.status] ?? order.status} · ${dateLabel(order.createdAt)}`}
      onPress={() => navigation.navigate('CustomerOrderDetail', { orderId: order.id })} />} />;
}

export function OrderDetailScreen({ route, navigation }) {
  const uid = useSession().user.uid;
  const { orderId } = route.params;
  const observe = useCallback((next, error) => realtimeData.order({ uid, role: 'customer' }, orderId, next, error), [uid, orderId]);
  const state = useScopedOrder(observe);
  return <Page>
    {state.waiting ? <><ActivityIndicator /><Muted>Đang xác nhận trạng thái với máy chủ.</Muted></> : null}
    <Notice>{state.error || (state.stale ? 'Mất kết nối. Đang hiển thị trạng thái đã xác nhận gần nhất.' : '')}</Notice>
    {state.error || state.stale ? <Button outline title="Thử lại" onPress={state.retry} /> : null}
    {state.empty ? <Muted>Đơn không khả dụng.</Muted> : null}
    {state.order ? <OrderDetail order={state.order} uid={uid} navigation={navigation} stale={state.stale} /> : null}
  </Page>;
}

function OrderDetail({ order, uid, navigation, stale }) {
  const action = useAction();
  const intent = useRef(null);
  const { addressSnapshot: address } = order;
  const cancel = () => Alert.alert('Hủy đơn này?', 'Bạn có thể hủy khi quán chưa xác nhận.', [
    { text: 'Giữ đơn', style: 'cancel' },
    { text: 'Hủy đơn', style: 'destructive', onPress: () => action.run(async () => {
      if (intent.current?.version !== order.statusVersion) intent.current = { version: order.statusVersion, key: newIntentKey() };
      await orderData.cancel(uid, order.id, intent.current.version, intent.current.key);
    }) },
  ]);
  return <>
    <Heading>{statusLabel[order.status] ?? order.status}</Heading>
    <Muted>{orderTitle(order)} · {dateLabel(order.createdAt)}</Muted>
    <Muted>Mã đơn · {order.id}</Muted>
    <Card>
      {order.items.map(line => <Muted key={line.lineId}>
        {line.quantity} × {line.nameSnapshot} · {money(line.lineTotalVnd)}
        {line.optionsSnapshot?.length ? ` · ${line.optionsSnapshot.map(option => option.name).join(', ')}` : ''}
      </Muted>)}
      <Muted>Phí giao · {money(order.deliveryFeeVnd)}</Muted>
      {order.discountVnd > 0 ? <Muted>Ưu đãi · −{money(order.discountVnd)}</Muted> : null}
      <Label>Tổng · {money(order.grandTotalVnd)}</Label>
      {order.paymentStatus === 'COD_CONFIRMED' ? <Muted>Đã thu COD · {money(order.codCollectedVnd)}</Muted> : null}
    </Card>
    {address ? <Card><Label>{address.receiverName}</Label><Muted>{address.phone} · {address.addressText}</Muted></Card> : null}
    {order.note ? <Muted>Ghi chú · {order.note}</Muted> : null}
    <Notice>{action.message}</Notice>
    {order.status === 'DELIVERING' ? <Button title="Theo dõi giao món" testID="open-delivery-tracking" disabled={stale}
      onPress={() => navigation.navigate('CustomerDeliveryTracking', { orderId: order.id })} /> : null}
    <Button outline title="Tin nhắn theo đơn" testID="open-order-chat" disabled={stale}
      onPress={() => navigation.navigate('OrderChat', { orderId: order.id })} />
    {order.status === 'PENDING' ? <Button outline title="Hủy đơn" testID="cancel-order" disabled={action.busy || stale} onPress={cancel} /> : null}
    {order.status === 'COMPLETED' && order.paymentStatus === 'COD_CONFIRMED' ? (order.reviewId
      ? <Muted>Bạn đã đánh giá đơn này.</Muted>
      : <Button title="Đánh giá đơn" testID="open-review" disabled={stale} onPress={() => navigation.navigate('CustomerReview', { orderId: order.id })} />) : null}
  </>;
}

export function ReviewScreen({ navigation, route }) {
  const uid = useSession().user.uid;
  const { orderId } = route.params;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const intent = useRef(null);
  const action = useAction();
  return <Page>
    <Heading>Đánh giá trải nghiệm</Heading>
    <Row>{[1, 2, 3, 4, 5].map(value =>
      <Choice key={value} title={`${value} sao`} selected={rating === value}
        onPress={() => { if (!action.busy) setRating(value); }} />)}</Row>
    <Field label="Nội dung đánh giá" testID="review-text" multiline maxLength={3000}
      value={text} onChangeText={setText} editable={!action.busy} />
    <Muted>Đánh giá hiển thị công khai. Chỉ ghi nhận xét về món và trải nghiệm đặt hàng.</Muted>
    <Notice>{action.message}</Notice>
    <Button title="Gửi đánh giá" testID="send-review" disabled={!rating || !text.trim() || action.busy} onPress={() => action.run(async () => {
      const input = { rating, text: text.trim() };
      const fingerprint = JSON.stringify(input);
      if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: newIntentKey() };
      await orderData.review(uid, orderId, input, intent.current.key);
      navigation.goBack();
    })} />
  </Page>;
}
