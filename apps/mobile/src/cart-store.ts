import { create } from "zustand";

import { emptyCart, type Cart } from "./cart";

// Holds the in-progress sale only; catalog and stock stay in React Query.
export const useCart = create<{ cart: Cart; update: (change: (cart: Cart) => Cart) => void; reset: () => void }>((set) => ({
  cart: emptyCart(),
  update: (change) => set((state) => ({ cart: change(state.cart) })),
  reset: () => set({ cart: emptyCart() }),
}));
