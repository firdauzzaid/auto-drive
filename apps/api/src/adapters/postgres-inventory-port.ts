import type { Pool, PoolClient } from "pg";

export class PostgresInventoryPort {
  private client: PoolClient | undefined;
  private readonly pool: Pool;
  private readonly workshopId: string;
  private readonly userId: string;

  constructor(pool: Pool, workshopId: string, userId: string) {
    this.pool = pool;
    this.workshopId = workshopId;
    this.userId = userId;
  }

  async inTransaction<T>(work: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    this.client = client;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE bengkel_api");
      await client.query("SELECT set_config('app.user_id', $1, true)", [this.userId]);
      await client.query("SELECT set_config('app.workshop_id', $1, true)", [this.workshopId]);
      const result = await work();
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      this.client = undefined;
      client.release();
    }
  }

  async applyAdjustment(input: { productId: string; quantityChange: number; reason: string; createdBy: string }) {
    const result = await this.activeClient().query<{ new_stock: string }>(
      `SELECT new_stock FROM app.apply_inventory_adjustment($1, $2, $3, $4, $5)`,
      [this.workshopId, input.productId, input.quantityChange, input.reason, input.createdBy],
    );
    return { stockOnHand: Number(result.rows[0].new_stock) };
  }

  private activeClient() {
    if (!this.client) {
      throw new Error("Inventory database operation requires an active transaction");
    }
    return this.client;
  }
}
