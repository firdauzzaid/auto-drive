import type { Pool, PoolClient } from "pg";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  stock_on_hand: string;
  selling_price: string;
  current_cost: string;
  active: boolean;
};

type SaleItem = {
  saleId: string;
  productId: string | null;
  serviceId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
};

type InventoryMovement = {
  workshopId: string;
  productId: string;
  saleId: string;
  previousStock: number;
  quantityChange: number;
  newStock: number;
  reason: "sale";
  createdBy: string;
};

export class PostgresCheckoutPort {
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
      `SELECT id, name, sku, stock_on_hand, selling_price, current_cost, active
       FROM app.lock_products($1, $2::uuid[])`,
      [this.workshopId, ids],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      stockOnHand: Number(row.stock_on_hand),
      sellingPrice: Number(row.selling_price),
      currentCost: Number(row.current_cost),
      active: row.active,
    }));
  }

  async lockServices(ids: string[]) {
    const result = await this.activeClient().query<{ id: string; name: string; selling_price: string; active: boolean }>(
      "SELECT id, name, selling_price, active FROM services WHERE workshop_id = $1 AND id = ANY($2::uuid[]) FOR UPDATE",
      [this.workshopId, ids],
    );
    return result.rows.map((service) => ({ id: service.id, name: service.name, sellingPrice: Number(service.selling_price), active: service.active }));
  }

  async validateSaleReferences(input: { customerId: string | null; vehicleId: string | null }) {
    const result = await this.activeClient().query<{ valid: boolean }>(
      `SELECT
         ($1::uuid IS NULL OR EXISTS (
           SELECT 1 FROM customers WHERE id = $1 AND workshop_id = $3
         ))
         AND
         ($2::uuid IS NULL OR EXISTS (
           SELECT 1 FROM vehicles WHERE id = $2 AND workshop_id = $3
         ))
         AND
         ($1::uuid IS NULL OR $2::uuid IS NULL OR EXISTS (
           SELECT 1 FROM vehicles WHERE id = $2 AND customer_id = $1 AND workshop_id = $3
         )) AS valid`,
      [input.customerId, input.vehicleId, this.workshopId],
    );
    return result.rows[0].valid;
  }

  async findCompletedSaleByIdempotencyKey(key: string) {
    const result = await this.activeClient().query<{ id: string; total: string }>(
      "SELECT id, total FROM sales WHERE workshop_id = $1 AND idempotency_key = $2 AND status = 'completed'",
      [this.workshopId, key],
    );
    const sale = result.rows[0];
    return sale ? { id: sale.id, total: Number(sale.total) } : null;
  }

  async createSale(input: {
    workshopId: string;
    customerId: string | null;
    vehicleId: string | null;
    completedBy: string;
    subtotal: number;
    discount: number;
    total: number;
    idempotencyKey: string | null;
  }) {
    const result = await this.activeClient().query<{ id: string }>(
      `INSERT INTO sales (
         workshop_id, transaction_number, customer_id, vehicle_id, status,
         subtotal, discount, total, completed_by, completed_at, idempotency_key
       ) VALUES (
         $1,
         'TRX-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)),
         $2, $3, 'completed', $4, $5, $6, $7, now(), $8
       ) RETURNING id`,
      [
        input.workshopId,
        input.customerId,
        input.vehicleId,
        input.subtotal,
        input.discount,
        input.total,
        input.completedBy,
        input.idempotencyKey,
      ],
    );
    return result.rows[0];
  }

  async createSaleItems(items: SaleItem[]) {
    await this.activeClient().query(
      `INSERT INTO sale_items (
         sale_id, product_id, service_id, name_snapshot, sku_snapshot,
         quantity, unit_price, unit_cost, line_total
       )
       SELECT sale_id, product_id, service_id, name_snapshot, sku_snapshot,
              quantity, unit_price, unit_cost, line_total
       FROM jsonb_to_recordset($1::jsonb) AS item(
         sale_id uuid, product_id uuid, service_id uuid, name_snapshot text,
         sku_snapshot text, quantity numeric, unit_price bigint, unit_cost bigint,
         line_total bigint
       )`,
      [
        JSON.stringify(
          items.map((item) => ({
            sale_id: item.saleId,
            product_id: item.productId,
            service_id: item.serviceId,
            name_snapshot: item.nameSnapshot,
            sku_snapshot: item.skuSnapshot,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit_cost: item.unitCost,
            line_total: item.lineTotal,
          })),
        ),
      ],
    );
  }

  async createPayment(input: {
    saleId: string;
    method: "cash" | "qris" | "bank_transfer";
    amount: number;
    receivedBy: string;
  }) {
    await this.activeClient().query(
      `INSERT INTO payments (sale_id, method, amount, received_by)
       VALUES ($1, $2, $3, $4)`,
      [input.saleId, input.method, input.amount, input.receivedBy],
    );
  }

  async applyInventoryMovements(movements: InventoryMovement[]) {
    await this.activeClient().query(
      `SELECT app.apply_inventory_movement(
         item.workshop_id,
         item.product_id,
         item.quantity_change,
         item.reason::inventory_movement_reason,
         item.sale_id,
         NULL,
         item.created_by
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

  private activeClient() {
    if (!this.client) {
      throw new Error("Checkout database operation requires an active transaction");
    }

    return this.client;
  }
}
