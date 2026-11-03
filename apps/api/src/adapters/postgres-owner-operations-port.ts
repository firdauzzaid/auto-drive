import type { Pool, PoolClient } from "pg";

export class PostgresOwnerOperationsPort {
  private readonly pool: Pool;
  private readonly workshopId: string;
  private readonly userId: string;

  constructor(pool: Pool, workshopId: string, userId: string) {
    this.pool = pool;
    this.workshopId = workshopId;
    this.userId = userId;
  }

  async createExpense(input: { name: string; amount: number; occurredAt: string; createdBy: string }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO expenses (workshop_id, name, amount, occurred_at, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [this.workshopId, input.name, input.amount, input.occurredAt, input.createdBy],
      );
      return result.rows[0];
    });
  }

  async getDashboard() {
    return this.withContext(async (client) => {
      const totals = await client.query<{
        revenue: string; gross_profit: string; transaction_count: number; expense_total: string;
      }>(
        `SELECT
           COALESCE((SELECT sum(total) FROM sales WHERE workshop_id = $1 AND status = 'completed'), 0) AS revenue,
           COALESCE((SELECT sum(sales.total - COALESCE(costs.total_cost, 0))
             FROM sales
             LEFT JOIN LATERAL (
               SELECT sum(unit_cost * quantity) AS total_cost
               FROM sale_items WHERE sale_id = sales.id
             ) costs ON true
             WHERE sales.workshop_id = $1 AND sales.status = 'completed'), 0) AS gross_profit,
           (SELECT count(*)::int FROM sales WHERE workshop_id = $1 AND status = 'completed') AS transaction_count,
           COALESCE((SELECT sum(amount) FROM expenses WHERE workshop_id = $1), 0) AS expense_total`,
        [this.workshopId],
      );
      const lowStock = await client.query<{ id: string; name: string; stock_on_hand: string; minimum_stock: string }>(
        `SELECT id, name, stock_on_hand, minimum_stock FROM products
         WHERE workshop_id = $1 AND active AND stock_on_hand <= minimum_stock ORDER BY stock_on_hand, name`,
        [this.workshopId],
      );
      const result = totals.rows[0];
      return {
        revenue: Number(result.revenue), grossProfit: Number(result.gross_profit), transactionCount: result.transaction_count,
        expenseTotal: Number(result.expense_total),
        lowStock: lowStock.rows.map((product) => ({
          id: product.id, name: product.name, stockOnHand: Number(product.stock_on_hand), minimumStock: Number(product.minimum_stock),
        })),
      };
    });
  }

  async getPeriodReport(input: { from: string; to: string }) {
    return this.withContext(async (client) => {
      const result = await client.query<{
        revenue: string; gross_profit: string; transaction_count: number; expense_total: string;
      }>(
        `WITH completed_sales AS (
           SELECT id, total
           FROM sales
           WHERE workshop_id = $1 AND status = 'completed' AND completed_at >= $2 AND completed_at < $3
         ), sale_totals AS (
           SELECT
             COALESCE(sum(completed_sales.total), 0) AS revenue,
             COALESCE(sum(completed_sales.total - COALESCE(costs.total_cost, 0)), 0) AS gross_profit,
             count(*)::int AS transaction_count
           FROM completed_sales
           LEFT JOIN LATERAL (
             SELECT sum(unit_cost * quantity) AS total_cost
             FROM sale_items WHERE sale_id = completed_sales.id
           ) costs ON true
         )
         SELECT sale_totals.revenue, sale_totals.gross_profit, sale_totals.transaction_count,
           COALESCE((SELECT sum(amount) FROM expenses WHERE workshop_id = $1 AND occurred_at >= $2 AND occurred_at < $3), 0) AS expense_total
         FROM sale_totals`,
        [this.workshopId, input.from, input.to],
      );
      const report = result.rows[0];
      const topProducts = await client.query<{
        product_id: string; name: string; quantity: string; revenue: string;
      }>(
        `SELECT sale_items.product_id,
           (array_agg(sale_items.name_snapshot ORDER BY sales.completed_at DESC, sale_items.id DESC))[1] AS name,
           sum(sale_items.quantity) AS quantity, sum(sale_items.line_total) AS revenue
         FROM sales
         JOIN sale_items ON sale_items.sale_id = sales.id
         WHERE sales.workshop_id = $1 AND sales.status = 'completed'
           AND sales.completed_at >= $2 AND sales.completed_at < $3
           AND sale_items.product_id IS NOT NULL
         GROUP BY sale_items.product_id
         ORDER BY sum(sale_items.quantity) DESC, sum(sale_items.line_total) DESC, sale_items.product_id
         LIMIT 5`,
        [this.workshopId, input.from, input.to],
      );
      const recentTransactions = await client.query<{
        id: string; transaction_number: string; total: string; completed_at: Date;
      }>(
        `SELECT id, transaction_number, total, completed_at
         FROM sales
         WHERE workshop_id = $1 AND status = 'completed' AND completed_at >= $2 AND completed_at < $3
         ORDER BY completed_at DESC, id DESC
         LIMIT 5`,
        [this.workshopId, input.from, input.to],
      );
      return {
        revenue: Number(report.revenue),
        grossProfit: Number(report.gross_profit),
        transactionCount: report.transaction_count,
        expenseTotal: Number(report.expense_total),
        topProducts: topProducts.rows.map((product) => ({
          productId: product.product_id, name: product.name, quantity: Number(product.quantity), revenue: Number(product.revenue),
        })),
        recentTransactions: recentTransactions.rows.map((sale) => ({
          id: sale.id, transactionNumber: sale.transaction_number, total: Number(sale.total), completedAt: sale.completed_at,
        })),
      };
    });
  }

  private async withContext<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
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
