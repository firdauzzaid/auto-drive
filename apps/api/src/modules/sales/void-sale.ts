type Actor = {
  userId: string;
  role: "owner" | "cashier";
};

type VoidSaleInput = {
  workshopId: string;
  saleId: string;
  reason: string;
};

type VoidSalePort = {
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
  getCompletedSale(saleId: string): Promise<{
    id: string;
    workshopId: string;
    status: "completed";
    items: Array<{ productId: string | null; quantity: number }>;
  } | null>;
  markSaleVoid(input: { saleId: string; voidedBy: string; reason: string }): Promise<void>;
  applyInventoryMovements(
    movements: Array<{
      workshopId: string;
      productId: string;
      saleId: string;
      quantityChange: number;
      reason: "sale_void";
      createdBy: string;
    }>,
  ): Promise<void>;
  appendAuditLog(input: {
    workshopId: string;
    actorId: string;
    action: "sale.voided";
    entityType: "sale";
    entityId: string;
    previousValue: { status: "completed" };
    newValue: { status: "void"; reason: string };
  }): Promise<void>;
};

export async function voidSale(input: VoidSaleInput, actor: Actor, port: VoidSalePort) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can void a sale");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("A void reason is required");
  }

  return port.inTransaction(async () => {
    const sale = await port.getCompletedSale(input.saleId);
    if (!sale || sale.workshopId !== input.workshopId) {
      throw new Error("Completed sale not found");
    }

    await port.markSaleVoid({ saleId: sale.id, voidedBy: actor.userId, reason });
    await port.applyInventoryMovements(
      sale.items
        .filter((item): item is { productId: string; quantity: number } => item.productId !== null)
        .map((item) => ({
          workshopId: input.workshopId,
          productId: item.productId,
          saleId: sale.id,
          quantityChange: item.quantity,
          reason: "sale_void" as const,
          createdBy: actor.userId,
        })),
    );
    await port.appendAuditLog({
      workshopId: input.workshopId,
      actorId: actor.userId,
      action: "sale.voided",
      entityType: "sale",
      entityId: sale.id,
      previousValue: { status: "completed" },
      newValue: { status: "void", reason },
    });

    return { id: sale.id, status: "void" as const };
  });
}
