import assert from "node:assert/strict";
import test from "node:test";

import { completePurchase } from "../src/modules/purchases/complete-purchase.ts";

test("returns the original purchase for a retried idempotency key", async () => {
  const port = {
    async inTransaction<T>(work: () => Promise<T>) { return work(); },
    async findCompletedPurchaseByIdempotencyKey() { return { id: "purchase-1", total: 120000, supplierId: null }; },
    async lockProducts() { throw new Error("must not lock products"); },
    async createPurchase() { throw new Error("must not create a purchase"); },
    async createPurchaseItems() {},
    async applyPurchaseMovements() {},
  };

  const purchase = await completePurchase(
    {
      workshopId: "workshop-1", idempotencyKey: "purchase-1",
      items: [{ productId: "oil", quantity: 2, unitCost: 60000 }],
    },
    { userId: "owner-1", role: "owner" },
    port,
  );

  assert.deepEqual(purchase, { id: "purchase-1", total: 120000, supplierId: null });
});
