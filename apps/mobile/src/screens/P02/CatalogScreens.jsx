import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/SessionContext';
import { newIntentKey } from '../../api/clientCore';
import { cartLineKey, customerData, linePreview, mergeCartLines } from '../../services/customerData';
import { Button, Card, Choice, Field, FoodPhoto, Heading, Label, money, Muted, Notice,
  Page, PagedList, Row, Status, Tile, useAction, useRead } from './CustomerUI';

export function CustomerHome({ navigation }) {
  const { profile } = useSession();
  return <PagedList testID="customer-shops" load={customerData.shops} empty="Chưa có quán đang hoạt động."
    header={<View style={styles.header}>
      <Heading>Ăn gì hôm nay?</Heading>
      <Muted>{profile.displayName} · Quán trong khuôn viên</Muted>
      <Row>
        <Button title="Giỏ hàng" testID="open-cart" onPress={() => navigation.navigate('CustomerCart')} />
        <Button outline title="Đơn hàng" testID="open-order-history" onPress={() => navigation.navigate('CustomerOrderHistory')} />
        <Button outline title="Thông báo" testID="open-inbox" onPress={() => navigation.navigate('NotificationInbox')} />
        <Button outline title="Yêu thích" testID="open-favorites" onPress={() => navigation.navigate('CustomerFavorites')} />
        <Button outline title="Hồ sơ" testID="open-profile" onPress={() => navigation.navigate('Profile')} />
      </Row>
    </View>}
    render={shop => <Tile testID={`shop-${shop.id}`} title={shop.name}
      detail={`${shop.addressText ?? ''} · ${shop.acceptingOrders ? 'Đang nhận đơn' : 'Tạm ngừng nhận đơn'}`}
      onPress={() => navigation.navigate('Shop', { shopId: shop.id })} />} />;
}

export function ShopScreen({ navigation, route }) {
  const { shopId } = route.params;
  const shop = useRead(useCallback(() => customerData.shop(shopId), [shopId]));
  return <Page><Status resource={shop} empty="Quán hiện không còn hoạt động.">{item => <>
    <Heading>{item.name}</Heading>
    <Card>
      <Label>{item.acceptingOrders ? 'Đang nhận đơn' : 'Tạm ngừng nhận đơn'}</Label>
      <Muted>{item.addressText || 'Chưa công bố địa chỉ'}</Muted>
      <Muted>Giờ hoạt động · {item.openingHours?.label || 'Chưa công bố'}</Muted>
      <Muted>Phí giao dự kiến · {money(item.deliveryFeeVnd)}</Muted>
      <Muted>{item.ratingCount > 0 ? `${item.ratingAverage.toFixed(1)} / 5 · ${item.ratingCount} đánh giá` : 'Chưa có đánh giá'}</Muted>
    </Card>
    <Button title="Xem thực đơn" testID="open-menu" onPress={() => navigation.navigate('ShopMenu', { shopId })} />
    {item.acceptingOrders ? <Button outline title="Trợ lý chọn món" testID="open-menu-assistant"
      onPress={() => navigation.navigate('MenuAssistant', { shopId, shopName: item.name })} /> : null}
  </>}</Status></Page>;
}

export function MenuScreen({ navigation, route }) {
  const { shopId } = route.params;
  const categories = useRead(customerData.categories);
  const [mode, setMode] = useState('browse');
  const [draft, setDraft] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [filter, setFilter] = useState({ mode: 'browse' });
  const [validation, setValidation] = useState('');
  const load = useCallback(cursor => customerData.menu(shopId, filter, cursor), [shopId, filter]);

  function apply() {
    if (mode === 'price' && draft.trim() && !/^\d{1,9}$/.test(draft.trim())) {
      setValidation('Nhập giá tối đa bằng số nguyên VND.');
      return;
    }
    setValidation('');
    setFilter({ mode, categoryId, prefix: mode === 'name' ? draft.trim() : '',
      maxPrice: mode === 'price' && draft.trim() ? Number(draft) : null });
  }
  const header = <View style={styles.header}>
    <Row>{[['browse', 'Tất cả'], ['name', 'Theo tên'], ['price', 'Theo giá']].map(([key, label]) =>
      <Choice key={key} title={label} selected={mode === key} onPress={() => { setMode(key); setDraft(''); setValidation(''); }} />)}</Row>
    {mode === 'name' ? <Field label="Đầu tên món" placeholder="Ví dụ: com ga" maxLength={60} value={draft} onChangeText={setDraft} /> : null}
    {mode === 'price' ? <Field label="Giá tối đa (VND)" placeholder="Không giới hạn" maxLength={9}
      keyboardType="number-pad" value={draft} onChangeText={setDraft} /> : null}
    <Status resource={categories}>{rows => <Row>
      <Choice title="Mọi danh mục" selected={!categoryId} onPress={() => setCategoryId(null)} />
      {rows.map(item => <Choice key={item.id} title={item.name} selected={categoryId === item.id} onPress={() => setCategoryId(item.id)} />)}
    </Row>}</Status>
    <Notice>{validation}</Notice>
    <Button title="Áp dụng bộ lọc" outline onPress={apply} />
  </View>;
  return <PagedList load={load} header={header} empty="Không tìm thấy món phù hợp."
    render={food => <Tile testID={`food-${food.id}`} title={food.name}
      detail={food.availablePortions > 0 ? `Còn ${food.availablePortions} suất` : 'Hết suất'}
      trailing={money(food.priceVnd)} onPress={() => navigation.push('Food', { foodId: food.id })} />} />;
}

export function FoodScreen({ route, navigation }) {
  const { foodId } = route.params;
  const { user } = useSession();
  const load = useCallback(async () => {
    const food = await customerData.food(foodId);
    if (!food) return null;
    const [shop, saved] = await Promise.all([customerData.shop(food.shopId), customerData.isFavorite(user.uid, foodId)]);
    return { food, shop, saved };
  }, [foodId, user.uid]);
  const detail = useRead(load);
  return <Page><Status resource={detail} empty="Món này hiện không còn hiển thị.">{data =>
    <FoodDetail {...data} uid={user.uid} navigation={navigation} />}</Status></Page>;
}

function FoodDetail({ food, shop, saved: initialSaved, uid, navigation }) {
  const [saved, setSaved] = useState(initialSaved);
  const [optionIds, setOptionIds] = useState([]);
  const groupList = Array.isArray(food.optionGroups) ? food.optionGroups : [];
  const add = useAction();
  const favorite = useAction();
  const pendingCartWrite = useRef(null);
  const line = { foodId: food.id, quantity: 1, optionIds: [...optionIds].sort() };
  const preview = linePreview(food, line);
  const soldOut = food.availablePortions <= 0;
  function pick(group, id) {
    setOptionIds(ids => {
      if (ids.includes(id)) return ids.filter(value => value !== id);
      if (group.maxSelections === 1) {
        const next = ids.filter(value => !group.options.some(option => option.id === value));
        return next.length < 20 ? [...next, id] : ids;
      }
      if (group.options.filter(option => ids.includes(option.id)).length >= group.maxSelections || ids.length >= 20) return ids;
      return [...ids, id];
    });
  }
  async function sendCartIntent(intent) {
    try {
      await customerData.mutate(uid, 'put', '/me/cart', intent.body, intent.key);
      pendingCartWrite.current = null;
    } catch (error) {
      if (!['NETWORK_ERROR', 'TIMEOUT', 'DATA_SERVICE_UNAVAILABLE'].includes(error.code)) pendingCartWrite.current = null;
      throw error;
    }
  }
  async function commit(cart, replace) {
    const items = mergeCartLines(replace ? [] : cart.items, [line]);
    const body = { shopId: food.shopId, items, expectedCartVersion: cart.version };
    const intent = { body, key: newIntentKey(), lineKey: cartLineKey(line) };
    pendingCartWrite.current = intent;
    await sendCartIntent(intent);
  }
  function addToCart() {
    add.run(async () => {
      if (pendingCartWrite.current?.lineKey === cartLineKey(line)) {
        await sendCartIntent(pendingCartWrite.current);
        navigation.navigate('CustomerCart');
        return;
      }
      const cart = await customerData.cart(uid);
      if (cart.shopId && cart.shopId !== food.shopId && cart.items.length) {
        Alert.alert('Đổi quán?', 'Thay giỏ sẽ bỏ các món của quán hiện tại.', [
          { text: 'Giữ giỏ cũ', style: 'cancel' },
          { text: 'Thay giỏ', onPress: () => add.run(async () => {
            await commit(cart, true);
            navigation.navigate('CustomerCart');
          }) },
        ]);
        return;
      }
      await commit(cart, false);
      navigation.navigate('CustomerCart');
    });
  }
  return <>
    <FoodPhoto path={food.imagePath} name={food.name} />
    <Heading>{food.name}</Heading>
    <Label>{money(preview?.total ?? food.priceVnd)}</Label>
    <Muted>{food.description}</Muted>
    <Muted>{soldOut ? 'Hết suất' : `Còn ${food.availablePortions} suất`}</Muted>
    {!shop?.acceptingOrders ? <Notice>Quán tạm ngừng nhận đơn.</Notice> : null}
    {groupList.map(group => <Card key={group.id}><Label>{group.name}</Label>
      <Muted>Chọn {group.minSelections}–{group.maxSelections}</Muted>
      <Row>{group.options.map(option => <Choice key={option.id} selected={optionIds.includes(option.id)}
        title={option.priceDeltaVnd ? `${option.name} +${money(option.priceDeltaVnd)}` : option.name}
        onPress={() => pick(group, option.id)} />)}</Row>
    </Card>)}
    <Notice success={add.success}>{add.message}</Notice>
    <Button title="Thêm vào giỏ" testID="add-to-cart" disabled={add.busy || soldOut || !shop?.acceptingOrders || !preview} onPress={addToCart} />
    <Notice>{favorite.message}</Notice>
    <Button outline title={saved ? 'Bỏ yêu thích' : 'Lưu yêu thích'} testID="toggle-favorite" disabled={favorite.busy}
      onPress={() => favorite.run(async () => {
        await customerData.mutate(uid, saved ? 'delete' : 'put', `/me/favorites/${food.id}`);
        setSaved(!saved);
      })} />
  </>;
}

export function FavoritesScreen({ navigation }) {
  const { user } = useSession();
  const [revision, setRevision] = useState(0);
  const load = useCallback(cursor => customerData.favoritePage(user.uid, cursor), [user.uid]);
  const action = useAction();
  return <PagedList key={revision} refreshOnFocus load={load} empty="Bạn chưa lưu món nào."
    header={<Notice>{action.message}</Notice>}
    render={row => row.food
      ? <Tile title={row.food.name} detail={row.food.availablePortions > 0 ? money(row.food.priceVnd) : 'Hết suất'}
        onPress={() => navigation.push('Food', { foodId: row.foodId })} />
      : <Card><Muted>Món đã ẩn hoặc ngừng bán.</Muted><Button outline title="Bỏ yêu thích" disabled={action.busy}
        onPress={() => action.run(async () => {
          await customerData.mutate(user.uid, 'delete', `/me/favorites/${row.foodId}`);
          setRevision(value => value + 1);
        })} /></Card>} />;
}

const styles = StyleSheet.create({ header: { gap: 12, marginBottom: 12 } });
