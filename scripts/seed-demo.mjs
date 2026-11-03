import { Pool } from "pg";

import { seedDemo } from "../apps/api/src/modules/demo/seed-demo.ts";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (process.env.APP_ENV !== "local" || process.env.SEED_DEMO !== "true") {
  throw new Error("Demo seed requires APP_ENV=local and SEED_DEMO=true");
}

const databaseUrl = required("SEED_DATABASE_URL");
const database = new URL(databaseUrl);
if (!new Set(["localhost", "127.0.0.1", "postgres"]).has(database.hostname)) {
  throw new Error("Demo seed only accepts a local PostgreSQL host");
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  const result = await seedDemo({
    pool,
    ownerEmail: process.env.DEMO_OWNER_EMAIL ?? "owner.demo@bengkel.local",
    ownerPassword: required("DEMO_OWNER_PASSWORD"),
    cashierEmail: process.env.DEMO_CASHIER_EMAIL ?? "kasir.demo@bengkel.local",
    cashierPassword: required("DEMO_CASHIER_PASSWORD"),
    workshopName: process.env.DEMO_WORKSHOP_NAME ?? "Bengkel Demo",
  });
  console.log(`Demo workspace ready: ${result.workshopId}`);
} finally {
  await pool.end();
}
