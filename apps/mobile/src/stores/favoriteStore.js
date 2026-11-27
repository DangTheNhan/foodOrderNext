import { create } from 'zustand';

export const useFavoriteStore = create((set, get) => ({
  favorites: [],
  addFavorite: (food) => set((state) => ({
    favorites: [...state.favorites, food]
  })),
  removeFavorite: (foodId) => set((state) => ({
    favorites: state.favorites.filter((f) => f.id !== foodId)
  })),
  isFavorite: (foodId) => {
    return get().favorites.some((f) => f.id === foodId);
  }
}));
