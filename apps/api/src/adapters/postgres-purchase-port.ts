import type { Pool, PoolClient } from "pg";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
};

export class PostgresPurchasePort {
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

  async lockProducts(ids: string[]) {
    const result = await this.activeClient().query<ProductRow>(
      `SELECT id, name, sku, active
       FROM app.lock_products($1, $2::uuid[])`,
      [this.workshopId, ids],
    );
    return result.rows;
  }

  async findCompletedPurchaseByIdempotencyKey(key: string) {
    const result = await this.activeClient().query<{ id: string; total: string; supplier_id: string | null }>(
      "SELECT id, total, supplier_id FROM purchases WHERE workshop_id = $1 AND idempotency_key = $2",
      [this.workshopId, key],
    );
    const purchase = result.rows[0];
    return purchase ? { id: purchase.id, total: Number(purchase.total), supplierId: purchase.supplier_id } : null;
  }

  async createPurchase(input: { workshopId: string; supplierId: string | null; completedBy: string; subtotal: number; total: number; idempotencyKey: string | null }) {
    const result = await this.activeClient().query<{ id: string; supplier_id: string | null }>(
      `INSERT INTO purchases (workshop_id, supplier_id, purchase_number, subtotal, total, completed_by, idempotency_key)
       VALUES ($1, $2, 'PUR-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)), $3, $4, $5, $6)
       RETURNING id, supplier_id`,
      [input.workshopId, input.supplierId, input.subtotal, input.total, input.completedBy, input.idempotencyKey],
    );
    return { id: result.rows[0].id, supplierId: result.rows[0].supplier_id };
  }

  async createPurchaseItems(items: Array<{
    purchaseId: string;
    productId: string;
    nameSnapshot: string;
    skuSnapshot: string | null;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>) {
    await this.activeClient().query(
      `INSERT INTO purchase_items (
         purchase_id, product_id, name_snapshot, sku_snapshot, quantity, unit_cost, line_total
       )
       SELECT purchase_id, product_id, name_snapshot, sku_snapshot, quantity, unit_cost, line_total
       FROM jsonb_to_recordset($1::jsonb) AS item(
         purchase_id uuid, product_id uuid, name_snapshot text, sku_snapshot text,
         quantity numeric, unit_cost bigint, line_total bigint
       )`,
      [
        JSON.stringify(
          items.map((item) => ({
            purchase_id: item.purchaseId,
            product_id: item.productId,
            name_snapshot: item.nameSnapshot,
            sku_snapshot: item.skuSnapshot,
            quantity: item.quantity,
            unit_cost: item.unitCost,
            line_total: item.lineTotal,
          })),
        ),
      ],
    );
  }

  async applyPurchaseMovements(movements: Array<{
    workshopId: string;
    productId: string;
    purchaseId: string;
    quantityChange: number;
    unitCost: number;
    createdBy: string;
  }>) {
    await this.activeClient().query(
      `SELECT app.apply_purchase_movement(
         item.workshop_id, item.product_id, item.quantity_change,
         item.purchase_id, item.unit_cost, item.created_by
       )
       FROM jsonb_to_recordset($1::jsonb) AS item(
         workshop_id uuid, product_id uuid, purchase_id uuid,
         quantity_change numeric, unit_cost bigint, created_by uuid
       )`,
      [
        JSON.stringify(
          movements.map((movement) => ({
            workshop_id: movement.workshopId,
            product_id: movement.productId,
            purchase_id: movement.purchaseId,
            quantity_change: movement.quantityChange,
            unit_cost: movement.unitCost,
            created_by: movement.createdBy,
          })),
        ),
      ],
    );
  }

  private activeClient() {
    if (!this.client) {
      throw new Error("Purchase database operation requires an active transaction");
    }
    return this.client;
  }
}
