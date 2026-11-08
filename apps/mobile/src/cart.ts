// Pure cart rules. UI state lives in cart-store.ts; the API stays the source of truth at checkout.
export type CartItem = {
  kind: "product" | "service";
  id: string;
  name: string;
  unitPrice: number;
  stockOnHand?: number;
};

export type CartLine = CartItem & { quantity: number };

export type PaymentMethod = "cash" | "qris" | "bank_transfer";

export type CartVehicle = { id: string; plateNumber: string | null; customerName: string };

export type Cart = {
  lines: CartLine[];
  discount: number;
  paymentMethod: PaymentMethod;
  vehicle: CartVehicle | null;
  // Kept across retries of the same cart so a lost response cannot create a second sale.
  idempotencyKey: string | null;
};

export function emptyCart(): Cart {
  return { lines: [], discount: 0, paymentMethod: "cash", vehicle: null, idempotencyKey: null };
}

// Every content change invalidates the key: a retry must never replay a different cart.
function changed(cart: Cart, patch: Partial<Cart>): Cart {
  return { ...cart, ...patch, idempotencyKey: null };
}

function findLine(cart: Cart, item: CartItem) {
  return cart.lines.find((line) => line.kind === item.kind && line.id === item.id);
}

export function addItem(cart: Cart, item: CartItem): Cart {
  return setQuantity(cart, item, (findLine(cart, item)?.quantity ?? 0) + 1);
}

// Products are capped at the stock shown in the catalog; the API re-checks stock under a row lock.
export function setQuantity(cart: Cart, item: CartItem, quantity: number): Cart {
  const max = item.kind === "product" ? (item.stockOnHand ?? 0) : Infinity;
  const next = Math.min(quantity, max);
  const existing = findLine(cart, item);
  if (next <= 0) return changed(cart, { lines: cart.lines.filter((line) => line !== existing) });
  if (!existing) return changed(cart, { lines: [...cart.lines, { ...item, quantity: next }] });
  return changed(cart, { lines: cart.lines.map((line) => (line === existing ? { ...line, quantity: next } : line)) });
}

export function setDiscount(cart: Cart, discount: number): Cart {
  return changed(cart, { discount: Math.max(0, Math.trunc(discount) || 0) });
}

export function setPaymentMethod(cart: Cart, paymentMethod: PaymentMethod): Cart {
  return changed(cart, { paymentMethod });
}

export function setVehicle(cart: Cart, vehicle: CartVehicle | null): Cart {
  return changed(cart, { vehicle });
}

export function totals(cart: Cart) {
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const checkoutError =
    cart.lines.length === 0 ? "Keranjang masih kosong"
      : cart.discount > subtotal ? "Diskon melebihi subtotal"
        : null;
  return { subtotal, discount: cart.discount, total: subtotal - cart.discount, checkoutError };
}

export function prepareCheckout(cart: Cart, makeKey: () => string) {
  const idempotencyKey = cart.idempotencyKey ?? makeKey();
  return {
    cart: { ...cart, idempotencyKey },
    idempotencyKey,
    body: {
      items: cart.lines.map(({ kind, id, quantity }) => ({ kind, id, quantity })),
      discount: cart.discount,
      paymentMethod: cart.paymentMethod,
      ...(cart.vehicle ? { vehicleId: cart.vehicle.id } : {}),
    },
  };
}
