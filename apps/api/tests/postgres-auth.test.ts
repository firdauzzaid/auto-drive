import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { PostgresAuthPort } from "../src/adapters/postgres-auth-port.ts";
import { login, registerOwner } from "../src/modules/auth/auth.ts";


test("owner can register a workshop and log in with a durable opaque session", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  t.after(() => pool.end());
  const port = new PostgresAuthPort(pool);
  const email = `owner-${crypto.randomUUID()}@example.test`;

  const registration = await registerOwner(
    { email, password: "correct-horse-battery-staple", workshopName: "Bengkel Baru" },
    port,
  );
  const session = await login({ email, password: "correct-horse-battery-staple" }, port);

  assert.equal(registration.role, "owner");
  assert.equal(session.userId, registration.userId);
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(session.expiresAt > new Date());
});
