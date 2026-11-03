import type { Actor } from "./complete-sale.ts";

type Receipt = {
  id: string;
  transactionNumber: string;
  status: "completed" | "void";
  subtotal: number;
  discount: number;
  total: number;
  completedAt: Date;
  items: Array<{ type: "product" | "service"; name: string; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }>;
  payment: { method: "cash" | "qris" | "bank_transfer"; amount: number } | null;
};

type ReceiptPort = { getReceipt(saleId: string): Promise<Receipt | null> };

export async function getReceipt(saleId: string, actor: Actor, port: ReceiptPort) {
  if (actor.role !== "owner" && actor.role !== "cashier") {
    throw new Error("Actor is not allowed to read receipts");
  }
  return port.getReceipt(saleId);
}
