import { create } from 'zustand';

export const useFilterStore = create((set) => ({
  filters: {
    category: 'all',
    priceRange: 'all',
    rating: 0,
    deliveryTime: 'any'
  },
  setFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),
  resetFilters: () => set({
    filters: {
      category: 'all',
      priceRange: 'all',
      rating: 0,
      deliveryTime: 'any'
    }
  })
}));
