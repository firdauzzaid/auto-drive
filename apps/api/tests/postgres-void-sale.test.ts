import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { PostgresCheckoutPort } from "../src/adapters/postgres-checkout-port.ts";
import { PostgresVoidSalePort } from "../src/adapters/postgres-void-sale-port.ts";
import { completeSale } from "../src/modules/sales/complete-sale.ts";
import { voidSale } from "../src/modules/sales/void-sale.ts";


test("voids a completed sale without deleting its history", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  const userId = randomUUID();
  const workshopId = randomUUID();
  const productId = randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'test')", [
    userId,
    `owner-${userId}@example.test`,
  ]);
  await pool.query("INSERT INTO workshops (id, name) VALUES ($1, 'Workshop test')", [workshopId]);
  await pool.query("INSERT INTO memberships (workshop_id, user_id, role) VALUES ($1, $2, 'owner')", [
    workshopId,
    userId,
  ]);
  await pool.query(
    "INSERT INTO products (id, workshop_id, name, sku, unit, stock_on_hand, selling_price) VALUES ($1, $2, 'Oli test', $3, 'botol', 5, 95000)",
    [productId, workshopId, `OIL-${productId}`],
  );

  const sale = await completeSale(
    { workshopId, items: [{ kind: "product", id: productId, quantity: 2 }], paymentMethod: "cash" },
    { userId, role: "owner" },
    new PostgresCheckoutPort(pool, workshopId, userId),
  );

  await voidSale(
    { workshopId, saleId: sale.id, reason: "Customer changed their mind" },
    { userId, role: "owner" },
    new PostgresVoidSalePort(pool, workshopId, userId),
  );

  assert.deepEqual(
    (await pool.query("SELECT status FROM sales WHERE id = $1", [sale.id])).rows,
    [{ status: "void" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT stock_on_hand FROM products WHERE id = $1", [productId])).rows,
    [{ stock_on_hand: "5.000" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT reason, quantity_change FROM inventory_movements WHERE sale_id = $1 ORDER BY created_at", [sale.id])).rows,
    [
      { reason: "sale", quantity_change: "-2.000" },
      { reason: "sale_void", quantity_change: "2.000" },
    ],
  );
  assert.equal((await pool.query("SELECT count(*) FROM audit_logs WHERE entity_id = $1", [sale.id])).rows[0].count, "1");
});
