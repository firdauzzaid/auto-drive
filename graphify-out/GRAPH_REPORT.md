# Graph Report - auto-drive  (2026-11-08)

## Corpus Check
- 111 files · ~76,076 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 2)

## Summary
- 743 nodes · 1586 edges · 62 communities (39 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9650e03c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 001_initial.sql
- server.ts
- PostgresCatalogPort
- seed-demo.ts
- PostgresCheckoutPort
- crm.ts
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
- cart.ts
- Tech Stack
- Auto Drive — POS Bengkel MVP
- complete-sale.ts
- Operasional API dan Database
- require-test-database.mjs
- postgres-purchase.test.ts
- postgres-void-sale.test.ts
- Handoff: aplikasi mobile Auto-Drive
- migrate.mjs
- postgres-checkout-port.ts
- adjust-inventory.ts
- mobile/package.json
- checkout.tsx
- dependencies
- expo
- buildApp
- auth.ts
- memberships
- users
- mobile/tsconfig.json
- expenses
- mobile/AGENTS.md
- Auto Drive — aplikasi mobile
- 011_tenant_integrity.sql
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `buildApp()` - 60 edges
2. `useSession` - 29 edges
3. `pg` - 26 edges
4. `ErrorNotice()` - 24 edges
5. `PostgresCatalogPort` - 23 edges
6. `apiRequest()` - 22 edges
7. `Icon()` - 20 edges
8. `Button()` - 19 edges
9. `CheckoutScreen()` - 18 edges
10. `workshops` - 16 edges

## Surprising Connections (you probably didn't know these)
- `8. Lanjutan mobile (urut)` --references--> `resolveMembership()`  [INFERRED]
  docs/HANDOFF-MOBILE.md → apps/mobile/src/session.ts
- `app.apply_inventory_movement()` --reads_from--> `products`  [EXTRACTED]
  apps/api/migrations/011_tenant_integrity.sql → apps/api/migrations/001_initial.sql
- `vehicles_workshop_normalized_plate_unique` --indexes--> `vehicles`  [EXTRACTED]
  apps/api/migrations/011_tenant_integrity.sql → apps/api/migrations/001_initial.sql
- `purchases` --references--> `users`  [EXTRACTED]
  apps/api/migrations/006_purchases.sql → apps/api/migrations/001_initial.sql
- `app.find_user_by_email()` --reads_from--> `users`  [EXTRACTED]
  apps/api/migrations/007_auth_sessions.sql → apps/api/migrations/001_initial.sql

## Import Cycles
- None detected.

## Communities (62 total, 23 thin omitted)

### Community 0 - "001_initial.sql"
Cohesion: 0.14
Nodes (24): app.apply_inventory_movement(), customers, customers_touch_updated_at, inventory_movements, inventory_movements_product_created_index, payments, product_categories, products (+16 more)

### Community 1 - "server.ts"
Cohesion: 0.07
Nodes (26): PostgresSessionAuthenticator, activeActor(), adjustmentSchema, cashierSchema, cashierStatusSchema, categorySchema, customerSchema, expenseSchema (+18 more)

### Community 2 - "PostgresCatalogPort"
Cohesion: 0.15
Nodes (3): PostgresCatalogPort, productAuditValue(), ProductRow

### Community 3 - "seed-demo.ts"
Cohesion: 0.06
Nodes (35): App, ensureNamedResource(), findWorkshop(), NamedResource, Product, Request, seedDemo(), SeedInput (+27 more)

### Community 5 - "crm.ts"
Cohesion: 0.39
Nodes (7): Actor, createCustomer(), createVehicle(), CrmPort, ensureOperator(), findVehiclesByPlate(), listVehicleHistory()

### Community 7 - "Engineering operating rules"
Cohesion: 0.22
Nodes (8): Batas perubahan, Engineering operating rules, Klarifikasi dan konteks, Perbaikan bug, Perlindungan data dan database, Prinsip akhir, Urutan kerja, Validasi dan performa

### Community 8 - "pg"
Cohesion: 0.37
Nodes (5): apps_api_tests_test_database_databaseurl, ref_node_assert, ref_node_crypto, ref_node_test, pg

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

### Community 24 - "cart.ts"
Cohesion: 0.22
Nodes (15): addItem(), Cart, CartItem, CartLine, CartVehicle, changed(), emptyCart(), findLine() (+7 more)

### Community 25 - "Tech Stack"
Cohesion: 0.40
Nodes (4): Environment, Pilihan MVP, Tech Stack, Yang sengaja tidak digunakan

### Community 26 - "Auto Drive — POS Bengkel MVP"
Cohesion: 0.33
Nodes (5): auto-drive, Auto Drive — POS Bengkel MVP, Catatan keamanan, Data demo lokal, Menjalankan environment lokal

### Community 36 - "complete-sale.ts"
Cohesion: 0.21
Nodes (10): Actor, CheckoutPort, completeSale(), isValidQuantity(), isWholeRupiah(), Product, SaleInput, getReceipt() (+2 more)

### Community 37 - "Operasional API dan Database"
Cohesion: 0.40
Nodes (4): Backup dan restore, Health check, Operasional API dan Database, Role database

### Community 41 - "postgres-purchase.test.ts"
Cohesion: 0.14
Nodes (6): ProductRow, Actor, completePurchase(), PurchaseInput, PurchasePort, PurchaseProduct

### Community 42 - "postgres-void-sale.test.ts"
Cohesion: 0.20
Nodes (4): Actor, voidSale(), VoidSaleInput, VoidSalePort

### Community 43 - "Handoff: aplikasi mobile Auto-Drive"
Cohesion: 0.18
Nodes (10): 1. Ringkasan, 2. Yang sudah jadi di mobile, 3. Menjalankan dan mengecek, 4. Peta kode mobile, 5. Permintaan ke backend (prioritas), 6. Gap terhadap dokumen "Fitur Bengkel", 7. Keputusan yang ditunggu, 8. Lanjutan mobile (urut) (+2 more)

### Community 45 - "migrate.mjs"
Cohesion: 0.33
Nodes (5): ref_node_fs, ref_node_path, client, migrationDirectory, migrationNames

### Community 46 - "postgres-checkout-port.ts"
Cohesion: 0.50
Nodes (3): InventoryMovement, ProductRow, SaleItem

### Community 47 - "adjust-inventory.ts"
Cohesion: 0.50
Nodes (3): Actor, adjustInventory(), InventoryPort

### Community 48 - "mobile/package.json"
Cohesion: 0.05
Nodes (41): { defineConfig }, expoConfig, devDependencies, eslint, eslint-config-expo, @types/react, typescript, typescript (+33 more)

### Community 53 - "checkout.tsx"
Cohesion: 0.07
Nodes (108): ApiError, apiRequest(), Dashboard, messages, PeriodReport, Product, Receipt, Role (+100 more)

### Community 57 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, expo, expo-constants, expo-crypto, expo-device, expo-font, expo-glass-effect, expo-image (+20 more)

### Community 64 - "expo"
Cohesion: 0.08
Nodes (24): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+16 more)

### Community 69 - "buildApp"
Cohesion: 0.15
Nodes (22): Actor, CatalogPort, createProduct(), createProductCategory(), createService(), createServiceCategory(), createSupplier(), deleteProductCategory() (+14 more)

### Community 84 - "auth.ts"
Cohesion: 0.21
Nodes (14): AuthPort, deriveKey, hashPassword(), listCashiers(), login(), logout(), logoutAll(), normalizeEmail() (+6 more)

### Community 89 - "memberships"
Cohesion: 0.14
Nodes (8): app.has_workshop_access(), memberships, memberships_touch_updated_at, app.authenticate_session(), app.apply_inventory_adjustment(), app.register_cashier(), app.register_cashier(), app.list_cashiers()

### Community 109 - "users"
Cohesion: 0.27
Nodes (7): users, users_touch_updated_at, audit_logs, audit_logs_workshop_created_index, app.find_user_by_email(), refresh_tokens, refresh_tokens_user_expiry_index

### Community 111 - "mobile/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, allowImportingTsExtensions, paths, strict, extends, include, @/assets/*, expo/tsconfig.base

### Community 130 - "expenses"
Cohesion: 0.60
Nodes (5): expense_categories, expense_categories_touch_updated_at, expenses, expenses_touch_updated_at, expenses_workshop_occurred_index

### Community 131 - "mobile/AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 140 - "Auto Drive — aplikasi mobile"
Cohesion: 0.50
Nodes (3): Auto Drive — aplikasi mobile, Cek sebelum handoff, Menjalankan lokal

## Knowledge Gaps
- **267 isolated node(s):** `ProductRow`, `ProductRow`, `SaleItem`, `InventoryMovement`, `ProductRow` (+262 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 348 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildApp()` connect `buildApp` to `server.ts`, `PostgresCatalogPort`, `seed-demo.ts`, `PostgresCheckoutPort`, `crm.ts`, `PostgresAuthPort`, `pg`, `PostgresCrmPort`, `PostgresPurchasePort`, `PostgresVoidSalePort`, `PostgresOwnerOperationsPort`, `owner-operations.ts`, `PostgresInventoryPort`, `PostgresReceiptPort`, `complete-sale.ts`, `postgres-purchase.test.ts`, `postgres-void-sale.test.ts`, `adjust-inventory.ts`, `auth.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `pg` connect `pg` to `server.ts`, `PostgresCatalogPort`, `seed-demo.ts`, `complete-sale.ts`, `postgres-purchase.test.ts`, `postgres-void-sale.test.ts`, `PostgresCrmPort`, `postgres-checkout-port.ts`, `PostgresVoidSalePort`, `migrate.mjs`, `PostgresOwnerOperationsPort`, `PostgresInventoryPort`, `PostgresReceiptPort`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `mobile/package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `ProductRow`, `ProductRow`, `SaleItem` to the rest of the system?**
  _267 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `001_initial.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.135632183908046 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `seed-demo.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0553306342780027 - nodes in this community are weakly interconnected._