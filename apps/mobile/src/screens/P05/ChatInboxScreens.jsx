import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';
import { openInboxEvent, realtimeData } from '../../services/realtimeData';
import { Button, Card, Field, Heading, Label, Muted, Notice, Page, Status, Tile, useAction, useRead } from '../P02/CustomerUI';
import { LiveList, useLiveFeed, useScopedOrder } from './LiveRead';

const dateLabel = value => value?.toDate?.()?.toLocaleString('vi-VN') ?? '';
const closedStatuses = ['COMPLETED', 'CANCELLED', 'REJECTED'];

export function OrderChatScreen({ route }) {
  const { user, profile } = useSession();
  const orderId = route.params.orderId;
  const key = `${user.uid}:${orderId}:${profile.driverAuthorityVersion ?? 0}`;
  return <AuthorizedChat key={key} uid={user.uid} orderId={orderId} />;
}

function AuthorizedChat({ uid, orderId }) {
  const access = useRead(useCallback(() => realtimeData.access(uid, orderId), [uid, orderId]));
  if (!access.data?.canReadChat) {
    return <Page><Status resource={access}>{() => <Muted>Cuộc trò chuyện không khả dụng với tài khoản này.</Muted>}</Status></Page>;
  }
  return <Room uid={uid} orderId={orderId} role={access.data.role} shopId={access.data.shopId} />;
}

function Room({ uid, orderId, role, shopId }) {
  const listen = useCallback((size, next, error) => realtimeData.listenChat(uid, orderId, size, next, error), [uid, orderId]);
  const older = useCallback((size, cursor) => realtimeData.olderChat(uid, orderId, size, cursor), [uid, orderId]);
  const observe = useCallback((next, error) => realtimeData.order({ uid, shopId, role }, orderId, next, error), [uid, shopId, role, orderId]);
  const feed = useLiveFeed({ listen, older, pageSize: 30 });
  const scope = useScopedOrder(observe);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(null);
  const sending = useRef(false);
  const order = scope.order;
  const stillOpen = order && !closedStatuses.includes(order.status) && role !== 'admin'
    && (role !== 'driver' || order.assignmentStatus === 'ACCEPTED');
  const enabled = Boolean(stillOpen && !scope.stale && !feed.stale && !feed.error);

  useEffect(() => {
    if (pending && feed.rows.some(row => row.senderUid === uid && row.clientMessageId === pending.clientMessageId)) {
      setPending(null);
    }
  }, [pending, feed.rows, uid]);

  async function send(intent) {
    if (!enabled || sending.current) return;
    sending.current = true;
    setPending({ ...intent, phase: 'sending' });
    try {
      await realtimeData.send(uid, orderId, { clientMessageId: intent.clientMessageId, text: intent.text }, intent.key);
      setPending(previous => previous?.key === intent.key ? { ...previous, phase: 'confirmed', error: null } : previous);
    } catch (error) {
      setPending(previous => previous?.key === intent.key ? { ...previous, phase: 'failed',
        error: error.message || 'Không gửi được tin nhắn.' } : previous);
    } finally { sending.current = false; }
  }

  return <LiveList feed={feed} empty="Chưa có tin nhắn." testID="chat-messages"
    header={<><Heading>Tin nhắn theo đơn</Heading><Muted>Tin mới nhất ở đầu danh sách.</Muted></>}
    render={message => <Card>
      <Label>{message.senderUid === uid ? 'Bạn' : message.senderDisplayNameSnapshot}</Label>
      <Muted>{message.text}</Muted>
      <Muted>{dateLabel(message.sentAt)}</Muted>
    </Card>}
    dock={pending || enabled ? <Card>
      {pending ? <>
        <Muted>{pending.text}</Muted>
        <Muted>{pending.phase === 'sending' ? 'Đang gửi…' : pending.phase === 'confirmed' ? 'Đã gửi, đang đồng bộ…' : 'Chưa nhận được xác nhận gửi.'}</Muted>
        <Notice>{pending.error}</Notice>
        {pending.phase === 'failed' ? <Button outline title="Thử gửi lại" disabled={!enabled} onPress={() => send(pending)} /> : null}
      </> : <>
        <Field label="Tin nhắn" value={draft} onChangeText={setDraft} testID="chat-draft" maxLength={2000} multiline />
        <Button title="Gửi tin nhắn" testID="send-chat" disabled={!enabled || !draft.trim()} onPress={() => {
          const intent = { clientMessageId: newIntentKey(), key: newIntentKey(), text: draft.trim() };
          Keyboard.dismiss();
          setDraft('');
          send(intent);
        }} />
      </>}
    </Card> : <Muted>{order && !stillOpen ? 'Lịch sử cuộc trò chuyện · Đóng gửi tin mới.'
      : 'Chờ kết nối và xác minh quyền gửi.'}</Muted>} />;
}

export function NotificationInbox({ navigation }) {
  const uid = useSession().user.uid;
  const listen = useCallback((size, next, error) => realtimeData.listenInbox(uid, size, next, error), [uid]);
  const older = useCallback((size, cursor) => realtimeData.olderInbox(uid, size, cursor), [uid]);
  const feed = useLiveFeed({ listen, older });
  const action = useAction();
  return <LiveList feed={feed} empty="Chưa có thông báo." testID="notification-list"
    header={<Notice>{action.message}</Notice>}
    render={event => <Card>
      <Tile title={event.title} detail={`${event.body} · ${dateLabel(event.createdAt)}`}
        trailing={event.readAt ? 'Đã đọc' : 'Mới'} testID={`inbox-${event.id}`}
        onPress={() => action.run(() => openInboxEvent(uid, event.id, navigation.navigate))} />
      {!event.readAt ? <Button outline title="Đánh dấu đã đọc" disabled={action.busy} onPress={() => action.run(
        () => realtimeData.markRead(uid, event.id))} /> : null}
    </Card>} />;
}
