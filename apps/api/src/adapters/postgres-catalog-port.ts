import type { Pool, PoolClient } from "pg";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  stock_on_hand: string;
  selling_price: string;
  current_cost: string;
  category_id: string | null;
  minimum_stock: string;
  active: boolean;
};

function productAuditValue(product: ProductRow) {
  return {
    categoryId: product.category_id,
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    minimumStock: Number(product.minimum_stock),
    sellingPrice: Number(product.selling_price),
    currentCost: Number(product.current_cost),
    active: product.active,
  };
}

export class PostgresCatalogPort {
  private readonly pool: Pool;
  private readonly workshopId: string;
  private readonly userId: string;

  constructor(pool: Pool, workshopId: string, userId: string) {
    this.pool = pool;
    this.workshopId = workshopId;
    this.userId = userId;
  }

  async createProduct(input: { name: string; sku: string | null; unit: string; sellingPrice: number; currentCost: number; categoryId: string | null; minimumStock: number }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO products (workshop_id, category_id, name, sku, unit, selling_price, current_cost, minimum_stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [this.workshopId, input.categoryId, input.name, input.sku, input.unit, input.sellingPrice, input.currentCost, input.minimumStock],
      );
      return result.rows[0];
    });
  }

  async listProducts(includeInactive: boolean) {
    return this.withContext(async (client) => {
      const result = await client.query<ProductRow>(
        `SELECT id, category_id, name, sku, unit, stock_on_hand, minimum_stock, selling_price, current_cost, active
         FROM products WHERE workshop_id = $1 AND ($2 OR active) ORDER BY name`,
        [this.workshopId, includeInactive],
      );
      return result.rows.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        stockOnHand: Number(product.stock_on_hand),
        minimumStock: Number(product.minimum_stock),
        sellingPrice: Number(product.selling_price),
        currentCost: Number(product.current_cost),
        categoryId: product.category_id,
        active: product.active,
      }));
    });
  }

  async updateProduct(input: {
    id: string; categoryId?: string | null; name?: string; sku?: string | null; unit?: string;
    minimumStock?: number; sellingPrice?: number; currentCost?: number; active?: boolean;
  }) {
    return this.withContext(async (client) => {
      const previous = await client.query<ProductRow>(
        `SELECT id, category_id, name, sku, unit, stock_on_hand, minimum_stock, selling_price, current_cost, active
         FROM products WHERE id = $1 AND workshop_id = $2 FOR UPDATE`,
        [input.id, this.workshopId],
      );
      if (!previous.rows[0]) return null;
      const result = await client.query<ProductRow>(
        `UPDATE products
         SET category_id = CASE WHEN $3 THEN $4::uuid ELSE category_id END,
             name = COALESCE($5, name), sku = CASE WHEN $6 THEN $7::text ELSE sku END,
             unit = COALESCE($8, unit), minimum_stock = COALESCE($9, minimum_stock),
             selling_price = COALESCE($10, selling_price), current_cost = COALESCE($11, current_cost),
             active = COALESCE($12, active)
         WHERE id = $1 AND workshop_id = $2
         RETURNING id, category_id, name, sku, unit, stock_on_hand, minimum_stock, selling_price, current_cost, active`,
        [
          input.id, this.workshopId, input.categoryId !== undefined, input.categoryId ?? null,
          input.name, input.sku !== undefined, input.sku ?? null, input.unit, input.minimumStock,
          input.sellingPrice, input.currentCost, input.active,
        ],
      );
      const product = result.rows[0];
      if (!product) return null;
      await client.query(
        `INSERT INTO audit_logs (
           workshop_id, actor_id, action, entity_type, entity_id, previous_value, new_value
         ) VALUES ($1, $2, 'product.updated', 'product', $3, $4::jsonb, $5::jsonb)`,
        [
          this.workshopId, this.userId, product.id,
          JSON.stringify(productAuditValue(previous.rows[0])), JSON.stringify(productAuditValue(product)),
        ],
      );
      return {
        id: product.id, name: product.name, sku: product.sku, unit: product.unit,
        stockOnHand: Number(product.stock_on_hand), minimumStock: Number(product.minimum_stock),
        sellingPrice: Number(product.selling_price), currentCost: Number(product.current_cost),
        categoryId: product.category_id, active: product.active,
      };
    });
  }

  async createService(input: { name: string; sellingPrice: number; categoryId: string | null }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO services (workshop_id, category_id, name, selling_price) VALUES ($1, $2, $3, $4) RETURNING id",
        [this.workshopId, input.categoryId, input.name, input.sellingPrice],
      );
      return result.rows[0];
    });
  }

  async createServiceCategory(name: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO service_categories (workshop_id, name) VALUES ($1, $2) RETURNING id",
        [this.workshopId, name],
      );
      return result.rows[0];
    });
  }

  async listServiceCategories() {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        "SELECT id, name FROM service_categories WHERE workshop_id = $1 ORDER BY name", [this.workshopId],
      );
      return result.rows;
    });
  }

  async updateServiceCategory(id: string, name: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        "UPDATE service_categories SET name = $3 WHERE id = $1 AND workshop_id = $2 RETURNING id, name",
        [id, this.workshopId, name],
      );
      return result.rows[0] ?? null;
    });
  }

  async deleteServiceCategory(id: string) {
    return this.withContext(async (client) => {
      const result = await client.query(
        "DELETE FROM service_categories WHERE id = $1 AND workshop_id = $2", [id, this.workshopId],
      );
      return result.rowCount === 1;
    });
  }

  async createProductCategory(name: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO product_categories (workshop_id, name) VALUES ($1, $2) RETURNING id",
        [this.workshopId, name],
      );
      return result.rows[0];
    });
  }

  async listProductCategories() {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        "SELECT id, name FROM product_categories WHERE workshop_id = $1 ORDER BY name", [this.workshopId],
      );
      return result.rows;
    });
  }

  async updateProductCategory(id: string, name: string) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string }>(
        "UPDATE product_categories SET name = $3 WHERE id = $1 AND workshop_id = $2 RETURNING id, name",
        [id, this.workshopId, name],
      );
      return result.rows[0] ?? null;
    });
  }

  async deleteProductCategory(id: string) {
    return this.withContext(async (client) => {
      const result = await client.query(
        "DELETE FROM product_categories WHERE id = $1 AND workshop_id = $2", [id, this.workshopId],
      );
      return result.rowCount === 1;
    });
  }

  async createSupplier(input: { name: string; phone: string | null; address: string | null }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string }>(
        "INSERT INTO suppliers (workshop_id, name, phone, address) VALUES ($1, $2, $3, $4) RETURNING id",
        [this.workshopId, input.name, input.phone, input.address],
      );
      return result.rows[0];
    });
  }

  async listSuppliers() {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string; phone: string | null; address: string | null }>(
        "SELECT id, name, phone, address FROM suppliers WHERE workshop_id = $1 ORDER BY name", [this.workshopId],
      );
      return result.rows;
    });
  }

  async updateSupplier(input: { id: string; name?: string; phone?: string | null; address?: string | null }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string; phone: string | null; address: string | null }>(
        `UPDATE suppliers
         SET name = COALESCE($3, name), phone = CASE WHEN $4 THEN $5::text ELSE phone END,
             address = CASE WHEN $6 THEN $7::text ELSE address END
         WHERE id = $1 AND workshop_id = $2
         RETURNING id, name, phone, address`,
        [input.id, this.workshopId, input.name, input.phone !== undefined, input.phone ?? null, input.address !== undefined, input.address ?? null],
      );
      return result.rows[0] ?? null;
    });
  }

  async deleteSupplier(id: string) {
    return this.withContext(async (client) => {
      const result = await client.query("DELETE FROM suppliers WHERE id = $1 AND workshop_id = $2", [id, this.workshopId]);
      return result.rowCount === 1;
    });
  }

  async listServices(includeInactive: boolean) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string; selling_price: string; active: boolean }>(
        "SELECT id, name, selling_price, active FROM services WHERE workshop_id = $1 AND ($2 OR active) ORDER BY name",
        [this.workshopId, includeInactive],
      );
      return result.rows.map((service) => ({
        id: service.id, name: service.name, sellingPrice: Number(service.selling_price), active: service.active,
      }));
    });
  }

  async updateService(input: { id: string; name?: string; sellingPrice?: number; active?: boolean }) {
    return this.withContext(async (client) => {
      const result = await client.query<{ id: string; name: string; selling_price: string; active: boolean }>(
        `UPDATE services
         SET name = COALESCE($3, name), selling_price = COALESCE($4, selling_price), active = COALESCE($5, active)
         WHERE id = $1 AND workshop_id = $2
         RETURNING id, name, selling_price, active`,
        [input.id, this.workshopId, input.name, input.sellingPrice, input.active],
      );
      const service = result.rows[0];
      return service && { id: service.id, name: service.name, sellingPrice: Number(service.selling_price), active: service.active };
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
