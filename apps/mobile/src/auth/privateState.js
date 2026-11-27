import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelPendingRequests } from '../api/axiosClient';
import { useCartStore } from '../stores/cartStore';
import { useFavoriteStore } from '../stores/favoriteStore';
import { useFilterStore } from '../stores/filterStore';

export function clearPrivateState() {
  cancelPendingRequests();
  useCartStore.getState().clearCart();
  useFavoriteStore.setState({ favorites: [] });
  useFilterStore.getState().resetFilters();
}
export async function removeLegacySession() {
  await AsyncStorage.removeMany(['userToken', 'userData', 'auth-storage']);
}
