# Architecture System

## Keputusan utama

Produk adalah modular monolith: satu aplikasi Expo dan satu API TypeScript. Tidak menggunakan Supabase atau microservices. PostgreSQL adalah source of truth; MinIO adalah object storage kompatibel S3 untuk logo workshop dan file receipt/invoice di fase berikutnya.

```text
Expo mobile app
      │ HTTPS (REST)
Fastify API
 ├── auth / membership / authorization
 ├── checkout / void / purchase transaction modules
 ├── reporting modules
 └── MinIO adapter
      │
PostgreSQL 16 (RLS, migrations, audit data)
```

Docker Compose menjalankan API, PostgreSQL, dan MinIO untuk development lokal. Tidak ada reset database pada startup atau deploy.

## Deep modules dan seams

| Module | Interface untuk caller | Tanggung jawab tersembunyi |
| --- | --- | --- |
| Checkout | `completeSale(input, actor)` | authorization, validasi catalog, lock stok, snapshot harga/biaya, write sale/item/payment/movement, dan commit/rollback atomik. |
| Void sale | `voidSale(saleId, reason, actor)` | permission owner, idempotency, status, reversal movement, dan audit. |
| Receive purchase | `completePurchase(input, actor)` | validasi, write purchase/item, stok masuk, movement, serta update cost produk bila disetujui. |
| Reporting | `getDashboard(filter, actor)` | tenant scope, agregasi, pagination, dan query yang terindeks. |

Mobile app tidak boleh mengubah tabel stok atau sale secara langsung. Ia hanya memanggil interface module di API.

## Security dan tenancy

- Access token mengidentifikasi user; membership menentukan workshop aktif dan role `owner` atau `cashier`.
- API melakukan authorization sebelum menjalankan module.
- PostgreSQL RLS tetap membatasi tabel tenant. Koneksi aplikasi memakai role `bengkel_api` tanpa `BYPASSRLS`; setiap transaksi menjalankan `SET LOCAL ROLE bengkel_api` serta mengatur user dan workshop context secara lokal sebelum query.
- Endpoint yang menerima mutasi memakai schema validation, role check, dan database transaction.
- Password disimpan sebagai hash kuat; refresh token disimpan aman di perangkat, bukan sebagai plain text database.
- Object MinIO private; aplikasi menerima pre-signed URL yang pendek setelah pemeriksaan access.

## Konsistensi dan failure mode

- Checkout memakai satu PostgreSQL transaction dan row lock pada produk yang terjual melalui function `app.lock_products`.
- Jika salah satu write gagal, sale, stok, movement, histori, dan pembayaran seluruhnya rollback.
- Void tidak menghapus history dan tidak memakai operasi delete massal.
- Draft cart disimpan lokal; checkout membutuhkan koneksi. Retry tidak boleh menggandakan sale, sehingga request checkout memiliki idempotency key.
- Database menyimpan waktu UTC; tampilan menggunakan timezone workshop saat fitur itu diperkenalkan.

## Operasional

- Migrasi forward-only dijalankan sebagai job eksplisit, bukan pada entrypoint.
- Backup PostgreSQL dan MinIO diuji restore sebelum pilot berbayar.
- Observability minimum: structured request/error log serta error tracking pada mobile dan API.
