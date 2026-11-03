import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.MIGRATIONS_DATABASE_URL;
const baselineName = process.env.MIGRATIONS_BASELINE;
const runtimePassword = process.env.APP_DATABASE_PASSWORD;

if (!databaseUrl) {
  throw new Error("MIGRATIONS_DATABASE_URL is required to run migrations");
}
if (!runtimePassword) {
  throw new Error("APP_DATABASE_PASSWORD is required to configure the runtime database role");
}

const migrationDirectory = join(import.meta.dirname, "..", "apps", "api", "migrations");
const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
const client = new Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('bengkel-migrations'))");
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const applied = await client.query("SELECT name FROM schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));
  const existingSchema = await client.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workshops') AS exists",
  );

  if (baselineName) {
    if (!existingSchema.rows[0].exists || appliedNames.size > 0 || !migrationNames.includes(baselineName)) {
      throw new Error("Baseline requires an existing untracked schema and a valid migration filename");
    }
    const baselineMigrations = migrationNames.filter((name) => name <= baselineName);
    await client.query("BEGIN");
    try {
      for (const name of baselineMigrations) {
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    for (const name of baselineMigrations) appliedNames.add(name);
    console.log(`Baselined ${baselineMigrations.length} migration(s).`);
  } else if (appliedNames.size === 0 && existingSchema.rows[0].exists) {
    throw new Error("Existing schema detected. Verify the target database, then set MIGRATIONS_BASELINE to its last applied migration filename.");
  }

  for (const name of migrationNames.filter((name) => !appliedNames.has(name))) {
    const sql = await readFile(join(migrationDirectory, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`Applied ${name}`);
  }
  const passwordSql = await client.query("SELECT format('ALTER ROLE bengkel_runtime PASSWORD %L', $1::text) AS sql", [runtimePassword]);
  await client.query(passwordSql.rows[0].sql);
  console.log(`Migration state is current (${migrationNames.length} migration(s)).`);
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('bengkel-migrations'))").catch(() => undefined);
  await client.end();
}
