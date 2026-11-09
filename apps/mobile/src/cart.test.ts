// shortcut: @types/node arrives transitively via expo's jest-worker; add it as a devDependency if typecheck loses it.
/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";

import { addItem, emptyCart, prepareCheckout, setDiscount, setPaymentMethod, setQuantity, setVehicle, totals } from "./cart.ts";

const oli = { kind: "product", id: "11111111-1111-4111-8111-111111111111", name: "Oli Mesin 1L", unitPrice: 55_000, stockOnHand: 10 } as const;

test("menambah produk yang sama dua kali menjadi satu baris qty 2", () => {
  const cart = addItem(addItem(emptyCart(), oli), oli);

  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0].quantity, 2);
  assert.equal(totals(cart).subtotal, 110_000);
});

test("qty produk tidak melebihi stok, jasa tidak dibatasi stok", () => {
  const busi = { kind: "product", id: "22222222-2222-4222-8222-222222222222", name: "Busi", unitPrice: 25_000, stockOnHand: 1 } as const;
  const servis = { kind: "service", id: "33333333-3333-4333-8333-333333333333", name: "Servis Ringan", unitPrice: 50_000 } as const;

  const cart = setQuantity(addItem(addItem(addItem(emptyCart(), busi), busi), servis), servis, 3);

  assert.deepEqual(cart.lines.map((line) => line.quantity), [1, 3]);
  assert.equal(setQuantity(cart, busi, 0).lines.length, 1);
});

test("diskon mengurangi total, diskon melebihi subtotal tidak bisa checkout", () => {
  const cart = setDiscount(addItem(addItem(emptyCart(), oli), oli), 10_000);

  assert.deepEqual(totals(cart), { subtotal: 110_000, discount: 10_000, total: 100_000, checkoutError: null });
  assert.equal(totals(setDiscount(cart, 120_000)).checkoutError, "Diskon melebihi subtotal");
  assert.equal(totals(emptyCart()).checkoutError, "Keranjang masih kosong");
});

test("checkout memakai ulang Idempotency-Key saat retry, kunci baru bila cart berubah", () => {
  const vehicle = { id: "44444444-4444-4444-8444-444444444444", plateNumber: "B1234XYZ", customerName: "Budi" };
  const cart = setVehicle(setPaymentMethod(addItem(emptyCart(), oli), "qris"), vehicle);

  const first = prepareCheckout(cart, () => "key-1");
  assert.equal(first.idempotencyKey, "key-1");
  assert.deepEqual(first.body, {
    items: [{ kind: "product", id: oli.id, quantity: 1 }],
    discount: 0,
    paymentMethod: "qris",
    vehicleId: vehicle.id,
  });

  assert.equal(prepareCheckout(first.cart, () => "key-2").idempotencyKey, "key-1");
  assert.equal(prepareCheckout(addItem(first.cart, oli), () => "key-3").idempotencyKey, "key-3");
});
