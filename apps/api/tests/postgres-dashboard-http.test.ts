import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("owner can record an expense and see it in the dashboard", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `dashboard-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Dashboard" } });
  const loginResponse = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${loginResponse.json().token}`, "x-workshop-id": registration.json().workshopId };

  const expense = await app.inject({
    method: "POST", url: "/expenses", headers, payload: { name: "Listrik", amount: 150000, occurredAt: "2026-11-03T00:00:00.000Z" },
  });
  const dashboard = await app.inject({ method: "GET", url: "/dashboard", headers });

  assert.equal(expense.statusCode, 201);
  assert.deepEqual(dashboard.json(), {
    revenue: 0, grossProfit: 0, transactionCount: 0, expenseTotal: 150000, lowStock: [],
  });
});
