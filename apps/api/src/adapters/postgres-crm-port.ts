import type { Pool, PoolClient } from "pg";

export class PostgresCrmPort {
  private readonly pool: Pool;
  private readonly workshopId: string;
  private readonly userId: string;

  constructor(pool: Pool, workshopId: string, userId: string) {
    this.pool = pool;
    this.workshopId = workshopId;
    this.userId = userId;
  }

  async createCustomer(input: { name: string; phone: string | null }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO customers (workshop_id, name, phone) VALUES ($1, $2, $3) RETURNING id",
        [this.workshopId, input.name, input.phone],
      );
      return result.rows[0];
    });
  }

  async createVehicle(input: { customerId: string; plateNumber: string | null; brand: string | null; model: string | null }) {
    return this.withContext(async (client) => {
      const customer = await client.query("SELECT id FROM customers WHERE id = $1 AND workshop_id = $2", [input.customerId, this.workshopId]);
      if (!customer.rows[0]) {
        throw new Error("Customer not found");
      }
      const result = await client.query<{ id: string }>(
        `INSERT INTO vehicles (workshop_id, customer_id, plate_number, brand, model)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [this.workshopId, input.customerId, input.plateNumber, input.brand, input.model],
      );
      return result.rows[0];
    });
  }

  async findVehiclesByPlate(plate: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{
        id: string; plate_number: string | null; brand: string | null; model: string | null; customer_name: string;
      }>(
        `SELECT vehicles.id, vehicles.plate_number, vehicles.brand, vehicles.model, customers.name AS customer_name
         FROM vehicles JOIN customers ON customers.id = vehicles.customer_id
         WHERE vehicles.workshop_id = $1 AND vehicles.normalized_plate = $2`,
        [this.workshopId, plate],
      );
      return result.rows.map((vehicle) => ({
        id: vehicle.id, plateNumber: vehicle.plate_number, brand: vehicle.brand, model: vehicle.model, customerName: vehicle.customer_name,
      }));
    });
  }

  async listVehicleHistory(vehicleId: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{
        id: string; transaction_number: string; status: "completed"; total: string; completed_at: Date;
      }>(
        `SELECT id, transaction_number, status, total, completed_at
         FROM sales
         WHERE workshop_id = $1 AND vehicle_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC, id DESC`,
        [this.workshopId, vehicleId],
      );
      return result.rows.map((sale) => ({
        id: sale.id,
        transactionNumber: sale.transaction_number,
        status: sale.status,
        total: Number(sale.total),
        completedAt: sale.completed_at,
      }));
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
