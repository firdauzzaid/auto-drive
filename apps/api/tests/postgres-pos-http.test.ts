import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("owner can receive stock, complete a sale, then void it through the API", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `pos-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel POS" },
  });
  const loginResponse = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = {
    authorization: `Bearer ${loginResponse.json().token}`,
    "x-workshop-id": registration.json().workshopId,
  };
  const product = await app.inject({
    method: "POST", url: "/products", headers,
    payload: { name: "Busi", unit: "pcs", sellingPrice: 30000, currentCost: 20000 },
  });
  const productId = product.json().id;
  const customer = await app.inject({ method: "POST", url: "/customers", headers, payload: { name: "Budi" } });
  const vehicle = await app.inject({
    method: "POST", url: "/vehicles", headers,
    payload: { customerId: customer.json().id, plateNumber: "B 1234 ABC", brand: "Honda", model: "Vario" },
  });
  const service = await app.inject({
    method: "POST", url: "/services", headers,
    payload: { name: "Ganti oli", sellingPrice: 20000 },
  });
  const purchase = await app.inject({
    method: "POST", url: "/purchases", headers: { ...headers, "idempotency-key": "purchase-1" },
    payload: { items: [{ productId, quantity: 3, unitCost: 21000 }] },
  });
  const retriedPurchase = await app.inject({
    method: "POST", url: "/purchases", headers: { ...headers, "idempotency-key": "purchase-1" },
    payload: { items: [{ productId, quantity: 3, unitCost: 21000 }] },
  });
  const sale = await app.inject({
    method: "POST", url: "/sales", headers: { ...headers, "idempotency-key": "checkout-1" },
    payload: {
      vehicleId: vehicle.json().id,
      items: [{ kind: "product", id: productId, quantity: 1 }, { kind: "service", id: service.json().id, quantity: 1 }],
      discount: 5000, paymentMethod: "qris",
    },
  });
  const retriedSale = await app.inject({
    method: "POST", url: "/sales", headers: { ...headers, "idempotency-key": "checkout-1" },
    payload: {
      vehicleId: vehicle.json().id,
      items: [{ kind: "product", id: productId, quantity: 1 }, { kind: "service", id: service.json().id, quantity: 1 }],
      discount: 5000, paymentMethod: "qris",
    },
  });
  const receipt = await app.inject({ method: "GET", url: `/sales/${sale.json().id}/receipt`, headers });
  const history = await app.inject({ method: "GET", url: `/vehicles/${vehicle.json().id}/history`, headers });
  const report = await app.inject({
    method: "GET", url: "/reports/summary?from=2026-11-03T00:00:00.000Z&to=2026-11-04T00:00:00.000Z", headers,
  });
  const dashboard = await app.inject({ method: "GET", url: "/dashboard", headers });
  const voided = await app.inject({
    method: "POST", url: `/sales/${sale.json().id}/void`, headers, payload: { reason: "Input kasir salah" },
  });

  assert.equal(purchase.statusCode, 201);
  assert.deepEqual(retriedPurchase.json(), purchase.json());
  assert.deepEqual(
    (await pool.query("SELECT count(*)::int AS count, sum(quantity_change) AS quantity FROM inventory_movements WHERE purchase_id = $1", [purchase.json().id])).rows,
    [{ count: 1, quantity: "3.000" }],
  );
  assert.equal(service.statusCode, 201);
  assert.equal(sale.statusCode, 201);
  assert.equal(sale.json().total, 45000);
  assert.deepEqual(retriedSale.json(), sale.json());
  assert.equal(receipt.statusCode, 200);
  assert.equal(receipt.json().total, 45000);
  assert.equal(receipt.json().discount, 5000);
  assert.deepEqual(receipt.json().payment, { method: "qris", amount: 45000 });
  assert.deepEqual(receipt.json().items.map((item: { name: string }) => item.name).sort(), ["Busi", "Ganti oli"]);
  assert.equal(history.statusCode, 200);
  assert.deepEqual(history.json().map((entry: { id: string; total: number; status: string }) => ({ id: entry.id, total: entry.total, status: entry.status })), [
    { id: sale.json().id, total: 45000, status: "completed" },
  ]);
  assert.equal(report.statusCode, 200);
  assert.deepEqual(
    { revenue: report.json().revenue, grossProfit: report.json().grossProfit, transactionCount: report.json().transactionCount, expenseTotal: report.json().expenseTotal },
    { revenue: 45000, grossProfit: 24000, transactionCount: 1, expenseTotal: 0 },
  );
  assert.deepEqual(report.json().topProducts, [{ productId, name: "Busi", quantity: 1, revenue: 30000 }]);
  assert.deepEqual(
    report.json().recentTransactions.map((transaction: { id: string; total: number }) => ({ id: transaction.id, total: transaction.total })),
    [{ id: sale.json().id, total: 45000 }],
  );
  assert.equal(dashboard.json().grossProfit, 24000);
  assert.deepEqual(voided.json(), { id: sale.json().id, status: "void" });
});
