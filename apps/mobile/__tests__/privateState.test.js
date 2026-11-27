import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPrivateState, removeLegacySession } from '../src/auth/privateState';
import { cancelPendingRequests } from '../src/api/axiosClient';
import { useCartStore } from '../src/stores/cartStore';
import { useFavoriteStore } from '../src/stores/favoriteStore';
import { useFilterStore } from '../src/stores/filterStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'));
jest.mock('../src/api/axiosClient', () => ({ cancelPendingRequests: jest.fn() }));

test('session migration uses the installed storage API and preserves unrelated preferences', async () => {
  await AsyncStorage.setMany({ userToken: 'old-session', userData: 'old-profile',
    'auth-storage': 'old-auth', themePreference: 'light' });
  await removeLegacySession();
  await expect(AsyncStorage.getMany(['userToken', 'userData', 'auth-storage', 'themePreference']))
    .resolves.toEqual({ userToken: null, userData: null, 'auth-storage': null, themePreference: 'light' });
});

test('account switch clears prior cart favorites filters and pending requests', () => {
  useCartStore.setState({ cartItems: [{ food: { id: 'private-food' }, quantity: 1 }] });
  useFavoriteStore.getState().addFavorite({ id: 'private-food' });
  useFilterStore.getState().setFilter('category', 'private-category');
  clearPrivateState();
  expect(cancelPendingRequests).toHaveBeenCalled();
  expect(useCartStore.getState().cartItems).toEqual([]);
  expect(useFavoriteStore.getState().favorites).toEqual([]);
  expect(useFilterStore.getState().filters.category).toBe('all');
});
