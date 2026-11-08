const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatRupiah(amount: number) {
  return `Rp${rupiah.format(amount)}`;
}

const quantity = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

// Stock can be fractional (oli eceran per liter, kabel per meter).
export function formatQuantity(value: number) {
  return quantity.format(value);
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export const paymentLabel = { cash: "Tunai", qris: "QRIS", bank_transfer: "Transfer" } as const;

// The device's local day as UTC instants; the workshop timezone is not modelled yet.
export function todayRange(now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Quantities only (prices stay digits-only): Indonesian keypads type a decimal comma; "" or junk becomes NaN.
export function parseQuantity(text: string) {
  const cleaned = text.trim().replace(",", ".");
  return cleaned === "" ? NaN : Number(cleaned);
}
