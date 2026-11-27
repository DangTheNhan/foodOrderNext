/* eslint-env jest */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button, Muted, Tile } from '../src/screens/P02/CustomerUI';
import { ShopReport } from '../src/screens/P04/ShopScreens';
import { operationsData } from '../src/services/operationsData';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: effect => require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/auth/SessionContext', () => ({ useSession: () => ({ user: { uid: 'merchant' } }) }));
jest.mock('../src/services/operationsData', () => ({ operationsData: { report: jest.fn() } }));
jest.mock('../src/services/orderData', () => ({ statusLabel: { COMPLETED: 'Đã giao' } }));
jest.mock('../src/services/customerData', () => ({ imageUrl: jest.fn() }));

test('daily report keeps the first-page totals when loading a page with only order rows', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  operationsData.report
    .mockResolvedValueOnce({ day: '2026-01-02', createdCount: 21, completedCount: 18, codVnd: 92000,
      rows: [{ id: 'initial-order', status: 'COMPLETED', grandTotalVnd: 50000 }], cursor: 'next-page' })
    .mockResolvedValueOnce({ day: '2026-01-02',
      rows: [{ id: 'older-order', status: 'COMPLETED', grandTotalVnd: 42000 }], cursor: null });
  let tree;
  try {
    await act(async () => {
      tree = create(<ShopReport route={{ params: { shopId: 'shop1' } }} navigation={{ navigate: jest.fn() }} />);
    });
    const requestedDay = operationsData.report.mock.calls[0][2];
    const more = tree.root.findAllByType(Button).find(button => button.props.title === 'Xem thêm');
    await act(async () => { more.props.onPress(); });
    expect(operationsData.report).toHaveBeenLastCalledWith('merchant', 'shop1', requestedDay, 'next-page');
    expect(tree.root.findAllByType(Tile).map(row => row.props.detail)).toEqual(['initial-order', 'older-order']);
    expect(tree.root.findAllByType(Muted).some(row =>
      [].concat(row.props.children).join('') === 'Đơn giao và thu COD trong ngày · 18')).toBe(true);
  } finally {
    if (tree) await act(async () => tree.unmount());
    global.IS_REACT_ACT_ENVIRONMENT = false;
  }
});
