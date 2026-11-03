import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import { databaseUrl } from "./test-database.ts";

import { buildApp } from "../src/server.ts";


test("owner can create and read products in the active workshop", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => {
    await app.close();
    await pool.end();
  });
  const email = `catalog-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password, workshopName: "Bengkel Catalog" },
  });
  const loginResponse = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = {
    authorization: `Bearer ${loginResponse.json().token}`,
    "x-workshop-id": registration.json().workshopId,
  };

  const created = await app.inject({
    method: "POST",
    url: "/products",
    headers,
    payload: { name: "Oli MPX2", sku: "MPX2", unit: "botol", sellingPrice: 95000, currentCost: 70000 },
  });
  const products = await app.inject({ method: "GET", url: "/products", headers });

  assert.equal(created.statusCode, 201);
  assert.deepEqual(products.json(), [
    { id: created.json().id, name: "Oli MPX2", sku: "MPX2", unit: "botol", stockOnHand: 0, minimumStock: 0, sellingPrice: 95000, currentCost: 70000, categoryId: null, active: true },
  ]);
});

test("owner can update and deactivate a product without changing stock", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const email = `product-update-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Produk" },
  });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": registration.json().workshopId };
  const created = await app.inject({
    method: "POST", url: "/products", headers,
    payload: { name: "Oli MPX2", sku: "MPX2-UPDATE", unit: "botol", sellingPrice: 95000, currentCost: 70000 },
  });
  const updated = await app.inject({
    method: "PATCH", url: `/products/${created.json().id}`, headers,
    payload: { name: "Oli MPX2 Racing", sellingPrice: 100000, currentCost: 75000, minimumStock: 4, active: false },
  });
  const activeProducts = await app.inject({ method: "GET", url: "/products", headers });
  const allProducts = await app.inject({ method: "GET", url: "/products?includeInactive=true", headers });
  const audit = await pool.query<{ action: string; previous_value: Record<string, unknown>; new_value: Record<string, unknown> }>(
    "SELECT action, previous_value, new_value FROM audit_logs WHERE entity_id = $1", [created.json().id],
  );

  assert.equal(updated.statusCode, 200);
  assert.deepEqual(activeProducts.json(), []);
  assert.deepEqual(allProducts.json(), [{
    id: created.json().id, name: "Oli MPX2 Racing", sku: "MPX2-UPDATE", unit: "botol",
    stockOnHand: 0, minimumStock: 4, sellingPrice: 100000, currentCost: 75000, categoryId: null, active: false,
  }]);
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].action, "product.updated");
  assert.deepEqual(
    { sellingPrice: audit.rows[0].previous_value.sellingPrice, currentCost: audit.rows[0].previous_value.currentCost, minimumStock: audit.rows[0].previous_value.minimumStock, active: audit.rows[0].previous_value.active },
    { sellingPrice: 95000, currentCost: 70000, minimumStock: 0, active: true },
  );
  assert.deepEqual(
    { sellingPrice: audit.rows[0].new_value.sellingPrice, currentCost: audit.rows[0].new_value.currentCost, minimumStock: audit.rows[0].new_value.minimumStock, active: audit.rows[0].new_value.active },
    { sellingPrice: 100000, currentCost: 75000, minimumStock: 4, active: false },
  );
});

test("owner can update and deactivate a service without deleting it", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const email = `service-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Service" },
  });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": registration.json().workshopId };
  const created = await app.inject({
    method: "POST", url: "/services", headers, payload: { name: "Ganti oli", sellingPrice: 20000 },
  });
  const updated = await app.inject({
    method: "PATCH", url: `/services/${created.json().id}`, headers, payload: { sellingPrice: 25000 },
  });
  const services = await app.inject({ method: "GET", url: "/services", headers });
  const deactivated = await app.inject({
    method: "PATCH", url: `/services/${created.json().id}`, headers, payload: { active: false },
  });
  const activeServices = await app.inject({ method: "GET", url: "/services", headers });
  const allServices = await app.inject({ method: "GET", url: "/services?includeInactive=true", headers });

  assert.equal(created.statusCode, 201);
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(services.json(), [{ id: created.json().id, name: "Ganti oli", sellingPrice: 25000, active: true }]);
  assert.equal(deactivated.statusCode, 200);
  assert.deepEqual(activeServices.json(), []);
  assert.deepEqual(allServices.json(), [{ id: created.json().id, name: "Ganti oli", sellingPrice: 25000, active: false }]);
});

test("owner can manage service categories and assign one to a service", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const email = `category-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Kategori" },
  });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": registration.json().workshopId };
  const created = await app.inject({ method: "POST", url: "/service-categories", headers, payload: { name: "Perawatan" } });
  const service = await app.inject({
    method: "POST", url: "/services", headers, payload: { name: "Ganti oli", sellingPrice: 20000, categoryId: created.json().id },
  });
  const renamed = await app.inject({
    method: "PATCH", url: `/service-categories/${created.json().id}`, headers, payload: { name: "Perawatan berkala" },
  });
  const disposable = await app.inject({ method: "POST", url: "/service-categories", headers, payload: { name: "Sementara" } });
  const deleted = await app.inject({ method: "DELETE", url: `/service-categories/${disposable.json().id}`, headers });
  const categories = await app.inject({ method: "GET", url: "/service-categories", headers });

  assert.equal(created.statusCode, 201);
  assert.equal(service.statusCode, 201);
  assert.equal(renamed.statusCode, 200);
  assert.equal(deleted.statusCode, 204);
  assert.deepEqual(categories.json(), [{ id: created.json().id, name: "Perawatan berkala" }]);
});

test("owner can manage product categories and assign one to a product", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const email = `product-category-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Kategori Produk" },
  });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": registration.json().workshopId };
  const created = await app.inject({ method: "POST", url: "/product-categories", headers, payload: { name: "Pelumas" } });
  const product = await app.inject({
    method: "POST", url: "/products", headers,
    payload: { name: "Oli MPX2", sku: "MPX2-CATEGORY", unit: "botol", sellingPrice: 95000, categoryId: created.json().id },
  });
  const renamed = await app.inject({
    method: "PATCH", url: `/product-categories/${created.json().id}`, headers, payload: { name: "Oli dan pelumas" },
  });
  const disposable = await app.inject({ method: "POST", url: "/product-categories", headers, payload: { name: "Sementara" } });
  const deleted = await app.inject({ method: "DELETE", url: `/product-categories/${disposable.json().id}`, headers });
  const categories = await app.inject({ method: "GET", url: "/product-categories", headers });
  const products = await app.inject({ method: "GET", url: "/products", headers });

  assert.equal(created.statusCode, 201);
  assert.equal(product.statusCode, 201);
  assert.equal(renamed.statusCode, 200);
  assert.equal(deleted.statusCode, 204);
  assert.deepEqual(categories.json(), [{ id: created.json().id, name: "Oli dan pelumas" }]);
  assert.equal(products.json()[0].categoryId, created.json().id);
});

test("owner can manage suppliers and link one to a purchase", { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = buildApp({ pool });
  t.after(async () => { await app.close(); await pool.end(); });
  const email = `supplier-owner-${randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registration = await app.inject({
    method: "POST", url: "/auth/register", payload: { email, password, workshopName: "Bengkel Supplier" },
  });
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const headers = { authorization: `Bearer ${login.json().token}`, "x-workshop-id": registration.json().workshopId };
  const created = await app.inject({
    method: "POST", url: "/suppliers", headers, payload: { name: "CV Suku Cadang", phone: "08123456789" },
  });
  const renamed = await app.inject({
    method: "PATCH", url: `/suppliers/${created.json().id}`, headers, payload: { name: "CV Suku Cadang Jaya" },
  });
  const product = await app.inject({
    method: "POST", url: "/products", headers,
    payload: { name: "Kampas rem", sku: "PAD-SUPPLIER", unit: "set", sellingPrice: 45000 },
  });
  const purchase = await app.inject({
    method: "POST", url: "/purchases", headers: { ...headers, "idempotency-key": "supplier-purchase-1" },
    payload: { supplierId: created.json().id, items: [{ productId: product.json().id, quantity: 2, unitCost: 30000 }] },
  });
  const disposable = await app.inject({ method: "POST", url: "/suppliers", headers, payload: { name: "Supplier Sementara" } });
  const deleted = await app.inject({ method: "DELETE", url: `/suppliers/${disposable.json().id}`, headers });
  const suppliers = await app.inject({ method: "GET", url: "/suppliers", headers });

  assert.equal(renamed.statusCode, 200);
  assert.equal(purchase.statusCode, 201);
  assert.equal(purchase.json().supplierId, created.json().id);
  assert.equal(deleted.statusCode, 204);
  assert.deepEqual(suppliers.json(), [{ id: created.json().id, name: "CV Suku Cadang Jaya", phone: "08123456789", address: null }]);
});
