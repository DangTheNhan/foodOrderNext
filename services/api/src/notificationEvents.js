const statusText = {
  PENDING: 'Đơn đang chờ quán xác nhận.',
  ACCEPTED: 'Quán đã nhận đơn.',
  PREPARING: 'Quán đang chuẩn bị món.',
  READY_FOR_PICKUP: 'Đơn đã sẵn sàng để lấy.',
  DELIVERING: 'Đơn đang được giao.',
  COMPLETED: 'Đơn đã giao xong.',
  CANCELLED: 'Đơn đã được hủy.',
  REJECTED: 'Quán đã từ chối đơn.',
};

export function writeNotification(db, tx, { eventId, orderId, type, actorUid, recipients, status, now, messageId = null }) {
  const recipientUids = [...new Set(recipients)].filter(uid => uid && uid !== actorUid);
  if (!recipientUids.length) return;
  const chat = type === 'ORDER_MESSAGE';
  const title = chat ? 'Tin nhắn về đơn hàng' : type === 'ORDER_ASSIGN_DRIVER' ? 'Cập nhật giao việc' : 'Cập nhật đơn hàng';
  const body = chat ? 'Mở cuộc trò chuyện để xem tin nhắn mới.'
    : type === 'ORDER_ASSIGN_DRIVER' ? 'Tài xế của đơn vừa thay đổi.'
      : type === 'ORDER_ACCEPT_ASSIGNMENT' ? 'Tài xế đã nhận chuyến.' : statusText[status] ?? 'Mở đơn để xem cập nhật.';
  const target = chat ? 'CHAT' : 'ORDER';
  for (const uid of recipientUids) {
    const inbox = db.collection('users').doc(uid).collection('notifications').doc(eventId);
    tx.create(inbox, { type, target, orderId, title, body, createdAt: now, readAt: null });
  }
  tx.create(db.collection('notificationOutbox').doc(eventId), {
    type, orderId, messageId, recipientUids, status: 'PENDING', attempts: 0,
    nextAttemptAt: now, leaseOwner: null, leaseId: null, leaseUntil: null,
    createdAt: now, lastErrorCode: null, deliveredTokenHashes: [],
  });
}
