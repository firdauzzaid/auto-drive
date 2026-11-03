# PRD — MVP POS & Inventori Bengkel Motor

## Tujuan

Membuktikan bengkel motor independen bersedia mengganti pencatatan manual dengan aplikasi yang dapat dipakai untuk operasional harian.

## P0: pilot scope

| Area | Requirement dan acceptance criteria |
| --- | --- |
| Identitas & tenant | Owner mendaftar, membuat workshop, dan menambahkan kasir. Setiap data bisnis hanya dapat diakses oleh workshop yang benar. |
| Katalog | Owner dapat mengelola produk, kategori, harga beli saat ini, harga jual, stok minimum, satuan, jasa, dan supplier sederhana. Produk dan jasa adalah entitas terpisah. |
| POS | Kasir dapat membuat sale berisi produk dan jasa, diskon tingkat transaksi, customer/kendaraan opsional, serta Cash/QRIS/Transfer. Checkout tidak dapat sukses bila stok tidak cukup. |
| Inventori | Checkout membuat movement `sale`; purchase membuat movement `purchase`; adjustment selalu memiliki alasan. Angka stok tidak dapat berubah melalui jalur lain. |
| CRM & histori | Customer dapat memiliki beberapa kendaraan. Pencarian plat menjadi jalur utama. Sale dengan kendaraan muncul sebagai histori servis. |
| Operasional | Owner mencatat purchase dan expense. Purchase yang selesai menambah stok dengan movement. |
| Insight | Owner melihat omzet, estimasi laba kotor, jumlah transaksi, stok menipis, produk terlaris, pengeluaran, dan transaksi terakhir untuk rentang dasar. |
| Bukti transaksi | Aplikasi menampilkan digital receipt di layar setelah checkout. |

## P1 setelah pilot

Bon/piutang dan repayment, CSV import, file PDF atau WhatsApp receipt, pengiriman notifikasi stok menipis, serta tampilan audit log.

## Di luar scope

Portal/komisi mekanik, multi-outlet, multi-warehouse, full offline sync, akuntansi/penggajian, supplier debt, booking, loyalty, WhatsApp CRM/reminder, thermal printer, marketplace/API publik, AI, dan unit conversion.

## Business rules

1. Seluruh record bisnis memiliki `workshop_id`.
2. Akses lintas workshop dilarang di backend dan database.
3. Produk yang dijual membuat inventory movement; jasa tidak.
4. Stok tidak dapat negatif pada pilot.
5. Harga dan biaya item disalin ke sale item pada checkout; laporan lama tidak berubah ketika katalog berubah.
6. Sale selesai tidak boleh hard-delete. Void membuat reversal movement dan audit entry.
7. Customer atau vehicle tidak diwajibkan untuk menyelesaikan transaksi.

## Keputusan yang harus disetujui sebelum implementasi POS

- HPP pilot: snapshot `current_cost` produk pada checkout (rekomendasi).
- Void: owner-only dan alasan wajib (rekomendasi).
- Pilot memakai tepat satu metode pembayaran per sale (rekomendasi).
- Bon tidak masuk P0 kecuali hasil interview pilot membuktikannya wajib.
- Plate number dinormalisasi dan unik per workshop; kendaraan tanpa plat dapat disimpan sebagai draft.

## Rilis secara vertical slice

1. Workshop + product/service + POS checkout + pengurangan stok.
2. Customer/vehicle + histori kendaraan.
3. Supplier + purchase + stock increase.
4. Expense + dashboard + basic reports.
5. Pilot 5–10 bengkel, lalu perbaiki temuan sebelum paid beta.
