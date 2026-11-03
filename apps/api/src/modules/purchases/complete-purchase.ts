type Actor = {
  userId: string;
  role: "owner" | "cashier";
};

type PurchaseInput = {
  workshopId: string;
  supplierId?: string;
  idempotencyKey?: string;
  items: Array<{ productId: string; quantity: number; unitCost: number }>;
};

type PurchaseProduct = {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
};

type PurchasePort = {
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
  findCompletedPurchaseByIdempotencyKey(key: string): Promise<{ id: string; total: number; supplierId: string | null } | null>;
  lockProducts(ids: string[]): Promise<PurchaseProduct[]>;
  createPurchase(input: { workshopId: string; supplierId: string | null; completedBy: string; subtotal: number; total: number; idempotencyKey: string | null }): Promise<{ id: string; supplierId: string | null }>;
  createPurchaseItems(items: Array<{
    purchaseId: string;
    productId: string;
    nameSnapshot: string;
    skuSnapshot: string | null;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>): Promise<void>;
  applyPurchaseMovements(movements: Array<{
    workshopId: string;
    productId: string;
    purchaseId: string;
    quantityChange: number;
    unitCost: number;
    createdBy: string;
  }>): Promise<void>;
};

export async function completePurchase(input: PurchaseInput, actor: Actor, port: PurchasePort) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can complete a purchase");
  }
  if (input.items.length === 0) {
    throw new Error("A purchase needs at least one item");
  }

  const seenProductIds = new Set<string>();
  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity * 1000)) {
      throw new Error("Purchase quantity must be positive with at most three decimal places");
    }
    if (!Number.isSafeInteger(item.unitCost) || item.unitCost < 0) {
      throw new Error("Purchase unit cost must be a non-negative Rupiah amount");
    }
    if (seenProductIds.has(item.productId)) {
      throw new Error("A product can appear only once in a purchase");
    }
    seenProductIds.add(item.productId);
  }

  return port.inTransaction(async () => {
    if (input.idempotencyKey) {
      const existing = await port.findCompletedPurchaseByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }
    const products = await port.lockProducts(input.items.map((item) => item.productId));
    const productById = new Map(products.map((product) => [product.id, product]));
    const purchaseItems = input.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        throw new Error("Product is unavailable");
      }
      const lineTotal = item.quantity * item.unitCost;
      if (!Number.isSafeInteger(lineTotal)) {
        throw new Error("Purchase quantity must result in a whole Rupiah amount");
      }
      return { product, ...item, lineTotal };
    });
    const total = purchaseItems.reduce((sum, item) => sum + item.lineTotal, 0);
    if (input.idempotencyKey) {
      const existing = await port.findCompletedPurchaseByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }
    const purchase = await port.createPurchase({
      workshopId: input.workshopId,
      supplierId: input.supplierId ?? null,
      completedBy: actor.userId,
      subtotal: total,
      total,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    await port.createPurchaseItems(
      purchaseItems.map(({ product, quantity, unitCost, lineTotal }) => ({
        purchaseId: purchase.id,
        productId: product.id,
        nameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity,
        unitCost,
        lineTotal,
      })),
    );
    await port.applyPurchaseMovements(
      purchaseItems.map(({ product, quantity, unitCost }) => ({
        workshopId: input.workshopId,
        productId: product.id,
        purchaseId: purchase.id,
        quantityChange: quantity,
        unitCost,
        createdBy: actor.userId,
      })),
    );

    return { id: purchase.id, total, supplierId: purchase.supplierId };
  });
}
