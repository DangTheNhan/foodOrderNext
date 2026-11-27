import { create } from 'zustand';

export const useCartStore = create((set) => ({
  cartItems: [],
  addToCart: (food, quantity = 1) => set((state) => {
    const existingItem = state.cartItems.find((item) => item.food.id === food.id);
    if (existingItem) {
      return {
        cartItems: state.cartItems.map((item) =>
          item.food.id === food.id ? { ...item, quantity: item.quantity + quantity } : item
        )
      };
    }
    return { cartItems: [...state.cartItems, { food, quantity }] };
  }),
  removeFromCart: (foodId) => set((state) => ({
    cartItems: state.cartItems.filter((item) => item.food.id !== foodId)
  })),
  updateQuantity: (foodId, quantity) => set((state) => ({
    cartItems: state.cartItems.map((item) =>
      item.food.id === foodId ? { ...item, quantity } : item
    )
  })),
  clearCart: () => set({ cartItems: [] })
}));
