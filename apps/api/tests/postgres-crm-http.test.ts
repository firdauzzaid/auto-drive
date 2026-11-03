import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("cashier can save a customer vehicle and find it by normalized plate", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `crm-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel CRM" } });
  const loginResponse = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${loginResponse.json().token}`, "x-workshop-id": registration.json().workshopId };
  const customer = await app.inject({ method: "POST", url: "/customers", headers, payload: { name: "Budi", phone: "0812345678" } });
  const vehicle = await app.inject({
    method: "POST", url: "/vehicles", headers,
    payload: { customerId: customer.json().id, plateNumber: "B 1234 ABC", brand: "Honda", model: "Vario" },
  });
  const draftVehicle = await app.inject({
    method: "POST", url: "/vehicles", headers,
    payload: { customerId: customer.json().id, brand: "Yamaha", model: "NMAX" },
  });
  const secondDraftVehicle = await app.inject({
    method: "POST", url: "/vehicles", headers,
    payload: { customerId: customer.json().id, brand: "Suzuki", model: "Nex" },
  });
  const found = await app.inject({ method: "GET", url: "/vehicles?plate=b-1234 abc", headers });

  assert.equal(customer.statusCode, 201);
  assert.equal(vehicle.statusCode, 201);
  assert.equal(draftVehicle.statusCode, 201);
  assert.equal(secondDraftVehicle.statusCode, 201);
  assert.deepEqual(found.json(), [{ id: vehicle.json().id, plateNumber: "B 1234 ABC", brand: "Honda", model: "Vario", customerName: "Budi" }]);
});
