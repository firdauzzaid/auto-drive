type Actor = { userId: string; role: "owner" | "cashier" };

type OwnerOperationsPort = {
  createExpense(input: { name: string; amount: number; occurredAt: string; createdBy: string }): Promise<{ id: string }>;
  getDashboard(): Promise<{
    revenue: number;
    grossProfit: number;
    transactionCount: number;
    expenseTotal: number;
    lowStock: Array<{ id: string; name: string; stockOnHand: number; minimumStock: number }>;
  }>;
  getPeriodReport(input: { from: string; to: string }): Promise<{
    revenue: number; grossProfit: number; transactionCount: number; expenseTotal: number;
    topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    recentTransactions: Array<{ id: string; transactionNumber: string; total: number; completedAt: Date }>;
  }>;
};

function requireOwner(actor: Actor) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can access financial operations");
  }
}

export async function recordExpense(
  input: { name: string; amount: number; occurredAt: string },
  actor: Actor,
  port: OwnerOperationsPort,
) {
  requireOwner(actor);
  const name = input.name.trim();
  if (!name || !Number.isSafeInteger(input.amount) || input.amount <= 0 || Number.isNaN(Date.parse(input.occurredAt))) {
    throw new Error("A valid expense name, amount, and date are required");
  }
  return port.createExpense({ ...input, name, createdBy: actor.userId });
}

export async function getDashboard(actor: Actor, port: OwnerOperationsPort) {
  requireOwner(actor);
  return port.getDashboard();
}

export async function getPeriodReport(
  input: { from: string; to: string }, actor: Actor, port: OwnerOperationsPort,
) {
  requireOwner(actor);
  const from = Date.parse(input.from);
  const to = Date.parse(input.to);
  if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
    throw new Error("A valid report period is required");
  }
  return port.getPeriodReport(input);
}
