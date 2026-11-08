# Graph Report - auto-drive  (2026-11-08)

## Corpus Check
- 106 files · ~72,048 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 2)

## Summary
- 709 nodes · 1419 edges · 55 communities (32 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
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
- PostgresSessionAuthenticator
- Tech Stack
- Auto Drive — POS Bengkel MVP
- complete-sale.ts
- Operasional API dan Database
- require-test-database.mjs
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
2. `pg` - 26 edges
3. `PostgresCatalogPort` - 23 edges
4. `useSession` - 21 edges
5. `CheckoutScreen()` - 18 edges
6. `ErrorNotice()` - 18 edges
7. `workshops` - 16 edges
8. `PostgresCheckoutPort` - 16 edges
9. `apiRequest()` - 16 edges
10. `PostgresAuthPort` - 15 edges

## Surprising Connections (you probably didn't know these)
- `app.apply_inventory_movement()` --reads_from--> `products`  [EXTRACTED]
  apps/api/migrations/011_tenant_integrity.sql → apps/api/migrations/001_initial.sql
- `vehicles_workshop_normalized_plate_unique` --indexes--> `vehicles`  [EXTRACTED]
  apps/api/migrations/011_tenant_integrity.sql → apps/api/migrations/001_initial.sql
- `purchases` --references--> `users`  [EXTRACTED]
  apps/api/migrations/006_purchases.sql → apps/api/migrations/001_initial.sql
- `app.find_user_by_email()` --reads_from--> `users`  [EXTRACTED]
  apps/api/migrations/007_auth_sessions.sql → apps/api/migrations/001_initial.sql
- `expenses` --references--> `users`  [EXTRACTED]
  apps/api/migrations/010_expenses_dashboard.sql → apps/api/migrations/001_initial.sql

## Import Cycles
- None detected.

## Communities (55 total, 23 thin omitted)

### Community 0 - "001_initial.sql"
Cohesion: 0.14
Nodes (24): app.apply_inventory_movement(), customers, customers_touch_updated_at, inventory_movements, inventory_movements_product_created_index, payments, product_categories, products (+16 more)

### Community 1 - "server.ts"
Cohesion: 0.07
Nodes (28): Actor, adjustInventory(), InventoryPort, adjustmentSchema, cashierSchema, cashierStatusSchema, categorySchema, customerSchema (+20 more)

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
Cohesion: 0.08
Nodes (23): InventoryMovement, ProductRow, SaleItem, ProductRow, Actor, completePurchase(), PurchaseInput, PurchasePort (+15 more)

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

### Community 25 - "Tech Stack"
Cohesion: 0.40
Nodes (4): Environment, Pilihan MVP, Tech Stack, Yang sengaja tidak digunakan

### Community 26 - "Auto Drive — POS Bengkel MVP"
Cohesion: 0.33
Nodes (5): auto-drive, Auto Drive — POS Bengkel MVP, Catatan keamanan, Data demo lokal, Menjalankan environment lokal

### Community 36 - "complete-sale.ts"
Cohesion: 0.12
Nodes (10): Actor, CheckoutPort, completeSale(), isValidQuantity(), isWholeRupiah(), Product, SaleInput, getReceipt() (+2 more)

### Community 37 - "Operasional API dan Database"
Cohesion: 0.40
Nodes (4): Backup dan restore, Health check, Operasional API dan Database, Role database

### Community 48 - "mobile/package.json"
Cohesion: 0.04
Nodes (45): { defineConfig }, expoConfig, devDependencies, eslint, eslint-config-expo, @types/react, typescript, typescript (+37 more)

### Community 53 - "checkout.tsx"
Cohesion: 0.06
Nodes (100): ApiError, apiRequest(), Dashboard, messages, PeriodReport, Product, Receipt, Role (+92 more)

### Community 57 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, expo, expo-constants, expo-crypto, expo-device, expo-font, expo-glass-effect, expo-image (+20 more)

### Community 64 - "expo"
Cohesion: 0.08
Nodes (24): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+16 more)

### Community 69 - "buildApp"
Cohesion: 0.16
Nodes (21): Actor, CatalogPort, createProduct(), createProductCategory(), createService(), createServiceCategory(), createSupplier(), deleteProductCategory() (+13 more)

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
- **256 isolated node(s):** `ProductRow`, `ProductRow`, `SaleItem`, `InventoryMovement`, `ProductRow` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 336 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildApp()` connect `buildApp` to `server.ts`, `PostgresCatalogPort`, `seed-demo.ts`, `PostgresCheckoutPort`, `crm.ts`, `PostgresAuthPort`, `complete-sale.ts`, `pg`, `PostgresCrmPort`, `PostgresPurchasePort`, `PostgresVoidSalePort`, `PostgresOwnerOperationsPort`, `owner-operations.ts`, `auth.ts`, `PostgresInventoryPort`, `PostgresReceiptPort`, `PostgresSessionAuthenticator`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `pg` connect `pg` to `server.ts`, `PostgresCatalogPort`, `seed-demo.ts`, `PostgresCrmPort`, `PostgresOwnerOperationsPort`, `PostgresInventoryPort`, `PostgresReceiptPort`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `mobile/package.json`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `ProductRow`, `ProductRow`, `SaleItem` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `001_initial.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.135632183908046 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `seed-demo.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0553306342780027 - nodes in this community are weakly interconnected._