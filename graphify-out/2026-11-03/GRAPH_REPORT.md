# Graph Report - auto-drive  (2026-11-03)

## Corpus Check
- 74 files · ~27,020 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 3, .example 1)

## Summary
- 448 nodes · 785 edges · 46 communities (25 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c9922691`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 001_initial.sql
- server.ts
- PostgresCatalogPort
- package.json
- PostgresCheckoutPort
- purchase.test.ts
- PostgresAuthPort
- Engineering operating rules
- pg
- 006_purchases.sql
- Design System — POS Bengkel
- BRD analysis — SaaS Inventori & POS Bengkel
- PRD — MVP POS & Inventori Bengkel Motor
- PostgresCrmPort
- PostgresPurchasePort
- PostgresVoidSalePort
- Database System
- PostgresOwnerOperationsPort
- owner-operations.ts
- Architecture System
- Aplikasi Kasir & Stok untuk Bengkel
- compilerOptions
- PostgresInventoryPort
- PostgresReceiptPort
- complete-sale.ts
- Tech Stack
- Auto Drive — POS Bengkel MVP
- migrate.mjs
- Operasional API dan Database
- require-test-database.mjs
- buildApp
- auth.ts
- crm.ts
- PostgresSessionAuthenticator
- adjust-inventory.ts

## God Nodes (most connected - your core abstractions)
1. `buildApp()` - 57 edges
2. `PostgresCatalogPort` - 23 edges
3. `pg` - 23 edges
4. `workshops` - 16 edges
5. `PostgresCheckoutPort` - 16 edges
6. `PostgresAuthPort` - 15 edges
7. `users` - 12 edges
8. `sales` - 12 edges
9. `PostgresPurchasePort` - 12 edges
10. `PostgresVoidSalePort` - 11 edges

## Surprising Connections (you probably didn't know these)
- `purchases` --references--> `users`  [EXTRACTED]
  apps/api/migrations/006_purchases.sql → apps/api/migrations/001_initial.sql
- `app.find_user_by_email()` --reads_from--> `users`  [EXTRACTED]
  apps/api/migrations/007_auth_sessions.sql → apps/api/migrations/001_initial.sql
- `purchases` --references--> `workshops`  [EXTRACTED]
  apps/api/migrations/006_purchases.sql → apps/api/migrations/001_initial.sql
- `suppliers` --references--> `workshops`  [EXTRACTED]
  apps/api/migrations/006_purchases.sql → apps/api/migrations/001_initial.sql
- `app.apply_inventory_adjustment()` --reads_from--> `memberships`  [EXTRACTED]
  apps/api/migrations/013_inventory_adjustments.sql → apps/api/migrations/001_initial.sql

## Import Cycles
- None detected.

## Communities (46 total, 21 thin omitted)

### Community 0 - "001_initial.sql"
Cohesion: 0.06
Nodes (46): app.apply_inventory_movement(), app.has_workshop_access(), customers, customers_touch_updated_at, inventory_movements, inventory_movements_product_created_index, memberships, memberships_touch_updated_at (+38 more)

### Community 1 - "server.ts"
Cohesion: 0.08
Nodes (24): adjustmentSchema, cashierSchema, cashierStatusSchema, categorySchema, customerSchema, expenseSchema, loginSchema, productItemSchema (+16 more)

### Community 2 - "PostgresCatalogPort"
Cohesion: 0.15
Nodes (3): PostgresCatalogPort, productAuditValue(), ProductRow

### Community 3 - "package.json"
Cohesion: 0.09
Nodes (22): dependencies, fastify, pg, zod, devDependencies, @types/node, @types/pg, typescript (+14 more)

### Community 5 - "purchase.test.ts"
Cohesion: 0.17
Nodes (5): Actor, completePurchase(), PurchaseInput, PurchasePort, PurchaseProduct

### Community 7 - "Engineering operating rules"
Cohesion: 0.22
Nodes (8): Batas perubahan, Engineering operating rules, Klarifikasi dan konteks, Perbaikan bug, Perlindungan data dan database, Prinsip akhir, Urutan kerja, Validasi dan performa

### Community 8 - "pg"
Cohesion: 0.14
Nodes (13): InventoryMovement, ProductRow, SaleItem, ProductRow, Actor, voidSale(), VoidSaleInput, VoidSalePort (+5 more)

### Community 9 - "006_purchases.sql"
Cohesion: 0.29
Nodes (8): purchase_items, purchase_items_purchase_index, purchases, purchases_touch_updated_at, purchases_workshop_completed_index, suppliers, suppliers_touch_updated_at, purchases_workshop_idempotency_key_unique

### Community 10 - "Design System — POS Bengkel"
Cohesion: 0.22
Nodes (8): Design System — POS Bengkel, Komponen minimum, Navigasi pilot, POS flow, Prinsip antarmuka, Product mode, Token awal untuk FigCraft, Wireframe yang dibuat pertama di FigCraft

### Community 11 - "BRD analysis — SaaS Inventori & POS Bengkel"
Cohesion: 0.22
Nodes (8): BRD analysis — SaaS Inventori & POS Bengkel, In-scope data and invariants, Material decisions still missing, Priority interpretation, Product and delivery risks, Source, Source and scope, What the BRD actually requires for the MVP

### Community 12 - "PRD — MVP POS & Inventori Bengkel Motor"
Cohesion: 0.22
Nodes (8): Business rules, Di luar scope, Keputusan yang harus disetujui sebelum implementasi POS, P0: pilot scope, P1 setelah pilot, PRD — MVP POS & Inventori Bengkel Motor, Rilis secara vertical slice, Tujuan

### Community 16 - "Database System"
Cohesion: 0.25
Nodes (7): Akses dan mutasi, Database System, Indeks awal, Konvensi dan invariant, P1 additions, Relasi penting, Tabel P0

### Community 18 - "owner-operations.ts"
Cohesion: 0.43
Nodes (6): Actor, getDashboard(), getPeriodReport(), OwnerOperationsPort, recordExpense(), requireOwner()

### Community 19 - "Architecture System"
Cohesion: 0.29
Nodes (6): Architecture System, Deep modules dan seams, Keputusan utama, Konsistensi dan failure mode, Operasional, Security dan tenancy

### Community 20 - "Aplikasi Kasir & Stok untuk Bengkel"
Cohesion: 0.29
Nodes (6): Aplikasi Kasir & Stok untuk Bengkel, Janji produk, Pengguna, Prinsip produk, Produk dan pasar awal, Ukuran keberhasilan pilot

### Community 21 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, allowImportingTsExtensions, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 24 - "complete-sale.ts"
Cohesion: 0.12
Nodes (10): Actor, CheckoutPort, completeSale(), isValidQuantity(), isWholeRupiah(), Product, SaleInput, getReceipt() (+2 more)

### Community 25 - "Tech Stack"
Cohesion: 0.40
Nodes (4): Environment, Pilihan MVP, Tech Stack, Yang sengaja tidak digunakan

### Community 26 - "Auto Drive — POS Bengkel MVP"
Cohesion: 0.40
Nodes (4): auto-drive, Auto Drive — POS Bengkel MVP, Catatan keamanan, Menjalankan environment lokal

### Community 36 - "migrate.mjs"
Cohesion: 0.33
Nodes (5): ref_node_fs, ref_node_path, client, migrationDirectory, migrationNames

### Community 37 - "Operasional API dan Database"
Cohesion: 0.40
Nodes (4): Backup dan restore, Health check, Operasional API dan Database, Role database

### Community 41 - "buildApp"
Cohesion: 0.15
Nodes (22): Actor, CatalogPort, createProduct(), createProductCategory(), createService(), createServiceCategory(), createSupplier(), deleteProductCategory() (+14 more)

### Community 42 - "auth.ts"
Cohesion: 0.21
Nodes (14): AuthPort, deriveKey, hashPassword(), listCashiers(), login(), logout(), logoutAll(), normalizeEmail() (+6 more)

### Community 43 - "crm.ts"
Cohesion: 0.39
Nodes (7): Actor, createCustomer(), createVehicle(), CrmPort, ensureOperator(), findVehiclesByPlate(), listVehicleHistory()

### Community 45 - "adjust-inventory.ts"
Cohesion: 0.50
Nodes (3): Actor, adjustInventory(), InventoryPort

## Knowledge Gaps
- **132 isolated node(s):** `ProductRow`, `ProductRow`, `SaleItem`, `InventoryMovement`, `ProductRow` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 204 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildApp()` connect `buildApp` to `server.ts`, `PostgresCatalogPort`, `PostgresCheckoutPort`, `purchase.test.ts`, `PostgresAuthPort`, `pg`, `auth.ts`, `crm.ts`, `PostgresSessionAuthenticator`, `PostgresCrmPort`, `PostgresPurchasePort`, `PostgresVoidSalePort`, `adjust-inventory.ts`, `PostgresOwnerOperationsPort`, `owner-operations.ts`, `PostgresInventoryPort`, `PostgresReceiptPort`, `complete-sale.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `PostgresCatalogPort` connect `PostgresCatalogPort` to `server.ts`, `buildApp`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `pg` connect `pg` to `server.ts`, `PostgresCatalogPort`, `package.json`, `migrate.mjs`, `PostgresCrmPort`, `PostgresOwnerOperationsPort`, `PostgresInventoryPort`, `PostgresReceiptPort`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `ProductRow`, `ProductRow`, `SaleItem` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `001_initial.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.057859703020993344 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._