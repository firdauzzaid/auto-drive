import assert from "node:assert/strict";
import test from "node:test";

import { completeSale } from "../src/modules/sales/complete-sale.ts";

test("completes a paid product sale with stock movement and immutable price snapshots", async () => {
  const writes: Array<{ type: string; value: unknown }> = [];
  const port = {
    async inTransaction<T>(work: () => Promise<T>) {
      return work();
    },
    async lockProducts(ids: string[]) {
      assert.deepEqual(ids, ["product-oil"]);
      return [
        {
          id: "product-oil",
          name: "Oli MPX2",
          sku: "MPX2",
          stockOnHand: 5,
          sellingPrice: 95000,
          currentCost: 70000,
          active: true,
        },
      ];
    },
    async validateSaleReferences() {
      return true;
    },
    async createSale(value: unknown) {
      writes.push({ type: "sale", value });
      return { id: "sale-1" };
    },
    async createSaleItems(value: unknown) {
      writes.push({ type: "items", value });
    },
    async createPayment(value: unknown) {
      writes.push({ type: "payment", value });
    },
    async applyInventoryMovements(value: unknown) {
      writes.push({ type: "movement", value });
    },
  };

  const sale = await completeSale(
    {
      workshopId: "workshop-1",
      customerId: "customer-1",
      vehicleId: "vehicle-1",
      items: [{ kind: "product", id: "product-oil", quantity: 2 }],
      paymentMethod: "cash",
    },
    { userId: "cashier-1", role: "cashier" },
    port,
  );

  assert.deepEqual(sale, { id: "sale-1", total: 190000 });
  assert.deepEqual(writes, [
    {
      type: "sale",
      value: {
        workshopId: "workshop-1",
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        completedBy: "cashier-1",
        subtotal: 190000,
        discount: 0,
        total: 190000,
        idempotencyKey: null,
      },
    },
    {
      type: "items",
      value: [
        {
          saleId: "sale-1",
          productId: "product-oil",
          serviceId: null,
          nameSnapshot: "Oli MPX2",
          skuSnapshot: "MPX2",
          quantity: 2,
          unitPrice: 95000,
          unitCost: 70000,
          lineTotal: 190000,
        },
      ],
    },
    {
      type: "payment",
      value: {
        saleId: "sale-1",
        method: "cash",
        amount: 190000,
        receivedBy: "cashier-1",
      },
    },
    {
      type: "movement",
      value: [
        {
          workshopId: "workshop-1",
          productId: "product-oil",
          saleId: "sale-1",
          previousStock: 5,
          quantityChange: -2,
          newStock: 3,
          reason: "sale",
          createdBy: "cashier-1",
        },
      ],
    },
  ]);
});

test("rejects duplicate cart lines when their combined quantity exceeds stock", async () => {
  const port = {
    async inTransaction<T>(work: () => Promise<T>) {
      return work();
    },
    async lockProducts() {
      return [
        {
          id: "product-oil",
          name: "Oli MPX2",
          sku: "MPX2",
          stockOnHand: 5,
          sellingPrice: 95000,
          currentCost: 70000,
          active: true,
        },
      ];
    },
    async validateSaleReferences() {
      return true;
    },
    async createSale() {
      throw new Error("must not create a sale");
    },
    async createSaleItems() {},
    async createPayment() {},
    async applyInventoryMovements() {},
  };

  await assert.rejects(
    completeSale(
      {
        workshopId: "workshop-1",
        items: [
          { kind: "product", id: "product-oil", quantity: 3 },
          { kind: "product", id: "product-oil", quantity: 3 },
        ],
        paymentMethod: "cash",
      },
      { userId: "cashier-1", role: "cashier" },
      port,
    ),
    /Insufficient stock/,
  );
});

test("applies each inventory change through the movement interface", async () => {
  const movements: unknown[] = [];
  const port = {
    async inTransaction<T>(work: () => Promise<T>) {
      return work();
    },
    async lockProducts() {
      return [
        {
          id: "product-oil",
          name: "Oli MPX2",
          sku: "MPX2",
          stockOnHand: 2,
          sellingPrice: 95000,
          currentCost: 70000,
          active: true,
        },
      ];
    },
    async validateSaleReferences() {
      return true;
    },
    async createSale() {
      return { id: "sale-1" };
    },
    async createSaleItems() {},
    async createPayment() {},
    async applyInventoryMovements(value: unknown) {
      movements.push(value);
    },
  };

  await completeSale(
    {
      workshopId: "workshop-1",
      items: [{ kind: "product", id: "product-oil", quantity: 2 }],
      paymentMethod: "cash",
    },
    { userId: "cashier-1", role: "cashier" },
    port,
  );

  assert.deepEqual(movements, [
    [
      {
        workshopId: "workshop-1",
        productId: "product-oil",
        saleId: "sale-1",
        previousStock: 2,
        quantityChange: -2,
        newStock: 0,
        reason: "sale",
        createdBy: "cashier-1",
      },
    ],
  ]);
});

test("completes a fractional product sale when its total is whole Rupiah", async () => {
  const movements: unknown[] = [];
  const port = {
    async inTransaction<T>(work: () => Promise<T>) { return work(); },
    async lockProducts() {
      return [{
        id: "oil", name: "Oli curah", sku: null, stockOnHand: 3,
        sellingPrice: 95000, currentCost: 70000, active: true,
      }];
    },
    async validateSaleReferences() { return true; },
    async createSale() { return { id: "sale-1" }; },
    async createSaleItems() {},
    async createPayment() {},
    async applyInventoryMovements(value: unknown) { movements.push(value); },
  };

  const sale = await completeSale(
    { workshopId: "workshop-1", items: [{ kind: "product", id: "oil", quantity: 0.5 }], paymentMethod: "cash" },
    { userId: "cashier-1", role: "cashier" },
    port,
  );

  assert.equal(sale.total, 47500);
  assert.deepEqual(movements, [[{
    workshopId: "workshop-1", productId: "oil", saleId: "sale-1", previousStock: 3,
    quantityChange: -0.5, newStock: 2.5, reason: "sale", createdBy: "cashier-1",
  }]]);
});

test("rejects a customer or vehicle outside the active workshop", async () => {
  const port = {
    async inTransaction<T>(work: () => Promise<T>) {
      return work();
    },
    async validateSaleReferences() {
      return false;
    },
    async lockProducts() {
      throw new Error("must not lock products");
    },
    async createSale() {
      throw new Error("must not create a sale");
    },
    async createSaleItems() {},
    async createPayment() {},
    async applyInventoryMovements() {},
  };

  await assert.rejects(
    completeSale(
      {
        workshopId: "workshop-1",
        customerId: "foreign-customer",
        items: [{ kind: "product", id: "product-oil", quantity: 1 }],
        paymentMethod: "cash",
      },
      { userId: "cashier-1", role: "cashier" },
      port,
    ),
    /Customer or vehicle is unavailable/,
  );
});
