import type { Pool } from "pg";
import type { InjectOptions } from "fastify";

import { buildApp } from "../../server.ts";

type SeedInput = {
  ownerEmail: string;
  ownerPassword: string;
  cashierEmail: string;
  cashierPassword: string;
  workshopName: string;
};

type App = ReturnType<typeof buildApp>;
type Request = InjectOptions;
type NamedResource = { id: string; name: string };
type Product = NamedResource & { sku: string | null };
type Vehicle = { id: string };

async function request<T>(app: App, input: Request, accepted = [200, 201]): Promise<T> {
  const response = await app.inject(input);
  if (!accepted.includes(response.statusCode)) {
    throw new Error(`Demo seed request ${input.method} ${input.url} failed with ${response.statusCode}: ${response.body}`);
  }
  return response.json() as T;
}

async function findWorkshop(pool: Pool, input: SeedInput) {
  const result = await pool.query<{ id: string }>(
    `SELECT workshops.id
     FROM memberships
     JOIN users ON users.id = memberships.user_id
     JOIN workshops ON workshops.id = memberships.workshop_id
     WHERE users.email = lower($1) AND workshops.name = $2 AND memberships.role = 'owner' AND memberships.active
     LIMIT 1`,
    [input.ownerEmail, input.workshopName],
  );
  return result.rows[0]?.id ?? null;
}

async function ensureNamedResource(app: App, url: string, name: string, headers: Record<string, string>) {
  const existing = await request<NamedResource[]>(app, { method: "GET", url, headers });
  const found = existing.find((item) => item.name === name);
  if (found) return found.id;
  const created = await request<NamedResource>(app, { method: "POST", url, headers, payload: { name } });
  return created.id;
}

export async function seedDemo(input: { pool: Pool } & SeedInput) {
  const app = buildApp({ pool: input.pool });
  try {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: input.ownerEmail, password: input.ownerPassword, workshopName: input.workshopName },
    });
    const workshopId = registration.statusCode === 201
      ? (registration.json() as { workshopId: string }).workshopId
      : registration.statusCode === 409 ? await findWorkshop(input.pool, input) : null;
    if (!workshopId) throw new Error(`Unable to create or find demo workshop: ${registration.body}`);

    const login = await request<{ token: string }>(app, {
      method: "POST", url: "/auth/login", payload: { email: input.ownerEmail, password: input.ownerPassword },
    });
    const headers = { authorization: `Bearer ${login.token}`, "x-workshop-id": workshopId };

    const cashier = await app.inject({
      method: "POST", url: "/memberships/cashiers", headers,
      payload: { email: input.cashierEmail, password: input.cashierPassword },
    });
    if (![201, 409].includes(cashier.statusCode)) throw new Error(`Unable to create demo cashier: ${cashier.body}`);

    const productCategoryId = await ensureNamedResource(app, "/product-categories", "Pelumas Demo", headers);
    const serviceCategoryId = await ensureNamedResource(app, "/service-categories", "Perawatan Demo", headers);
    const suppliers = await request<Array<NamedResource>>(app, { method: "GET", url: "/suppliers", headers });
    const supplier = suppliers.find((item) => item.name === "Supplier Demo")
      ?? await request<NamedResource>(app, {
        method: "POST", url: "/suppliers", headers,
        payload: { name: "Supplier Demo", phone: "081234567890", address: "Alamat demo" },
      });

    const products = await request<Product[]>(app, { method: "GET", url: "/products?includeInactive=true", headers });
    const productInputs = [
      { name: "Oli MPX2 10W-30", sku: "DEMO-OLI-MPX2", unit: "botol", sellingPrice: 95000, currentCost: 70000, categoryId: productCategoryId },
      { name: "Busi NGK CPR6EA-9", sku: "DEMO-BUSI-NGK", unit: "pcs", sellingPrice: 28000, currentCost: 18000, categoryId: productCategoryId },
      { name: "Kampas Rem Depan", sku: "DEMO-KAMPAS-REM", unit: "set", sellingPrice: 85000, currentCost: 60000, categoryId: productCategoryId },
    ];
    const productIds = new Map<string, string>();
    for (const productInput of productInputs) {
      const existing = products.find((product) => product.sku === productInput.sku);
      const product = existing ?? await request<{ id: string }>(app, { method: "POST", url: "/products", headers, payload: productInput });
      productIds.set(productInput.sku, product.id);
    }

    const services = await request<NamedResource[]>(app, { method: "GET", url: "/services?includeInactive=true", headers });
    const serviceInputs = [
      { name: "Jasa Ganti Oli Demo", sellingPrice: 20000, categoryId: serviceCategoryId },
      { name: "Servis Ringan Demo", sellingPrice: 75000, categoryId: serviceCategoryId },
    ];
    const serviceIds = new Map<string, string>();
    for (const serviceInput of serviceInputs) {
      const existing = services.find((service) => service.name === serviceInput.name);
      const service = existing ?? await request<{ id: string }>(app, { method: "POST", url: "/services", headers, payload: serviceInput });
      serviceIds.set(serviceInput.name, service.id);
    }

    await request(app, {
      method: "POST", url: "/purchases", headers: { ...headers, "idempotency-key": "demo-seed-purchase-v1" },
      payload: {
        supplierId: supplier.id,
        items: [
          { productId: productIds.get("DEMO-OLI-MPX2"), quantity: 24, unitCost: 70000 },
          { productId: productIds.get("DEMO-BUSI-NGK"), quantity: 10, unitCost: 18000 },
          { productId: productIds.get("DEMO-KAMPAS-REM"), quantity: 8, unitCost: 60000 },
        ],
      },
    });

    const vehicles = await request<Vehicle[]>(app, { method: "GET", url: "/vehicles?plate=B%201234%20DEMO", headers });
    const vehicleId = vehicles[0]?.id ?? await (async () => {
      const customer = await request<{ id: string }>(app, {
        method: "POST", url: "/customers", headers, payload: { name: "Pelanggan Demo", phone: "081234567891" },
      });
      const vehicle = await request<{ id: string }>(app, {
        method: "POST", url: "/vehicles", headers,
        payload: { customerId: customer.id, plateNumber: "B 1234 DEMO", brand: "Honda", model: "Vario" },
      });
      return vehicle.id;
    })();

    await request(app, {
      method: "POST", url: "/sales", headers: { ...headers, "idempotency-key": "demo-seed-sale-v1" },
      payload: {
        vehicleId,
        items: [
          { kind: "product", id: productIds.get("DEMO-OLI-MPX2"), quantity: 1 },
          { kind: "service", id: serviceIds.get("Jasa Ganti Oli Demo"), quantity: 1 },
        ],
        discount: 5000,
        paymentMethod: "qris",
      },
    });

    return { workshopId };
  } finally {
    await app.close();
  }
}
