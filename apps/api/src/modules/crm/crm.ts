type Actor = { userId: string; role: "owner" | "cashier" };

type CrmPort = {
  createCustomer(input: { name: string; phone: string | null }): Promise<{ id: string }>;
  createVehicle(input: { customerId: string; plateNumber: string | null; brand: string | null; model: string | null }): Promise<{ id: string }>;
  findVehiclesByPlate(plate: string): Promise<Array<{ id: string; plateNumber: string | null; brand: string | null; model: string | null; customerName: string }>>;
  listVehicleHistory(vehicleId: string): Promise<Array<{
    id: string; transactionNumber: string; status: "completed"; total: number; completedAt: Date;
  }>>;
};

function ensureOperator(actor: Actor) {
  if (actor.role !== "owner" && actor.role !== "cashier") {
    throw new Error("Actor is not allowed to manage customers");
  }
}

export async function createCustomer(input: { name: string; phone?: string }, actor: Actor, port: CrmPort) {
  ensureOperator(actor);
  const name = input.name.trim();
  if (!name) {
    throw new Error("Customer name is required");
  }
  return port.createCustomer({ name, phone: input.phone?.trim() || null });
}

export async function createVehicle(
  input: { customerId: string; plateNumber?: string; brand?: string; model?: string },
  actor: Actor,
  port: CrmPort,
) {
  ensureOperator(actor);
  return port.createVehicle({
    customerId: input.customerId,
    plateNumber: input.plateNumber?.trim() || null,
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
  });
}

export async function findVehiclesByPlate(plate: string, actor: Actor, port: CrmPort) {
  ensureOperator(actor);
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    throw new Error("A plate search is required");
  }
  return port.findVehiclesByPlate(normalized);
}

export async function listVehicleHistory(vehicleId: string, actor: Actor, port: CrmPort) {
  ensureOperator(actor);
  return port.listVehicleHistory(vehicleId);
}
