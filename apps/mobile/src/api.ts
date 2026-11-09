// REST client for apps/api. Types mirror the Zod schemas and adapter results in apps/api/src/server.ts.
import type { PaymentMethod } from "./cart";

export type Role = "owner" | "cashier";

export type Session = { token: string; expiresAt: string; workshopId: string; role: Role };

export type Product = {
  id: string; name: string; sku: string | null; unit: string; stockOnHand: number; minimumStock: number;
  sellingPrice: number; categoryId: string | null; active: boolean;
};

export type Service = { id: string; name: string; sellingPrice: number; active: boolean };

export type Vehicle = { id: string; plateNumber: string | null; brand: string | null; model: string | null; customerName: string };

export type VehicleVisit = { id: string; transactionNumber: string; total: number; completedAt: string };

export type Dashboard = {
  revenue: number; grossProfit: number; transactionCount: number; expenseTotal: number;
  lowStock: { id: string; name: string; stockOnHand: number; minimumStock: number }[];
};

export type PeriodReport = {
  revenue: number; grossProfit: number; transactionCount: number; expenseTotal: number;
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  recentTransactions: { id: string; transactionNumber: string; total: number; completedAt: string }[];
};

export type SaleRequest = {
  items: { kind: "product" | "service"; id: string; quantity: number }[];
  discount: number;
  paymentMethod: PaymentMethod;
  vehicleId?: string;
};

export type Receipt = {
  id: string; transactionNumber: string; status: "completed" | "void";
  subtotal: number; discount: number; total: number; completedAt: string;
  items: { type: "product" | "service"; name: string; sku: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  payment: { method: PaymentMethod; amount: number } | null;
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// The API answers in English free text; each message is mapped to the problem plus how to recover.
const messages: Record<string, string> = {
  "Insufficient stock": "Stok tidak cukup. Kurangi jumlah atau muat ulang katalog untuk melihat stok terbaru.",
  "Product is unavailable": "Ada sparepart yang sudah tidak aktif. Hapus dari keranjang lalu coba lagi.",
  "Service is unavailable": "Ada jasa yang sudah tidak aktif. Hapus dari keranjang lalu coba lagi.",
  "Customer or vehicle is unavailable": "Kendaraan tidak ditemukan. Pilih ulang kendaraan atau lanjut tanpa kendaraan.",
  "Invalid sale discount": "Diskon tidak boleh melebihi subtotal.",
  "Invalid email or password": "Email atau password salah.",
  "Too many login attempts": "Terlalu banyak percobaan masuk. Tunggu 15 menit lalu coba lagi.",
  "Authentication is required": "Sesi berakhir. Silakan masuk lagi.",
  "Only an owner can void a sale": "Hanya owner yang dapat membatalkan transaksi.",
  "A void reason is required": "Alasan pembatalan wajib diisi.",
  "Completed sale not found": "Transaksi ini sudah dibatalkan atau tidak ditemukan. Muat ulang bukti transaksi.",
  "Database is unavailable": "Server sedang bermasalah. Coba lagi beberapa saat lagi.",
  "Customer name is required": "Nama pelanggan wajib diisi.",
  "Customer not found": "Pelanggan tidak ditemukan. Ulangi pendaftaran kendaraan.",
  "Invalid vehicle input": "Data kendaraan tidak valid. Periksa lalu coba lagi.",
  "Product SKU already exists": "SKU ini sudah dipakai sparepart lain. Ganti atau kosongkan SKU.",
  "Invalid product input": "Data sparepart tidak valid. Periksa harga dan stok lalu coba lagi.",
  "Invalid service input": "Data jasa tidak valid. Periksa nama dan harga lalu coba lagi.",
  "Invalid adjustment input": "Jumlah stok tidak valid. Gunakan angka, maksimal 3 angka di belakang koma.",
  "Only an owner can manage products": "Hanya owner yang dapat menambah sparepart.",
  "Only an owner can manage services": "Hanya owner yang dapat menambah jasa.",
  "Only an owner can adjust stock": "Hanya owner yang dapat mengubah stok.",
};

// shortcut: Postgres unique violations reach us as raw driver text; match them until the API returns stable error codes.
function translate(raw: string) {
  if (raw.includes("vehicles_workshop_normalized_plate_unique")) return "Plat ini sudah terdaftar. Cari platnya lalu pilih dari hasil pencarian.";
  return messages[raw];
}

export async function apiRequest<T>(
  session: Session | null,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  if (!baseUrl) throw new ApiError("EXPO_PUBLIC_API_URL belum diisi di apps/mobile/.env.", 0);
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (session) {
    headers.authorization = `Bearer ${session.token}`;
    headers["x-workshop-id"] = session.workshopId;
  }
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Tidak ada koneksi ke server. Periksa internet lalu coba lagi.", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = typeof data?.error === "string" ? data.error : "";
    throw new ApiError(translate(raw) ?? `Permintaan gagal (${response.status}). Coba lagi.`, response.status);
  }
  return data as T;
}
