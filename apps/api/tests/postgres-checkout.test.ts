import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { PostgresCheckoutPort } from "../src/adapters/postgres-checkout-port.ts";
import { completeSale } from "../src/modules/sales/complete-sale.ts";


test("persists a completed sale and its stock movement in PostgreSQL", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  const userId = randomUUID();
  const workshopId = randomUUID();
  const productId = randomUUID();
  await pool.query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'not-used-by-this-test')",
    [userId, `owner-${userId}@example.test`],
  );
  await pool.query("INSERT INTO workshops (id, name) VALUES ($1, 'Workshop test')", [workshopId]);
  await pool.query(
    "INSERT INTO memberships (workshop_id, user_id, role) VALUES ($1, $2, 'owner')",
    [workshopId, userId],
  );
  await pool.query(
    `INSERT INTO products (
       id, workshop_id, name, sku, unit, stock_on_hand, current_cost, selling_price
     ) VALUES ($1, $2, 'Oli test', $3, 'botol', 5, 70000, 95000)`,
    [productId, workshopId, `OIL-TEST-${productId}`],
  );

  const sale = await completeSale(
    {
      workshopId,
      items: [{ kind: "product", id: productId, quantity: 2 }],
      paymentMethod: "qris",
    },
    { userId, role: "owner" },
    new PostgresCheckoutPort(pool, workshopId, userId),
  );

  assert.equal(sale.total, 190000);
  assert.deepEqual(
    (await pool.query("SELECT stock_on_hand FROM products WHERE id = $1", [productId])).rows,
    [{ stock_on_hand: "3.000" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT status, total FROM sales WHERE id = $1", [sale.id])).rows,
    [{ status: "completed", total: "190000" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT method, amount FROM payments WHERE sale_id = $1", [sale.id])).rows,
    [{ method: "qris", amount: "190000" }],
  );
  assert.deepEqual(
    (await pool.query("SELECT reason, quantity_change, new_stock FROM inventory_movements WHERE sale_id = $1", [sale.id])).rows,
    [{ reason: "sale", quantity_change: "-2.000", new_stock: "3.000" }],
  );
});

test("RLS hides another workshop's products from the API database role", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  const userId = randomUUID();
  const memberWorkshopId = randomUUID();
  const otherWorkshopId = randomUUID();
  const memberProductId = randomUUID();
  const otherProductId = randomUUID();
  await pool.query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'not-used-by-this-test')",
    [userId, `member-${userId}@example.test`],
  );
  await pool.query("INSERT INTO workshops (id, name) VALUES ($1, 'Member workshop'), ($2, 'Other workshop')", [
    memberWorkshopId,
    otherWorkshopId,
  ]);
  await pool.query(
    "INSERT INTO memberships (workshop_id, user_id, role) VALUES ($1, $2, 'cashier')",
    [memberWorkshopId, userId],
  );
  await pool.query(
    `INSERT INTO products (id, workshop_id, name, sku, unit, selling_price)
     VALUES ($1, $2, 'Member product', $3, 'pcs', 10000),
            ($4, $5, 'Other product', $6, 'pcs', 10000)`,
    [
      memberProductId,
      memberWorkshopId,
      `MEMBER-${memberProductId}`,
      otherProductId,
      otherWorkshopId,
      `OTHER-${otherProductId}`,
    ],
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE bengkel_api");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.workshop_id', $1, true)", [memberWorkshopId]);
    const visibleProducts = await client.query("SELECT id FROM products ORDER BY id");
    await client.query("COMMIT");

    assert.deepEqual(visibleProducts.rows, [{ id: memberProductId }]);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});

test("checkout rejects a product from a workshop the actor cannot access", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());

  const userId = randomUUID();
  const memberWorkshopId = randomUUID();
  const otherWorkshopId = randomUUID();
  const otherProductId = randomUUID();
  await pool.query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'not-used-by-this-test')",
    [userId, `cashier-${userId}@example.test`],
  );
  await pool.query("INSERT INTO workshops (id, name) VALUES ($1, 'Member workshop'), ($2, 'Other workshop')", [
    memberWorkshopId,
    otherWorkshopId,
  ]);
  await pool.query(
    "INSERT INTO memberships (workshop_id, user_id, role) VALUES ($1, $2, 'cashier')",
    [memberWorkshopId, userId],
  );
  await pool.query(
    `INSERT INTO products (id, workshop_id, name, sku, unit, stock_on_hand, selling_price)
     VALUES ($1, $2, 'Other product', $3, 'pcs', 3, 10000)`,
    [otherProductId, otherWorkshopId, `OTHER-${otherProductId}`],
  );

  await assert.rejects(
    completeSale(
      {
        workshopId: otherWorkshopId,
        items: [{ kind: "product", id: otherProductId, quantity: 1 }],
        paymentMethod: "cash",
      },
      { userId, role: "cashier" },
      new PostgresCheckoutPort(pool, otherWorkshopId, userId),
    ),
    /Product is unavailable/,
  );
});
