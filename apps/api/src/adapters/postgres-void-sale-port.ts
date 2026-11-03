import type { Pool, PoolClient } from "pg";

export class PostgresVoidSalePort {
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

  async getCompletedSale(saleId: string) {
    const sale = await this.activeClient().query<{ id: string; workshop_id: string }>(
      `SELECT id, workshop_id
       FROM sales
       WHERE id = $1 AND workshop_id = $2 AND status = 'completed'
       FOR UPDATE`,
      [saleId, this.workshopId],
    );
    if (!sale.rows[0]) {
      return null;
    }

    const items = await this.activeClient().query<{ product_id: string | null; quantity: string }>(
      "SELECT product_id, quantity FROM sale_items WHERE sale_id = $1",
      [saleId],
    );
    return {
      id: sale.rows[0].id,
      workshopId: sale.rows[0].workshop_id,
      status: "completed" as const,
      items: items.rows.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity) })),
    };
  }

  async markSaleVoid(input: { saleId: string; voidedBy: string; reason: string }) {
    await this.activeClient().query(
      `UPDATE sales
       SET status = 'void', voided_by = $2, voided_at = now(), void_reason = $3
       WHERE id = $1`,
      [input.saleId, input.voidedBy, input.reason],
    );
  }

  async applyInventoryMovements(
    movements: Array<{
      workshopId: string;
      productId: string;
      saleId: string;
      quantityChange: number;
      reason: "sale_void";
      createdBy: string;
    }>,
  ) {
    if (movements.length === 0) {
      return;
    }

    await this.activeClient().query(
      `SELECT app.apply_inventory_movement(
         item.workshop_id, item.product_id, item.quantity_change,
         item.reason::inventory_movement_reason, item.sale_id, NULL, item.created_by
       )
       FROM jsonb_to_recordset($1::jsonb) AS item(
         workshop_id uuid, product_id uuid, sale_id uuid,
         quantity_change numeric, reason text, created_by uuid
       )`,
      [
        JSON.stringify(
          movements.map((movement) => ({
            workshop_id: movement.workshopId,
            product_id: movement.productId,
            sale_id: movement.saleId,
            quantity_change: movement.quantityChange,
            reason: movement.reason,
            created_by: movement.createdBy,
          })),
        ),
      ],
    );
  }

  async appendAuditLog(input: {
    workshopId: string;
    actorId: string;
    action: "sale.voided";
    entityType: "sale";
    entityId: string;
    previousValue: { status: "completed" };
    newValue: { status: "void"; reason: string };
  }) {
    await this.activeClient().query(
      `INSERT INTO audit_logs (
         workshop_id, actor_id, action, entity_type, entity_id, previous_value, new_value
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        input.workshopId,
        input.actorId,
        input.action,
        input.entityType,
        input.entityId,
        JSON.stringify(input.previousValue),
        JSON.stringify(input.newValue),
      ],
    );
  }

  private activeClient() {
    if (!this.client) {
      throw new Error("Void database operation requires an active transaction");
    }
    return this.client;
  }
}
