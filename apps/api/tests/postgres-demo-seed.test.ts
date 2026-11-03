import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { seedDemo } from "../src/modules/demo/seed-demo.ts";
import { buildApp } from "../src/server.ts";

test("demo seed creates a reusable owner workspace without duplicate business mutations", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const suffix = randomUUID();
  const input = {
    ownerEmail: `owner-demo-${suffix}@example.test`,
    ownerPassword: "correct-horse-battery-staple",
    cashierEmail: `cashier-demo-${suffix}@example.test`,
    cashierPassword: "correct-horse-battery-staple",
    workshopName: `Bengkel Demo ${suffix}`,
  };

  const first = await seedDemo({ pool, ...input });
  const second = await seedDemo({ pool, ...input });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: input.ownerEmail, password: input.ownerPassword } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": first.workshopId };
  const products = await app.inject({ method: "GET", url: "/products", headers });
  const services = await app.inject({ method: "GET", url: "/services", headers });
  const dashboard = await app.inject({ method: "GET", url: "/dashboard", headers });
  const vehicles = await app.inject({ method: "GET", url: "/vehicles?plate=B%201234%20DEMO", headers });
  const cashiers = await app.inject({ method: "GET", url: "/memberships/cashiers", headers });

  assert.equal(second.workshopId, first.workshopId);
  assert.equal(login.statusCode, 200);
  assert.deepEqual(products.json().map((product: { sku: string }) => product.sku).sort(), ["DEMO-BUSI-NGK", "DEMO-KAMPAS-REM", "DEMO-OLI-MPX2"]);
  assert.deepEqual(services.json().map((service: { name: string }) => service.name).sort(), ["Jasa Ganti Oli Demo", "Servis Ringan Demo"]);
  assert.equal(dashboard.json().transactionCount, 1);
  assert.equal(vehicles.json().length, 1);
  assert.deepEqual(cashiers.json(), [{ userId: cashiers.json()[0].userId, email: input.cashierEmail, active: true }]);
});
