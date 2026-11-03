import assert from "node:assert/strict";
import test from "node:test";

import { voidSale } from "../src/modules/sales/void-sale.ts";

test("an owner voids a completed sale and returns its products to stock", async () => {
  const writes: Array<{ type: string; value: unknown }> = [];
  const port = {
    async inTransaction<T>(work: () => Promise<T>) {
      return work();
    },
    async getCompletedSale(saleId: string) {
      assert.equal(saleId, "sale-1");
      return {
        id: "sale-1",
        workshopId: "workshop-1",
        status: "completed" as const,
        items: [{ productId: "product-oil", quantity: 2 }],
      };
    },
    async markSaleVoid(value: unknown) {
      writes.push({ type: "void", value });
    },
    async applyInventoryMovements(value: unknown) {
      writes.push({ type: "movement", value });
    },
    async appendAuditLog(value: unknown) {
      writes.push({ type: "audit", value });
    },
  };

  const result = await voidSale(
    { workshopId: "workshop-1", saleId: "sale-1", reason: "Pelanggan membatalkan" },
    { userId: "owner-1", role: "owner" },
    port,
  );

  assert.deepEqual(result, { id: "sale-1", status: "void" });
  assert.deepEqual(writes, [
    {
      type: "void",
      value: { saleId: "sale-1", voidedBy: "owner-1", reason: "Pelanggan membatalkan" },
    },
    {
      type: "movement",
      value: [
        {
          workshopId: "workshop-1",
          productId: "product-oil",
          saleId: "sale-1",
          quantityChange: 2,
          reason: "sale_void",
          createdBy: "owner-1",
        },
      ],
    },
    {
      type: "audit",
      value: {
        workshopId: "workshop-1",
        actorId: "owner-1",
        action: "sale.voided",
        entityType: "sale",
        entityId: "sale-1",
        previousValue: { status: "completed" },
        newValue: { status: "void", reason: "Pelanggan membatalkan" },
      },
    },
  ]);
});
