import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { PostgresPurchasePort } from "../src/adapters/postgres-purchase-port.ts";
import { completePurchase } from "../src/modules/purchases/complete-purchase.ts";


test("owner receives a purchase and records its stock movement", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  const userId = randomUUID();
  const workshopId = randomUUID();
  const productId = randomUUID();
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'test')", [
    userId,
    `owner-${userId}@example.test`,
  ]);
  await pool.query("INSERT INTO workshops (id, name) VALUES ($1, 'Workshop purchase')", [workshopId]);
  await pool.query("INSERT INTO memberships (workshop_id, user_id, role) VALUES ($1, $2, 'owner')", [
    workshopId,
    userId,
  ]);
  await pool.query(
    "INSERT INTO products (id, workshop_id, name, sku, unit, selling_price) VALUES ($1, $2, 'Kampas rem', $3, 'set', 45000)",
    [productId, workshopId, `PAD-${productId}`],
  );

  const purchase = await completePurchase(
    { workshopId, items: [{ productId, quantity: 4, unitCost: 30000 }] },
    { userId, role: "owner" },
    new PostgresPurchasePort(pool, workshopId, userId),
  );

  assert.equal(purchase.total, 120000);
  assert.deepEqual(
    (await pool.query("SELECT stock_on_hand, current_cost FROM products WHERE id = $1", [productId])).rows,
    [{ stock_on_hand: "4.000", current_cost: "30000" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT quantity_change, reason FROM inventory_movements WHERE purchase_id = $1", [purchase.id])).rows,
    [{ quantity_change: "4.000", reason: "purchase" }],
  );
});
