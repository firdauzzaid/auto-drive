type Actor = { userId: string; role: "owner" | "cashier" };

type CatalogPort = {
  createProduct(input: {
    name: string;
    sku: string | null;
    unit: string;
    sellingPrice: number;
    currentCost: number;
    categoryId: string | null;
    minimumStock: number;
  }): Promise<{ id: string }>;
  listProducts(includeInactive: boolean): Promise<Array<{
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    stockOnHand: number;
    minimumStock: number;
    sellingPrice: number;
    currentCost: number;
    categoryId: string | null;
    active: boolean;
  }>>;
  updateProduct(input: {
    id: string; categoryId?: string | null; name?: string; sku?: string | null; unit?: string;
    minimumStock?: number; sellingPrice?: number; currentCost?: number; active?: boolean;
  }): Promise<{
    id: string; name: string; sku: string | null; unit: string; stockOnHand: number; minimumStock: number;
    sellingPrice: number; currentCost: number; categoryId: string | null; active: boolean;
  } | null>;
  createService(input: { name: string; sellingPrice: number; categoryId: string | null }): Promise<{ id: string }>;
  listServices(includeInactive: boolean): Promise<Array<{ id: string; name: string; sellingPrice: number; active: boolean }>>;
  updateService(input: { id: string; name?: string; sellingPrice?: number; active?: boolean }): Promise<{
    id: string; name: string; sellingPrice: number; active: boolean;
  } | null>;
  createServiceCategory(name: string): Promise<{ id: string }>;
  listServiceCategories(): Promise<Array<{ id: string; name: string }>>;
  updateServiceCategory(id: string, name: string): Promise<{ id: string; name: string } | null>;
  deleteServiceCategory(id: string): Promise<boolean>;
  createProductCategory(name: string): Promise<{ id: string }>;
  listProductCategories(): Promise<Array<{ id: string; name: string }>>;
  updateProductCategory(id: string, name: string): Promise<{ id: string; name: string } | null>;
  deleteProductCategory(id: string): Promise<boolean>;
  createSupplier(input: { name: string; phone: string | null; address: string | null }): Promise<{ id: string }>;
  listSuppliers(): Promise<Array<{ id: string; name: string; phone: string | null; address: string | null }>>;
  updateSupplier(input: { id: string; name?: string; phone?: string | null; address?: string | null }): Promise<{ id: string; name: string; phone: string | null; address: string | null } | null>;
  deleteSupplier(id: string): Promise<boolean>;
};

export async function createProduct(
  input: { name: string; sku?: string; unit: string; sellingPrice: number; currentCost?: number; categoryId?: string; minimumStock?: number },
  actor: Actor,
  port: CatalogPort,
) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can manage products");
  }
  const name = input.name.trim();
  const unit = input.unit.trim();
  const currentCost = input.currentCost ?? 0;
  const minimumStock = input.minimumStock ?? 0;
  if (!name || !unit) {
    throw new Error("Product name and unit are required");
  }
  if (!Number.isSafeInteger(input.sellingPrice) || input.sellingPrice < 0 || !Number.isSafeInteger(currentCost) || currentCost < 0 || !Number.isFinite(minimumStock) || minimumStock < 0) {
    throw new Error("Product prices must be non-negative Rupiah amounts");
  }
  return port.createProduct({ name, sku: input.sku?.trim() || null, unit, sellingPrice: input.sellingPrice, currentCost, categoryId: input.categoryId ?? null, minimumStock });
}

export async function listProducts(actor: Actor, port: CatalogPort, includeInactive = false) {
  if (actor.role !== "owner" && actor.role !== "cashier") {
    throw new Error("Actor is not allowed to read products");
  }
  if (includeInactive && actor.role !== "owner") throw new Error("Only an owner can read inactive products");
  return port.listProducts(includeInactive);
}

export async function updateProduct(
  input: { id: string; categoryId?: string | null; name?: string; sku?: string | null; unit?: string; minimumStock?: number; sellingPrice?: number; currentCost?: number; active?: boolean },
  actor: Actor,
  port: CatalogPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage products");
  if (input.name !== undefined && !input.name.trim()) throw new Error("A product name is required");
  if (input.unit !== undefined && !input.unit.trim()) throw new Error("A product unit is required");
  if (input.minimumStock !== undefined && (!Number.isFinite(input.minimumStock) || input.minimumStock < 0)) throw new Error("A product minimum stock must be non-negative");
  if (input.sellingPrice !== undefined && (!Number.isSafeInteger(input.sellingPrice) || input.sellingPrice < 0)) throw new Error("A product selling price must be a non-negative Rupiah amount");
  if (input.currentCost !== undefined && (!Number.isSafeInteger(input.currentCost) || input.currentCost < 0)) throw new Error("A product cost must be a non-negative Rupiah amount");
  if (input.categoryId === undefined && input.name === undefined && input.sku === undefined && input.unit === undefined && input.minimumStock === undefined && input.sellingPrice === undefined && input.currentCost === undefined && input.active === undefined) {
    throw new Error("A product change is required");
  }
  return port.updateProduct({
    ...input,
    name: input.name?.trim(),
    unit: input.unit?.trim(),
    sku: input.sku === undefined ? undefined : input.sku?.trim() || null,
  });
}

export async function createService(input: { name: string; sellingPrice: number; categoryId?: string }, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can manage services");
  }
  const name = input.name.trim();
  if (!name || !Number.isSafeInteger(input.sellingPrice) || input.sellingPrice < 0) {
    throw new Error("A service name and non-negative Rupiah price are required");
  }
  return port.createService({ name, sellingPrice: input.sellingPrice, categoryId: input.categoryId ?? null });
}

export async function createServiceCategory(input: { name: string }, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage service categories");
  const name = input.name.trim();
  if (!name) throw new Error("A service category name is required");
  return port.createServiceCategory(name);
}

export async function listServiceCategories(actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner" && actor.role !== "cashier") throw new Error("Actor is not allowed to read service categories");
  return port.listServiceCategories();
}

export async function updateServiceCategory(input: { id: string; name: string }, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage service categories");
  const name = input.name.trim();
  if (!name) throw new Error("A service category name is required");
  return port.updateServiceCategory(input.id, name);
}

export async function deleteServiceCategory(id: string, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage service categories");
  return port.deleteServiceCategory(id);
}

export async function createProductCategory(input: { name: string }, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage product categories");
  const name = input.name.trim();
  if (!name) throw new Error("A product category name is required");
  return port.createProductCategory(name);
}

export async function listProductCategories(actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner" && actor.role !== "cashier") throw new Error("Actor is not allowed to read product categories");
  return port.listProductCategories();
}

export async function updateProductCategory(input: { id: string; name: string }, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage product categories");
  const name = input.name.trim();
  if (!name) throw new Error("A product category name is required");
  return port.updateProductCategory(input.id, name);
}

export async function deleteProductCategory(id: string, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage product categories");
  return port.deleteProductCategory(id);
}

export async function createSupplier(
  input: { name: string; phone?: string | null; address?: string | null }, actor: Actor, port: CatalogPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage suppliers");
  const name = input.name.trim();
  if (!name) throw new Error("A supplier name is required");
  return port.createSupplier({ name, phone: input.phone?.trim() || null, address: input.address?.trim() || null });
}

export async function listSuppliers(actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can read suppliers");
  return port.listSuppliers();
}

export async function updateSupplier(
  input: { id: string; name?: string; phone?: string | null; address?: string | null }, actor: Actor, port: CatalogPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage suppliers");
  if (input.name !== undefined && !input.name.trim()) throw new Error("A supplier name is required");
  if (input.name === undefined && input.phone === undefined && input.address === undefined) throw new Error("A supplier change is required");
  return port.updateSupplier({
    ...input,
    name: input.name?.trim(),
    phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
    address: input.address === undefined ? undefined : input.address?.trim() || null,
  });
}

export async function deleteSupplier(id: string, actor: Actor, port: CatalogPort) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage suppliers");
  return port.deleteSupplier(id);
}

export async function listServices(actor: Actor, port: CatalogPort, includeInactive = false) {
  if (actor.role !== "owner" && actor.role !== "cashier") {
    throw new Error("Actor is not allowed to read services");
  }
  if (includeInactive && actor.role !== "owner") {
    throw new Error("Only an owner can read inactive services");
  }
  return port.listServices(includeInactive);
}

export async function updateService(
  input: { id: string; name?: string; sellingPrice?: number; active?: boolean }, actor: Actor, port: CatalogPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage services");
  if (input.name !== undefined && !input.name.trim()) throw new Error("A service name is required");
  if (input.sellingPrice !== undefined && (!Number.isSafeInteger(input.sellingPrice) || input.sellingPrice < 0)) {
    throw new Error("A service price must be a non-negative Rupiah amount");
  }
  if (input.name === undefined && input.sellingPrice === undefined && input.active === undefined) {
    throw new Error("A service change is required");
  }
  return port.updateService({ ...input, name: input.name?.trim() });
}
