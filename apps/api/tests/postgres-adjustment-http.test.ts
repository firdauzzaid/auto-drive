import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("owner adjusts stock with a reason and audit trail", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `adjustment-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Adjustment" } });
  const loginResponse = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${loginResponse.json().token}`, "x-workshop-id": registration.json().workshopId };
  const product = await app.inject({
    method: "POST", url: "/products", headers,
    payload: { name: "Kampas rem", unit: "set", sellingPrice: 45000 },
  });
  const adjusted = await app.inject({
    method: "POST", url: "/inventory/adjustments", headers,
    payload: { productId: product.json().id, quantityChange: 2, reason: "Stok awal gudang" },
  });

  assert.equal(adjusted.statusCode, 201);
  assert.deepEqual(adjusted.json(), { productId: product.json().id, stockOnHand: 2 });
  assert.deepEqual(
    (await pool.query("SELECT reason, quantity_change FROM inventory_movements WHERE product_id = $1", [product.json().id])).rows,
    [{ reason: "adjustment", quantity_change: "2.000" }],
  );
  assert.equal((await pool.query("SELECT count(*) FROM audit_logs WHERE entity_id = $1 AND action = 'inventory.adjusted'", [product.json().id])).rows[0].count, "1");
});
