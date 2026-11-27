/* eslint-env jest */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MenuAssistant } from '../src/screens/P07/MenuAssistant';
import { ReviewInsights } from '../src/screens/P07/ReviewInsights';
import { askAi } from '../src/services/aiData';
import { customerData } from '../src/services/customerData';

jest.mock('@react-native-firebase/firestore', () => ({}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/firebase/runtime', () => ({}));
jest.mock('../src/api/axiosClient', () => ({}));
jest.mock('../src/auth/SessionContext', () => ({ useSession: () => ({ user: { uid: 'demo-account' } }) }));
jest.mock('../src/services/aiData', () => ({ askAi: jest.fn() }));
jest.mock('../src/services/customerData', () => ({
  ...jest.requireActual('../src/services/customerData'),
  customerData: { cart: jest.fn(), mutate: jest.fn() },
}));

const route = { params: { shopId: 'shop1', shopName: 'Quán demo' } };
const invocation = (tree, id, action, value) => act(async () => {
  const element = tree.root.findAllByProps({ testID: id }).find(node => typeof node.props[action] === 'function');
  element.props[action](value);
});

let tree;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = undefined;
});

test('AI menu requires confirmation before replacing a cart from a different shop', async () => {
  askAi.mockResolvedValue({ generatedBy: 'MODEL', quotedAt: '2026-11-20T00:00:00Z', subtotalVnd: 30_000,
    suggestions: [{ foodId: 'rice', name: 'Cơm', quantity: 1, optionIds: [], optionNames: [], lineTotalVnd: 30_000 }] });
  customerData.cart.mockResolvedValue({ shopId: 'shop2', version: 7, items: [{ foodId: 'old', optionIds: [], quantity: 1 }] });
  customerData.mutate.mockResolvedValue({});
  const navigation = { navigate: jest.fn() };
  await act(async () => { tree = create(<MenuAssistant route={route} navigation={navigation} />); });
  await invocation(tree, 'assistant-request', 'onChangeText', 'Cơm');
  await invocation(tree, 'run-menu-assistant', 'onPress');
  await invocation(tree, 'preview-assistant-cart', 'onPress');
  expect(tree.root.findAllByProps({ children: 'Thay giỏ của quán trước?' })).not.toHaveLength(0);
  expect(customerData.mutate).not.toHaveBeenCalled();
  await invocation(tree, 'confirm-assistant-cart', 'onPress');
  expect(customerData.mutate).toHaveBeenCalledWith('demo-account', 'put', '/me/cart',
    { shopId: 'shop1', expectedCartVersion: 7, items: [{ foodId: 'rice', quantity: 1, optionIds: [] }] }, expect.any(String));
  expect(navigation.navigate).toHaveBeenCalledWith('CustomerCart');
});

test('review insights show the true shortfall when the sample is too small', async () => {
  askAi.mockRejectedValue(Object.assign(new Error('Insufficient data'), {
    code: 'INSUFFICIENT_DATA', details: { sampleSize: 2 },
  }));
  await act(async () => { tree = create(<ReviewInsights route={route} />); });
  await invocation(tree, 'run-review-insights', 'onPress');
  expect(tree.root.findAllByProps({ children: 'Chưa đủ đánh giá' })).not.toHaveLength(0);
  const rendered = tree.root.findAll(node => Array.isArray(node.props.children)
    && node.props.children.join('').startsWith('2 đánh giá đã xác minh'));
  expect(rendered).not.toHaveLength(0);
  expect(tree.root.findAllByProps({ children: 'Kết quả từ mô hình AI' })).toHaveLength(0);
});
