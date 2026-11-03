import { createHash } from "node:crypto";
import type { Pool } from "pg";

export class PostgresSessionAuthenticator {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async authenticate(token: string, workshopId: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE bengkel_api");
      const result = await client.query<{ user_id: string; role: "owner" | "cashier" }>(
        "SELECT * FROM app.authenticate_session($1, $2)",
        [tokenHash, workshopId],
      );
      await client.query("COMMIT");
      const actor = result.rows[0];
      return actor ? { userId: actor.user_id, role: actor.role } : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
