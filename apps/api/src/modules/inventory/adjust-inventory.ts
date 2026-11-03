type Actor = { userId: string; role: "owner" | "cashier" };

type InventoryPort = {
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
  applyAdjustment(input: { productId: string; quantityChange: number; reason: string; createdBy: string }): Promise<{ stockOnHand: number }>;
};

export async function adjustInventory(
  input: { productId: string; quantityChange: number; reason: string },
  actor: Actor,
  port: InventoryPort,
) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can adjust stock");
  }
  const reason = input.reason.trim();
  if (!Number.isFinite(input.quantityChange) || input.quantityChange === 0 || !reason) {
    throw new Error("An adjustment quantity and reason are required");
  }
  return port.inTransaction(() => port.applyAdjustment({ ...input, reason, createdBy: actor.userId }));
}
