import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export class PostgresAuthPort {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createOwner(input: { email: string; passwordHash: string; workshopName: string }) {
    return this.withApiTransaction(async (client) => {
      const result = await client.query<{ user_id: string; workshop_id: string; role: "owner" }>(
        "SELECT * FROM app.register_owner($1, $2, $3)",
        [input.email, input.passwordHash, input.workshopName],
      );
      const owner = result.rows[0];
      return { userId: owner.user_id, workshopId: owner.workshop_id, role: owner.role };
    });
  }

  async createCashier(input: { email: string; passwordHash: string; workshopId: string; ownerId: string }) {
    return this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [input.ownerId]);
      await client.query("SELECT set_config('app.workshop_id', $1, true)", [input.workshopId]);
      const result = await client.query<{ user_id: string; workshop_id: string; role: "cashier" }>(
        "SELECT * FROM app.register_cashier($1, $2)",
        [input.email, input.passwordHash],
      );
      const cashier = result.rows[0];
      return { userId: cashier.user_id, workshopId: cashier.workshop_id, role: cashier.role };
    });
  }

  async findUserByEmail(email: string) {
    return this.withApiTransaction(async (client) => {
      const result = await client.query<{ id: string; password_hash: string }>(
        "SELECT id, password_hash FROM app.find_user_by_email($1)",
        [email],
      );
      const user = result.rows[0];
      return user ? { id: user.id, passwordHash: user.password_hash } : null;
    });
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query("DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()", [userId]);
      const result = await client.query<{ expires_at: Date }>(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '30 days')
         RETURNING expires_at`,
        [userId, tokenHash],
      );
      return { token, expiresAt: result.rows[0].expires_at };
    });
  }

  async revokeSession(userId: string, token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL",
        [userId, tokenHash],
      );
    });
  }

  async rotateSession(userId: string, token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const replacementToken = randomBytes(32).toString("base64url");
    const replacementHash = createHash("sha256").update(replacementToken).digest("hex");
    return this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const revoked = await client.query(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()",
        [userId, tokenHash],
      );
      if (revoked.rowCount !== 1) throw new Error("Session is no longer active");
      await client.query("DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()", [userId]);
      const result = await client.query<{ expires_at: Date }>(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '30 days')
         RETURNING expires_at`,
        [userId, replacementHash],
      );
      return { token: replacementToken, expiresAt: result.rows[0].expires_at };
    });
  }

  async revokeAllSessions(userId: string) {
    await this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    });
  }

  async listCashiers(input: { workshopId: string; ownerId: string }) {
    return this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [input.ownerId]);
      await client.query("SELECT set_config('app.workshop_id', $1, true)", [input.workshopId]);
      const result = await client.query<{ user_id: string; email: string; active: boolean }>("SELECT * FROM app.list_cashiers()");
      return result.rows.map((cashier) => ({ userId: cashier.user_id, email: cashier.email, active: cashier.active }));
    });
  }

  async setCashierActive(input: { workshopId: string; ownerId: string; userId: string; active: boolean }) {
    return this.withApiTransaction(async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [input.ownerId]);
      await client.query("SELECT set_config('app.workshop_id', $1, true)", [input.workshopId]);
      const result = await client.query<{ user_id: string; email: string; active: boolean }>(
        "SELECT * FROM app.set_cashier_active($1, $2)", [input.userId, input.active],
      );
      const cashier = result.rows[0];
      return cashier && { userId: cashier.user_id, email: cashier.email, active: cashier.active };
    });
  }

  private async withApiTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE bengkel_api");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
