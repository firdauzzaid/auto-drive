import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("mobile client can register and log in through the auth API", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `http-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";

  const registration = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password, workshopName: "Bengkel HTTP" },
  });
  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  const sessionHeaders = {
    authorization: `Bearer ${loginResponse.json().token}`,
    "x-workshop-id": registration.json().workshopId,
  };
  const logoutResponse = await app.inject({ method: "POST", url: "/auth/logout", headers: sessionHeaders });
  const rejectedAfterLogout = await app.inject({ method: "GET", url: "/products", headers: sessionHeaders });

  assert.equal(registration.statusCode, 201);
  assert.equal(loginResponse.statusCode, 200);
  assert.match(loginResponse.json().token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(logoutResponse.statusCode, 204);
  assert.equal(rejectedAfterLogout.statusCode, 401);
});

test("a signed-in user can rotate and revoke all sessions", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `sessions-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Sesi" },
  });
  const firstLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const firstHeaders = {
    authorization: `Bearer ${firstLogin.json().token}`,
    "x-workshop-id": registration.json().workshopId,
  };
  const refreshed = await app.inject({ method: "POST", url: "/auth/refresh", headers: firstHeaders });
  const secondHeaders = {
    authorization: `Bearer ${refreshed.json().token}`,
    "x-workshop-id": registration.json().workshopId,
  };
  const rejectedOldToken = await app.inject({ method: "GET", url: "/products", headers: firstHeaders });
  const revokeAll = await app.inject({ method: "POST", url: "/auth/logout-all", headers: secondHeaders });
  const rejectedNewToken = await app.inject({ method: "GET", url: "/products", headers: secondHeaders });

  assert.equal(refreshed.statusCode, 200);
  assert.match(refreshed.json().token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(rejectedOldToken.statusCode, 401);
  assert.equal(revokeAll.statusCode, 204);
  assert.equal(rejectedNewToken.statusCode, 401);
});

test("login is rate limited after repeated failures", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const payload = { email: `blocked-${randomUUID()}@example.test`, password: "wrong-password" };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({ method: "POST", url: "/auth/login", payload });
    assert.equal(response.statusCode, 401);
  }
  const blocked = await app.inject({ method: "POST", url: "/auth/login", payload });

  assert.equal(blocked.statusCode, 429);
});

test("registration is rate limited after repeated attempts", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { email: `limited-${attempt}-${randomUUID()}@example.test`, password: "correct-horse-battery-staple", workshopName: "Bengkel Limit" },
    });
    assert.equal(response.statusCode, 201);
  }
  const blocked = await app.inject({
    method: "POST", url: "/auth/register",
    payload: { email: `limited-${randomUUID()}@example.test`, password: "correct-horse-battery-staple", workshopName: "Bengkel Limit" },
  });

  assert.equal(blocked.statusCode, 429);
});

test("owner can add a cashier who can log in", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const ownerEmail = `owner-${randomUUID()}@example.test`;
  const cashierEmail = `cashier-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({ method: "POST", url: "/auth/register", payload: { email: ownerEmail, password, workshopName: "Bengkel Kasir" } });
  const ownerLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: ownerEmail, password } });
  const cashier = await app.inject({
    method: "POST", url: "/memberships/cashiers",
    headers: { authorization: `Bearer ${ownerLogin.json().token}`, "x-workshop-id": registration.json().workshopId },
    payload: { email: cashierEmail, password },
  });
  const cashierLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: cashierEmail, password } });
  assert.equal(cashier.statusCode, 201, cashier.body);
  assert.equal(cashierLogin.statusCode, 200);
});

test("owner can list and deactivate a cashier without deleting their account", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const ownerEmail = `manager-owner-${randomUUID()}@example.test`;
  const cashierEmail = `manager-cashier-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({ method: "POST", url: "/auth/register", payload: { email: ownerEmail, password, workshopName: "Bengkel Akses" } });
  const ownerLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: ownerEmail, password } });
  const ownerHeaders = { authorization: `Bearer ${ownerLogin.json().token}`, "x-workshop-id": registration.json().workshopId };
  const cashier = await app.inject({
    method: "POST", url: "/memberships/cashiers", headers: ownerHeaders, payload: { email: cashierEmail, password },
  });
  const cashierLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: cashierEmail, password } });
  const cashierHeaders = { authorization: `Bearer ${cashierLogin.json().token}`, "x-workshop-id": registration.json().workshopId };
  const listed = await app.inject({ method: "GET", url: "/memberships/cashiers", headers: ownerHeaders });
  const deactivated = await app.inject({
    method: "PATCH", url: `/memberships/cashiers/${cashier.json().userId}`, headers: ownerHeaders, payload: { active: false },
  });
  const rejectedSession = await app.inject({ method: "GET", url: "/products", headers: cashierHeaders });

  assert.deepEqual(listed.json(), [{ userId: cashier.json().userId, email: cashierEmail, active: true }]);
  assert.deepEqual(deactivated.json(), { userId: cashier.json().userId, email: cashierEmail, active: false });
  assert.equal(rejectedSession.statusCode, 401);
});
