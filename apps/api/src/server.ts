import Fastify from "fastify";
import { Pool } from "pg";
import { z } from "zod";

import { PostgresAuthPort } from "./adapters/postgres-auth-port.ts";
import { PostgresCatalogPort } from "./adapters/postgres-catalog-port.ts";
import { PostgresCheckoutPort } from "./adapters/postgres-checkout-port.ts";
import { PostgresCrmPort } from "./adapters/postgres-crm-port.ts";
import { PostgresInventoryPort } from "./adapters/postgres-inventory-port.ts";
import { PostgresOwnerOperationsPort } from "./adapters/postgres-owner-operations-port.ts";
import { PostgresPurchasePort } from "./adapters/postgres-purchase-port.ts";
import { PostgresReceiptPort } from "./adapters/postgres-receipt-port.ts";
import { PostgresSessionAuthenticator } from "./adapters/postgres-session-authenticator.ts";
import { PostgresVoidSalePort } from "./adapters/postgres-void-sale-port.ts";
import { listCashiers, login, logout, logoutAll, refreshSession, registerCashier, registerOwner, setCashierActive } from "./modules/auth/auth.ts";
import {
  createProduct, createProductCategory, createService, createServiceCategory, createSupplier, deleteProductCategory, deleteServiceCategory, deleteSupplier, listProductCategories, listProducts, listServiceCategories, listServices, listSuppliers, updateProduct, updateProductCategory, updateService, updateServiceCategory, updateSupplier,
} from "./modules/catalog/catalog.ts";
import { createCustomer, createVehicle, findVehiclesByPlate, listVehicleHistory } from "./modules/crm/crm.ts";
import { adjustInventory } from "./modules/inventory/adjust-inventory.ts";
import { getDashboard, getPeriodReport, recordExpense } from "./modules/owner-operations/owner-operations.ts";
import { completePurchase } from "./modules/purchases/complete-purchase.ts";
import { completeSale } from "./modules/sales/complete-sale.ts";
import { getReceipt } from "./modules/sales/get-receipt.ts";
import { voidSale } from "./modules/sales/void-sale.ts";

const registrationSchema = z.object({
  email: z.string(),
  password: z.string(),
  workshopName: z.string(),
});
const loginSchema = z.object({ email: z.string(), password: z.string() });
const productSchema = z.object({
  name: z.string(),
  sku: z.string().optional(),
  unit: z.string(),
  sellingPrice: z.number().int().nonnegative(),
  currentCost: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional(),
  minimumStock: z.number().finite().nonnegative().optional(),
});
const productUpdateSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().optional(),
  sku: z.string().nullable().optional(),
  unit: z.string().optional(),
  minimumStock: z.number().finite().nonnegative().optional(),
  sellingPrice: z.number().int().nonnegative().optional(),
  currentCost: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});
const productListSchema = z.object({ includeInactive: z.enum(["true", "false"]).optional() });
const serviceSchema = z.object({ name: z.string(), sellingPrice: z.number().int().nonnegative(), categoryId: z.string().uuid().optional() });
const serviceUpdateSchema = z.object({
  name: z.string().optional(),
  sellingPrice: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});
const categorySchema = z.object({ name: z.string() });
const supplierSchema = z.object({ name: z.string(), phone: z.string().nullable().optional(), address: z.string().nullable().optional() });
const supplierUpdateSchema = z.object({ name: z.string().optional(), phone: z.string().nullable().optional(), address: z.string().nullable().optional() });
const quantitySchema = z.number().finite().positive().refine((quantity) => Number.isInteger(quantity * 1000));
const productItemSchema = z.object({ kind: z.enum(["product", "service"]), id: z.string().uuid(), quantity: quantitySchema });
const saleSchema = z.object({
  customerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  items: z.array(productItemSchema).min(1),
  discount: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(["cash", "qris", "bank_transfer"]),
});
const purchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: quantitySchema, unitCost: z.number().int().nonnegative() })).min(1),
});
const voidSchema = z.object({ reason: z.string() });
const customerSchema = z.object({ name: z.string(), phone: z.string().optional() });
const vehicleSchema = z.object({
  customerId: z.string().uuid(), plateNumber: z.string().optional(), brand: z.string().optional(), model: z.string().optional(),
});
const vehicleSearchSchema = z.object({ plate: z.string() });
const expenseSchema = z.object({ name: z.string(), amount: z.number().int().positive(), occurredAt: z.string().datetime() });
const reportPeriodSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantityChange: z.number().finite().refine((value) => value !== 0),
  reason: z.string(),
});
const cashierSchema = z.object({ email: z.string(), password: z.string() });
const cashierStatusSchema = z.object({ active: z.boolean() });
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 10_000;

type RateLimitAttempt = { count: number; resetAt: number };

function pruneRateLimits(attempts: Map<string, RateLimitAttempt>, now: number) {
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
  if (attempts.size >= MAX_RATE_LIMIT_KEYS) attempts.delete(attempts.keys().next().value!);
}

async function activeActor(request: { headers: Record<string, string | string[] | undefined> }, pool: Pool) {
  const authorization = request.headers.authorization;
  const workshopHeader = request.headers["x-workshop-id"];
  const token = typeof authorization === "string" ? authorization.match(/^Bearer (.+)$/)?.[1] : undefined;
  const workshopId = typeof workshopHeader === "string" ? workshopHeader : undefined;
  if (!token || !workshopId) {
    return null;
  }
  const actor = await new PostgresSessionAuthenticator(pool).authenticate(token, workshopId);
  return actor ? { actor, workshopId } : null;
}

export function buildApp(options: { pool?: Pool } = {}) {
  const app = Fastify({ logger: true });
  // shortcut: process-local limit for one API instance, move to a shared store when horizontally scaling.
  const failedLogins = new Map<string, RateLimitAttempt>();
  const registrations = new Map<string, RateLimitAttempt>();

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    try {
      await options.pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
  });

  app.post("/auth/register", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const input = registrationSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid registration input" });
    }
    const now = Date.now();
    pruneRateLimits(registrations, now);
    const registrationAttempt = registrations.get(request.ip);
    if (registrationAttempt && registrationAttempt.count >= 5) {
      return reply.code(429).send({ error: "Too many registration attempts" });
    }
    registrations.set(request.ip, {
      count: (registrationAttempt?.count ?? 0) + 1,
      resetAt: registrationAttempt?.resetAt ?? now + RATE_LIMIT_WINDOW_MS,
    });
    try {
      const owner = await registerOwner(input.data, new PostgresAuthPort(options.pool));
      return reply.code(201).send(owner);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Email is already registered" });
      }
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const input = loginSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid login input" });
    }
    const loginKey = `${request.ip}:${input.data.email.trim().toLowerCase()}`;
    const now = Date.now();
    pruneRateLimits(failedLogins, now);
    const attempt = failedLogins.get(loginKey);
    if (attempt && attempt.count >= 5) {
      return reply.code(429).send({ error: "Too many login attempts" });
    }
    try {
      const session = await login(input.data, new PostgresAuthPort(options.pool));
      failedLogins.delete(loginKey);
      return session;
    } catch {
      const count = attempt ? attempt.count + 1 : 1;
      failedLogins.set(loginKey, { count, resetAt: attempt?.resetAt ?? now + RATE_LIMIT_WINDOW_MS });
      return reply.code(401).send({ error: "Invalid email or password" });
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const authorization = request.headers.authorization;
    const token = typeof authorization === "string" ? authorization.match(/^Bearer (.+)$/)?.[1] : undefined;
    if (!identity || !token) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    await logout(identity.actor.userId, token, new PostgresAuthPort(options.pool));
    return reply.code(204).send();
  });

  app.post("/auth/refresh", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const token = typeof request.headers.authorization === "string" ? request.headers.authorization.match(/^Bearer (.+)$/)?.[1] : undefined;
    if (!identity || !token) return reply.code(401).send({ error: "Authentication is required" });
    return refreshSession(identity.actor.userId, token, new PostgresAuthPort(options.pool));
  });

  app.post("/auth/logout-all", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    await logoutAll(identity.actor.userId, new PostgresAuthPort(options.pool));
    return reply.code(204).send();
  });

  app.post("/memberships/cashiers", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = cashierSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid cashier input" });
    try {
      const cashier = await registerCashier(
        { ...input.data, workshopId: identity.workshopId }, identity.actor, new PostgresAuthPort(options.pool),
      );
      return reply.code(201).send(cashier);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Email is already registered" });
      }
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/memberships/cashiers", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    try {
      return await listCashiers(identity.workshopId, identity.actor, new PostgresAuthPort(options.pool));
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.patch("/memberships/cashiers/:userId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const userId = z.object({ userId: z.string().uuid() }).safeParse(request.params);
    const input = cashierStatusSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!userId.success || !input.success) return reply.code(400).send({ error: "Invalid cashier input" });
    try {
      const cashier = await setCashierActive(
        { workshopId: identity.workshopId, userId: userId.data.userId, active: input.data.active }, identity.actor,
        new PostgresAuthPort(options.pool),
      );
      return cashier ? reply.code(200).send(cashier) : reply.code(404).send({ error: "Cashier not found" });
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.post("/products", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    const input = productSchema.safeParse(request.body);
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid product input" });
    }
    try {
      const product = await createProduct(
        input.data,
        identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return reply.code(201).send(product);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Product SKU already exists" });
      }
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/products", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = productListSchema.safeParse(request.query);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) return reply.code(400).send({ error: "Invalid product list input" });
    try {
      return await listProducts(
        identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
        input.data.includeInactive === "true",
      );
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.patch("/products/:productId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const productId = z.object({ productId: z.string().uuid() }).safeParse(request.params);
    const input = productUpdateSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!productId.success || !input.success) return reply.code(400).send({ error: "Invalid product input" });
    try {
      const product = await updateProduct(
        { id: productId.data.productId, ...input.data }, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return product ? reply.code(200).send(product) : reply.code(404).send({ error: "Product not found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "Product SKU already exists" });
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/product-categories", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = categorySchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid product category input" });
    try {
      const category = await createProductCategory(input.data, identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(category);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/product-categories", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    return listProductCategories(identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
  });

  app.patch("/product-categories/:categoryId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const categoryId = z.object({ categoryId: z.string().uuid() }).safeParse(request.params);
    const input = categorySchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!categoryId.success || !input.success) return reply.code(400).send({ error: "Invalid product category input" });
    try {
      const category = await updateProductCategory(
        { id: categoryId.data.categoryId, ...input.data }, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return category ? reply.code(200).send(category) : reply.code(404).send({ error: "Product category not found" });
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/product-categories/:categoryId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const categoryId = z.object({ categoryId: z.string().uuid() }).safeParse(request.params);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!categoryId.success) return reply.code(400).send({ error: "Invalid product category" });
    try {
      const deleted = await deleteProductCategory(
        categoryId.data.categoryId, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ error: "Product category not found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "Product category is still in use" });
      }
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/suppliers", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = supplierSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid supplier input" });
    try {
      const supplier = await createSupplier(input.data, identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(supplier);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "Supplier name already exists" });
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/suppliers", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    try {
      return await listSuppliers(identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.patch("/suppliers/:supplierId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const supplierId = z.object({ supplierId: z.string().uuid() }).safeParse(request.params);
    const input = supplierUpdateSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!supplierId.success || !input.success) return reply.code(400).send({ error: "Invalid supplier input" });
    try {
      const supplier = await updateSupplier(
        { id: supplierId.data.supplierId, ...input.data }, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return supplier ? reply.code(200).send(supplier) : reply.code(404).send({ error: "Supplier not found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "Supplier name already exists" });
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/suppliers/:supplierId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const supplierId = z.object({ supplierId: z.string().uuid() }).safeParse(request.params);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!supplierId.success) return reply.code(400).send({ error: "Invalid supplier" });
    try {
      const deleted = await deleteSupplier(supplierId.data.supplierId, identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
      return deleted ? reply.code(204).send() : reply.code(404).send({ error: "Supplier not found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23503") return reply.code(409).send({ error: "Supplier is still in use" });
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/services", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = serviceSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid service input" });
    try {
      const service = await createService(input.data, identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(service);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/service-categories", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = categorySchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid service category input" });
    try {
      const category = await createServiceCategory(input.data, identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(category);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/service-categories", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    return listServiceCategories(identity.actor, new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId));
  });

  app.patch("/service-categories/:categoryId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const categoryId = z.object({ categoryId: z.string().uuid() }).safeParse(request.params);
    const input = categorySchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!categoryId.success || !input.success) return reply.code(400).send({ error: "Invalid service category input" });
    try {
      const category = await updateServiceCategory(
        { id: categoryId.data.categoryId, ...input.data }, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return category ? reply.code(200).send(category) : reply.code(404).send({ error: "Service category not found" });
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.delete("/service-categories/:categoryId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const categoryId = z.object({ categoryId: z.string().uuid() }).safeParse(request.params);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!categoryId.success) return reply.code(400).send({ error: "Invalid service category" });
    try {
      const deleted = await deleteServiceCategory(
        categoryId.data.categoryId, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ error: "Service category not found" });
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "Service category is still in use" });
      }
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/services", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = productListSchema.safeParse(request.query);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "Invalid service list input" });
    try {
      return await listServices(
        identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
        input.data.includeInactive === "true",
      );
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.patch("/services/:serviceId", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const serviceId = z.object({ serviceId: z.string().uuid() }).safeParse(request.params);
    const input = serviceUpdateSchema.safeParse(request.body);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!serviceId.success || !input.success) return reply.code(400).send({ error: "Invalid service input" });
    try {
      const service = await updateService(
        { id: serviceId.data.serviceId, ...input.data }, identity.actor,
        new PostgresCatalogPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return service ? reply.code(200).send(service) : reply.code(404).send({ error: "Service not found" });
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/purchases", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const idempotencyKey = request.headers["idempotency-key"];
    const input = purchaseSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid purchase input" });
    }
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return reply.code(400).send({ error: "Idempotency-Key is required" });
    }
    try {
      const purchase = await completePurchase(
        { workshopId: identity.workshopId, supplierId: input.data.supplierId, items: input.data.items, idempotencyKey: idempotencyKey.trim() }, identity.actor,
        new PostgresPurchasePort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return reply.code(201).send(purchase);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/customers", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = customerSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid customer input" });
    }
    try {
      const customer = await createCustomer(input.data, identity.actor, new PostgresCrmPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(customer);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/vehicles", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = vehicleSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid vehicle input" });
    }
    try {
      const vehicle = await createVehicle(input.data, identity.actor, new PostgresCrmPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(vehicle);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/vehicles", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = vehicleSearchSchema.safeParse(request.query);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "A plate search is required" });
    }
    try {
      return await findVehiclesByPlate(input.data.plate, identity.actor, new PostgresCrmPort(options.pool, identity.workshopId, identity.actor.userId));
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/vehicles/:vehicleId/history", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const vehicleId = z.object({ vehicleId: z.string().uuid() }).safeParse(request.params);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!vehicleId.success) return reply.code(400).send({ error: "Invalid vehicle id" });
    try {
      return await listVehicleHistory(
        vehicleId.data.vehicleId, identity.actor,
        new PostgresCrmPort(options.pool, identity.workshopId, identity.actor.userId),
      );
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/expenses", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = expenseSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid expense input" });
    }
    try {
      const expense = await recordExpense(input.data, identity.actor, new PostgresOwnerOperationsPort(options.pool, identity.workshopId, identity.actor.userId));
      return reply.code(201).send(expense);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/inventory/adjustments", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const input = adjustmentSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid adjustment input" });
    }
    try {
      const adjustment = await adjustInventory(
        input.data,
        identity.actor,
        new PostgresInventoryPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return reply.code(201).send({ productId: input.data.productId, ...adjustment });
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/dashboard", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    try {
      return await getDashboard(identity.actor, new PostgresOwnerOperationsPort(options.pool, identity.workshopId, identity.actor.userId));
    } catch (error) {
      return reply.code(403).send({ error: (error as Error).message });
    }
  });

  app.get("/reports/summary", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const input = reportPeriodSchema.safeParse(request.query);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!input.success) return reply.code(400).send({ error: "A valid report period is required" });
    try {
      return await getPeriodReport(
        input.data, identity.actor,
        new PostgresOwnerOperationsPort(options.pool, identity.workshopId, identity.actor.userId),
      );
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/sales", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const idempotencyKey = request.headers["idempotency-key"];
    const input = saleSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!input.success) {
      return reply.code(400).send({ error: "Invalid sale input" });
    }
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return reply.code(400).send({ error: "Idempotency-Key is required" });
    }
    try {
      const sale = await completeSale(
        { workshopId: identity.workshopId, ...input.data, idempotencyKey: idempotencyKey.trim() }, identity.actor,
        new PostgresCheckoutPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return reply.code(201).send(sale);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get("/sales/:saleId/receipt", async (request, reply) => {
    if (!options.pool) return reply.code(503).send({ error: "Database is unavailable" });
    const identity = await activeActor(request, options.pool);
    const saleId = z.object({ saleId: z.string().uuid() }).safeParse(request.params);
    if (!identity) return reply.code(401).send({ error: "Authentication is required" });
    if (!saleId.success) return reply.code(400).send({ error: "Invalid sale id" });
    try {
      const receipt = await getReceipt(
        saleId.data.saleId, identity.actor,
        new PostgresReceiptPort(options.pool, identity.workshopId, identity.actor.userId),
      );
      return receipt ? reply.code(200).send(receipt) : reply.code(404).send({ error: "Sale not found" });
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.post("/sales/:saleId/void", async (request, reply) => {
    if (!options.pool) {
      return reply.code(503).send({ error: "Database is unavailable" });
    }
    const identity = await activeActor(request, options.pool);
    const saleId = z.object({ saleId: z.string().uuid() }).safeParse(request.params);
    const input = voidSchema.safeParse(request.body);
    if (!identity) {
      return reply.code(401).send({ error: "Authentication is required" });
    }
    if (!saleId.success || !input.success) {
      return reply.code(400).send({ error: "Invalid void input" });
    }
    try {
      return await voidSale(
        { workshopId: identity.workshopId, saleId: saleId.data.saleId, reason: input.data.reason }, identity.actor,
        new PostgresVoidSalePort(options.pool, identity.workshopId, identity.actor.userId),
      );
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  return app;
}

if (import.meta.main) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to start the API");
  }
  const app = buildApp({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host: "0.0.0.0", port });
}
