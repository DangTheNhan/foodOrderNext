import React, { useCallback, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';
import { customerData } from '../../services/customerData';
import { orderData } from '../../services/orderData';
import { Button, Card, Choice, Field, Heading, Label, money, Muted, Notice, Page, Status, useAction, useRead } from '../P02/CustomerUI';

const ambiguousResponse = error => ['NETWORK_ERROR', 'TIMEOUT', 'DATA_SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'].includes(error.code);

function Totals({ quote }) {
  return <Card>
    <Label>{quote.shopName}</Label>
    {quote.items.map(item => <Muted key={item.lineId}>{item.quantity} × {item.nameSnapshot} · {money(item.lineTotalVnd)}</Muted>)}
    <Muted>Tiền món · {money(quote.subtotalVnd)}</Muted>
    {quote.discountVnd > 0 ? <Muted>Ưu đãi · −{money(quote.discountVnd)}</Muted> : null}
    <Muted>Phí giao · {money(quote.deliveryFeeVnd)}</Muted>
    <Label>Thu khi nhận món · {money(quote.grandTotalVnd)}</Label>
    <Muted>{quote.address.receiverName} · {quote.address.addressText}</Muted>
  </Card>;
}

export function CheckoutScreen({ navigation }) {
  const uid = useSession().user.uid;
  const load = useCallback(async () => {
    const [cart, addresses] = await Promise.all([customerData.cart(uid), customerData.addresses(uid)]);
    return { cart, addresses };
  }, [uid]);
  const resource = useRead(load);
  const [addressId, setAddressId] = useState('');
  const [note, setNote] = useState('');
  const [voucher, setVoucher] = useState('');
  const [priced, setPriced] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const attempt = useRef(null);
  const action = useAction();

  function place(payload, quote, version) {
    Keyboard.dismiss();
    action.run(async () => {
      if (!attempt.current) {
        attempt.current = { key: newIntentKey(), input: { ...payload, note: note.trim(), paymentMethod: 'COD',
          expectedGrandTotalVnd: quote.grandTotalVnd, expectedCartVersion: version, expectedQuoteKey: quote.quoteKey } };
      }
      const { input, key } = attempt.current;
      try {
        const result = await orderData.place(uid, input, key);
        attempt.current = null;
        setRetrying(false);
        navigation.replace('CustomerOrderSuccess', { receipt: result });
      } catch (error) {
        if (ambiguousResponse(error)) {
          setRetrying(true);
          throw new Error('Chưa nhận được kết quả. Thử lại hoặc kiểm tra lịch sử đơn hàng.');
        }
        attempt.current = null;
        setRetrying(false);
        if (error.code === 'PRICE_CHANGED' && error.details?.quote) {
          setPriced({ quote: error.details.quote, version, payload });
        } else {
          setPriced(null);
          if (error.code === 'CART_VERSION_CONFLICT') resource.retry();
        }
        throw error;
      }
    });
  }
  return <Page>
    <Heading>Thông tin giao hàng</Heading>
    <Notice>{action.message}</Notice>
    {retrying && priced ? <>
      <Totals quote={priced.quote} />
      <Button title="Thử nhận kết quả đặt đơn" testID="retry-order-create" disabled={action.busy}
        onPress={() => place(priced.payload, priced.quote, priced.version)} />
      <Button outline title="Xem lịch sử đơn" onPress={() => navigation.navigate('CustomerOrderHistory')} />
    </> : <Status resource={resource}>{({ cart, addresses }) => {
      if (!cart.items.length) return <>
        <Muted>Giỏ đang trống. Xem lịch sử nếu bạn vừa gửi đơn.</Muted>
        <Button outline title="Xem lịch sử đơn" onPress={() => navigation.navigate('CustomerOrderHistory')} />
      </>;
      const address = addresses.rows.find(row => row.id === addressId)
        ?? addresses.rows.find(row => row.id === addresses.defaultId) ?? addresses.rows[0];
      const payload = { shopId: cart.shopId, items: cart.items, addressId: address?.id,
        ...(voucher.trim() ? { voucherCode: voucher.trim() } : {}) };
      const quote = priced?.version === cart.version && priced.payload.addressId === address?.id ? priced.quote : null;
      return <>
        <Label>Địa chỉ nhận</Label>
        {addresses.rows.map(row => <Choice key={row.id} title={`${row.label} · ${row.addressText}`}
          selected={row.id === address?.id} onPress={() => {
            if (!action.busy) { setAddressId(row.id); setPriced(null); }
          }} />)}
        {!address ? <Muted>Thêm địa chỉ để nhận hàng.</Muted> : null}
        <Button outline title="Quản lý địa chỉ" disabled={action.busy}
          onPress={() => { setPriced(null); navigation.navigate('CustomerAddresses'); }} />
        <Field label="Ghi chú cho quán" value={note} onChangeText={setNote} editable={!action.busy} multiline maxLength={500} />
        <Field label="Mã ưu đãi" testID="checkout-voucher" value={voucher} editable={!action.busy}
          onChangeText={value => { setVoucher(value); setPriced(null); }} maxLength={40} />
        <Label>Thanh toán khi nhận hàng (COD)</Label>
        {quote ? <>
          <Totals quote={quote} />
          <Button title={action.busy ? 'Đang gửi…' : 'Xác nhận đặt đơn COD'} testID="confirm-order"
            disabled={action.busy} onPress={() => place(payload, quote, cart.version)} />
        </> : <Button title={action.busy ? 'Đang kiểm tra…' : 'Kiểm tra giá và ưu đãi'} testID="quote-order"
          disabled={!address || action.busy} onPress={() => {
            Keyboard.dismiss();
            action.run(async () => setPriced({ quote: await orderData.quote(uid, payload), version: cart.version, payload }));
          }} />}
      </>;
    }}</Status>}
  </Page>;
}
