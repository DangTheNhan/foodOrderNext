import React, { useState } from 'react';
import { useSession } from '../../auth/SessionContext';
import { askAi } from '../../services/aiData';
import { customerData, mergeCartLines, cartLineKey } from '../../services/customerData';
import { newIntentKey } from '../../api/clientCore';
import { Button, Card, Choice, Field, Heading, Label, money, Muted, Notice,
  Page, Row, Tile, useAction } from '../P02/CustomerUI';
import { AiStatus } from './AiStatus';

const prefs = [['VALUE', 'Ưu tiên giá'], ['VARIETY', 'Nhiều món']];

export function MenuAssistant({ route, navigation }) {
  const uid = useSession().user.uid;
  const { shopId, shopName } = route.params;
  const [requestText, setRequestText] = useState('');
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState('1');
  const [preferences, setPreferences] = useState([]);
  const [result, setResult] = useState(null);
  const [intent, setIntent] = useState(null);
  const query = useAction();
  const cart = useAction();
  const locked = query.busy || cart.busy || Boolean(intent);

  function edit(setter, value) {
    setter(value);
    setResult(null);
  }

  function submit() {
    query.run(async () => {
      if (!requestText.trim()) throw new Error('Nhập món hoặc nhu cầu bạn đang tìm.');
      if (!/^([1-9]|1[0-2])$/.test(people.trim())) throw new Error('Nhập số người từ 1 đến 12.');
      const value = budget.trim();
      if (value && (!/^\d{1,9}$/.test(value) || Number(value) < 1)) throw new Error('Nhập ngân sách bằng số nguyên VND.');
      setResult(null);
      setResult(await askAi(uid, 'menu-assistant', { shopId, requestText: requestText.trim(),
        diners: Number(people), preferences, ...(value ? { budgetVnd: Number(value) } : {}) }));
    });
  }

  function preview() {
    cart.run(async () => {
      const current = await customerData.cart(uid);
      const replaces = Boolean(current.shopId && current.shopId !== shopId && current.items.length);
      const selected = result.suggestions.map(({ foodId, optionIds, quantity }) => ({ foodId, optionIds, quantity }));
      const items = mergeCartLines(replaces ? [] : current.items, selected);
      const body = { shopId, items, expectedCartVersion: current.version };
      setIntent({ body, replaces, key: newIntentKey() });
    });
  }

  return <Page>
    <Heading>Trợ lý chọn món</Heading>
    <Muted>{shopName}</Muted>
    <Card>
      <Field label="Bạn muốn ăn gì?" testID="assistant-request" value={requestText} maxLength={1000}
        multiline editable={!locked} placeholder="Ví dụ: cơm cho hai người" onChangeText={text => edit(setRequestText, text)} />
      <Field label="Số người" testID="assistant-diners" value={people} maxLength={2}
        keyboardType="number-pad" editable={!locked} onChangeText={text => edit(setPeople, text)} />
      <Field label="Ngân sách món (VND, tùy chọn)" testID="assistant-budget" value={budget} maxLength={9}
        keyboardType="number-pad" editable={!locked} onChangeText={text => edit(setBudget, text)} />
      <Row>{prefs.map(([key, label]) => <Choice key={key} title={label} selected={preferences.includes(key)}
        onPress={() => !locked && edit(setPreferences,
          preferences.includes(key) ? preferences.filter(item => item !== key) : [...preferences, key])} />)}</Row>
      <Button title={query.busy ? 'Đang tìm món…' : 'Tìm món phù hợp'} testID="run-menu-assistant"
        disabled={locked || !requestText.trim()} onPress={submit} />
      <Notice>{query.message}</Notice>
    </Card>
    {result ? <>
      <Card>
        <AiStatus result={result} date={result.quotedAt} />
        <Muted>{result.explanation}</Muted>
        {result.sampled ? <Muted>Kết quả dựa trên một phần thực đơn đang bán.</Muted> : null}
      </Card>
      {result.suggestions.map(line => <Tile key={cartLineKey(line)} title={line.quantity + ' × ' + line.name}
        trailing={money(line.lineTotalVnd)} testID={'assistant-food-' + line.foodId}
        detail={[...line.optionNames, line.reason].join(' · ')}
        onPress={() => navigation.push('Food', { foodId: line.foodId })} />)}
      {result.suggestions.length ? <>
        <Label>Tiền món · {money(result.subtotalVnd)}</Label>
        <Muted>Kiểm tra thành phần và dị ứng với quán trước khi đặt.</Muted>
        <Notice>{cart.message}</Notice>
        {intent ? <Card>
          <Label>{intent.replaces ? 'Thay giỏ của quán trước?' : 'Thêm gợi ý vào giỏ?'}</Label>
          {intent.replaces ? <Muted>Giỏ sẽ giữ các món của quán này sau khi xác nhận.</Muted> : null}
          <Button title="Xác nhận thêm vào giỏ" testID="confirm-assistant-cart" disabled={cart.busy}
            onPress={() => cart.run(async () => {
              await customerData.mutate(uid, 'put', '/me/cart', intent.body, intent.key);
              setIntent(null);
              navigation.navigate('CustomerCart');
            })} />
          <Button outline title="Quay lại" disabled={cart.busy} onPress={() => setIntent(null)} />
        </Card> : <Button title="Xem trước khi thêm giỏ" testID="preview-assistant-cart" disabled={cart.busy} onPress={preview} />}
      </> : <Button outline title="Xem thực đơn" onPress={() => navigation.navigate('ShopMenu', { shopId })} />}
    </> : null}
  </Page>;
}
