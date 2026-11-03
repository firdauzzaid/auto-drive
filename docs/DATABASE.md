# Database System

## Konvensi dan invariant

- UUID primary key, `created_at`, `updated_at`, dan `workshop_id` pada seluruh data bisnis.
- Money disimpan sebagai integer Rupiah, bukan float.
- Quantity disimpan sebagai `numeric`; API menerima maksimum tiga angka desimal. Nilai `harga × quantity` dan `biaya × quantity` wajib menghasilkan Rupiah utuh agar tidak ada pembulatan diam-diam.
- Semua sale dan purchase selesai bersifat historis: item menyimpan snapshot nama, SKU, harga, dan biaya.
- Perubahan `products.stock_on_hand` hanya dilakukan di function transaction yang juga menulis `inventory_movements`.
- Database constraint, foreign key, check constraint, RLS, dan transaction adalah enforcement utama; UI bukan sumber kebenaran.

## Tabel P0

| Domain | Tabel | Catatan |
| --- | --- | --- |
| Identity | `users`, `workshops`, `memberships`, `refresh_tokens` | `memberships` menyimpan role owner/cashier dan satu user dapat memiliki lebih dari satu workshop. |
| Catalog | `product_categories`, `products`, `service_categories`, `services`, `suppliers` | Produk memiliki `stock_on_hand`, `minimum_stock`, `current_cost`, `selling_price`; jasa tidak punya stok. |
| CRM | `customers`, `vehicles` | Plate dinormalisasi; unique `(workshop_id, normalized_plate)` bila plate tersedia. |
| Sales | `sales`, `sale_items`, `payments` | `sales.status`: draft/completed/void; P0 menulis satu payment sukses per completed sale. |
| Inventory | `inventory_movements` | Tipe: purchase, sale, adjustment, sale_void. Menyimpan before/quantity change/after, source, actor, timestamp, reason. |
| Purchasing | `purchases`, `purchase_items` | Purchase completed membuat movement purchase. |
| Finance | `expense_categories`, `expenses` | Terpisah dari revenue/laba kotor. |
| Audit | `audit_logs` | Void, stock adjustment, price change, product deactivation, expense edit. |

## Relasi penting

```text
workshops ──< memberships >── users
workshops ──< products ──< inventory_movements
workshops ──< services
workshops ──< customers ──< vehicles ──< sales
sales ──< sale_items
sales ──< payments
workshops ──< suppliers ──< purchases ──< purchase_items
workshops ──< expenses
```

## Indeks awal

- Semua foreign key dan `workshop_id`.
- `products(workshop_id, normalized_name)` dan unique `(workshop_id, sku)` jika SKU tidak null.
- `vehicles(workshop_id, normalized_plate)`.
- `sales(workshop_id, completed_at desc)` dan `sales(workshop_id, vehicle_id, completed_at desc)`.
- `inventory_movements(workshop_id, product_id, created_at desc)`.
- `expenses(workshop_id, occurred_at desc)`.

## Akses dan mutasi

- RLS membatasi rows ke workshop yang aktif bagi actor.
- Kasir tidak membaca expense, laporan laba, membership, atau setting sensitif.
- `complete_sale`, `void_sale`, dan `complete_purchase` menjadi PostgreSQL transaction/API module yang diuji sebagai satu operation. Sale dan purchase memakai idempotency key agar retry jaringan tidak membuat mutasi stok ganda.
- `DELETE` pada sale completed dan inventory movement dilarang. Product inactive menggantikan penghapusan saat sudah direferensikan.

## P1 additions

`receivables`, `receivable_payments`, `import_jobs`, dan `attachments` ditambahkan hanya saat Bon, CSV import, atau invoice file benar-benar masuk scope.
