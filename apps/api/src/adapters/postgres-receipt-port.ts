import type { Pool, PoolClient } from "pg";

export class PostgresReceiptPort {
  private readonly pool: Pool;
  private readonly workshopId: string;
  private readonly userId: string;

  constructor(pool: Pool, workshopId: string, userId: string) {
    this.pool = pool;
    this.workshopId = workshopId;
    this.userId = userId;
  }

  async getReceipt(saleId: string) {
    return this.withContext(async (client) => {
      const sale = await client.query<{
        id: string; transaction_number: string; status: "completed" | "void"; subtotal: string; discount: string; total: string; completed_at: Date;
      }>(
        `SELECT id, transaction_number, status, subtotal, discount, total, completed_at
         FROM sales WHERE id = $1 AND workshop_id = $2`, [saleId, this.workshopId],
      );
      const header = sale.rows[0];
      if (!header) return null;
      const [items, payment] = await Promise.all([
        client.query<{
          product_id: string | null; name_snapshot: string; sku_snapshot: string | null; quantity: string; unit_price: string; line_total: string;
        }>(
          `SELECT product_id, name_snapshot, sku_snapshot, quantity, unit_price, line_total
           FROM sale_items WHERE sale_id = $1 ORDER BY created_at, id`, [saleId],
        ),
        client.query<{ method: "cash" | "qris" | "bank_transfer"; amount: string }>(
          "SELECT method, amount FROM payments WHERE sale_id = $1 ORDER BY received_at, id LIMIT 1", [saleId],
        ),
      ]);
      const paid = payment.rows[0];
      return {
        id: header.id,
        transactionNumber: header.transaction_number,
        status: header.status,
        subtotal: Number(header.subtotal),
        discount: Number(header.discount),
        total: Number(header.total),
        completedAt: header.completed_at,
        items: items.rows.map((item) => ({
          type: item.product_id ? "product" as const : "service" as const,
          name: item.name_snapshot,
          sku: item.sku_snapshot,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
        })),
        payment: paid && { method: paid.method, amount: Number(paid.amount) },
      };
    });
  }

  private async withContext<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE bengkel_api");
      await client.query("SELECT set_config('app.user_id', $1, true)", [this.userId]);
      await client.query("SELECT set_config('app.workshop_id', $1, true)", [this.workshopId]);
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
