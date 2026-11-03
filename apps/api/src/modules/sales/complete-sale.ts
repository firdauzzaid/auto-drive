export type Actor = {
  userId: string;
  role: "owner" | "cashier";
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  stockOnHand: number;
  sellingPrice: number;
  currentCost: number;
  active: boolean;
};

function isValidQuantity(quantity: number) {
  return Number.isFinite(quantity) && quantity > 0 && Number.isInteger(quantity * 1000);
}

function isWholeRupiah(amount: number) {
  return Number.isSafeInteger(amount);
}

type SaleInput = {
  workshopId: string;
  customerId?: string;
  vehicleId?: string;
  idempotencyKey?: string;
  items: Array<{ kind: "product" | "service"; id: string; quantity: number }>;
  discount?: number;
  paymentMethod: "cash" | "qris" | "bank_transfer";
};

type CheckoutPort = {
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
  validateSaleReferences(input: { customerId: string | null; vehicleId: string | null }): Promise<boolean>;
  findCompletedSaleByIdempotencyKey(key: string): Promise<{ id: string; total: number } | null>;
  lockProducts(ids: string[]): Promise<Product[]>;
  lockServices(ids: string[]): Promise<Array<{ id: string; name: string; sellingPrice: number; active: boolean }>>;
  createSale(input: {
    workshopId: string;
    customerId: string | null;
    vehicleId: string | null;
    completedBy: string;
    subtotal: number;
    discount: number;
    total: number;
    idempotencyKey: string | null;
  }): Promise<{ id: string }>;
  createSaleItems(
    items: Array<{
      saleId: string;
      productId: string | null;
      serviceId: string | null;
      nameSnapshot: string;
      skuSnapshot: string | null;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }>,
  ): Promise<void>;
  createPayment(input: {
    saleId: string;
    method: SaleInput["paymentMethod"];
    amount: number;
    receivedBy: string;
  }): Promise<void>;
  applyInventoryMovements(
    movements: Array<{
      workshopId: string;
      productId: string;
      saleId: string;
      previousStock: number;
      quantityChange: number;
      newStock: number;
      reason: "sale";
      createdBy: string;
    }>,
  ): Promise<void>;
};

export async function completeSale(input: SaleInput, actor: Actor, port: CheckoutPort) {
  if (actor.role !== "owner" && actor.role !== "cashier") {
    throw new Error("Actor is not allowed to complete a sale");
  }

  if (input.items.length === 0) {
    throw new Error("A sale needs at least one item");
  }

  for (const item of input.items) {
    if (!isValidQuantity(item.quantity)) {
      throw new Error("Product quantity must be positive with at most three decimal places");
    }
  }

  return port.inTransaction(async () => {
    if (input.idempotencyKey) {
      const existing = await port.findCompletedSaleByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    if (!(await port.validateSaleReferences({ customerId: input.customerId ?? null, vehicleId: input.vehicleId ?? null }))) {
      throw new Error("Customer or vehicle is unavailable");
    }
    const requestedQuantityByProduct = new Map<string, number>();
    const requestedQuantityByService = new Map<string, number>();
    for (const item of input.items) {
      const requested = item.kind === "product" ? requestedQuantityByProduct : requestedQuantityByService;
      requested.set(item.id, (requested.get(item.id) ?? 0) + item.quantity);
    }

    const products = await port.lockProducts([...requestedQuantityByProduct.keys()]);
    const services = requestedQuantityByService.size ? await port.lockServices([...requestedQuantityByService.keys()]) : [];
    if (input.idempotencyKey) {
      const existing = await port.findCompletedSaleByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    const productById = new Map(products.map((product) => [product.id, product]));

    const productItems = [...requestedQuantityByProduct].map(([productId, quantity]) => {
      const product = productById.get(productId);
      if (!product || !product.active) {
        throw new Error("Product is unavailable");
      }

      if (product.stockOnHand < quantity) {
        throw new Error("Insufficient stock");
      }

      if (!isWholeRupiah(product.sellingPrice * quantity) || !isWholeRupiah(product.currentCost * quantity)) {
        throw new Error("Product quantity must result in whole Rupiah amounts");
      }

      return {
        product, productId: product.id, serviceId: null,
        quantity,
        unitPrice: product.sellingPrice, unitCost: product.currentCost, nameSnapshot: product.name, skuSnapshot: product.sku,
        lineTotal: product.sellingPrice * quantity,
      };
    });
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const serviceItems = [...requestedQuantityByService].map(([serviceId, quantity]) => {
      const service = serviceById.get(serviceId);
      if (!service || !service.active) throw new Error("Service is unavailable");
      if (!isWholeRupiah(service.sellingPrice * quantity)) {
        throw new Error("Service quantity must result in a whole Rupiah amount");
      }
      return { product: null, productId: null, serviceId: service.id, quantity, unitPrice: service.sellingPrice, unitCost: 0, nameSnapshot: service.name, skuSnapshot: null, lineTotal: service.sellingPrice * quantity };
    });
    const saleItems = [...productItems, ...serviceItems];
    const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = input.discount ?? 0;
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) throw new Error("Invalid sale discount");
    const total = subtotal - discount;
    const sale = await port.createSale({
      workshopId: input.workshopId,
      customerId: input.customerId ?? null,
      vehicleId: input.vehicleId ?? null,
      completedBy: actor.userId,
      subtotal,
      discount,
      total,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    await port.createSaleItems(
      saleItems.map(({ productId, serviceId, quantity, lineTotal, unitPrice, unitCost, nameSnapshot, skuSnapshot }) => ({
        saleId: sale.id,
        productId, serviceId, nameSnapshot, skuSnapshot,
        quantity,
        unitPrice, unitCost,
        lineTotal,
      })),
    );
    await port.createPayment({
      saleId: sale.id,
      method: input.paymentMethod,
      amount: total,
      receivedBy: actor.userId,
    });
    await port.applyInventoryMovements(
      productItems.map(({ product, quantity }) => ({
        workshopId: input.workshopId,
        productId: product.id,
        saleId: sale.id,
        previousStock: product.stockOnHand,
        quantityChange: -quantity,
        newStock: product.stockOnHand - quantity,
        reason: "sale" as const,
        createdBy: actor.userId,
      })),
    );

    return { id: sale.id, total };
  });
}
