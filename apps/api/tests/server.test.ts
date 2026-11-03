import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/server.ts";

test("reports that the API is healthy", async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});

test("does not report readiness without a database pool", async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/ready" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { error: "Database is unavailable" });
});
