# Auto Drive — POS Bengkel MVP

Backend vertical slice saat ini mencakup checkout produk berbayar, snapshot harga/biaya, payment, inventory movement, dan isolasi tenant PostgreSQL.

## Menjalankan environment lokal

1. Salin `.env.example` menjadi `.env`, lalu ganti semua nilai contoh dengan secret lokal.
2. Jalankan `docker compose up -d postgres minio`.
3. Untuk database baru, jalankan job eksplisit `docker compose --profile migrate run --rm migrate`. Migration bersifat forward-only dan job ini memakai credential admin yang berbeda dari API.
4. Untuk database yang sebelumnya dimigrasi manual sampai `022_report_sale_items_index.sql`, verifikasi target dan schema terlebih dahulu, lalu jalankan sekali: `docker compose --profile migrate run --rm -e MIGRATIONS_BASELINE=022_report_sale_items_index.sql migrate`. Migration 023 dan setelahnya tetap akan diterapkan.
5. Jalankan `docker compose up -d api`. API tersedia di port `3000`; startup API tidak pernah menjalankan migration.
6. Untuk test: jalankan `docker compose up -d postgres_test`, lalu `docker compose --profile migrate run --rm migrate_test`. Setelah itu set `TEST_DATABASE_URL` ke `postgresql://bengkel_app:<test-password>@127.0.0.1:5434/bengkel_test` dan jalankan `npm.cmd test`. Script test menolak database yang namanya tidak berakhiran `_test`.

Contoh URL runtime lokal: `postgresql://bengkel_runtime:<app-password>@127.0.0.1:5433/bengkel`.

## Catatan keamanan

Runtime API harus terhubung sebagai role database dengan privilege minimum atau melakukan `SET LOCAL ROLE bengkel_api` di dalam transaction. Jangan memakai owner/superuser database untuk request aplikasi di production.
# auto-drive
