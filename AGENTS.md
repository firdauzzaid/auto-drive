# Engineering operating rules

## Urutan kerja

1. Baca seluruh `AGENTS.md` sebelum melakukan pekerjaan apa pun.
2. Pilih satu skill Matt Pocock yang paling relevan, baca seluruh `SKILL.md`, lalu ikuti workflow-nya.
3. Untuk pekerjaan kode gunakan Ponytail level `full` untuk perubahan behavior, business logic, data flow, permission, shared code, bug, atau refactor. Analisis trivial dapat proporsional.
4. Gunakan Graphify sebelum memahami atau mengubah kode maupun arsitektur non-trivial. Baca source langsung hanya bila konteks Graphify belum cukup.
5. Setelah satu logical change selesai, update Graphify sebelum handoff.
6. Untuk UI/UX, jalankan `impeccable context` satu kali per sesi dan gunakan Impeccable.

## Batas perubahan

1. Pilih solusi paling sederhana yang memenuhi requirement seluruhnya.
2. Jaga scope; jangan melakukan refactor, cleanup, improvement, atau inisiatif di luar task.
3. Pertahankan API contract, URL, schema, permission, UX flow, default, dan behavior di luar kebutuhan task.
4. Ikuti pola, arsitektur, component, utility, dan dependency yang sudah tersedia sebelum membuat pola baru.
5. Jangan menambah dependency bila stack yang ada dapat menyelesaikannya.
6. Berhenti saat acceptance criteria terpenuhi.

## Perbaikan bug

1. Temukan root cause, bukan gejala.
2. Telusuri caller, shared component, handler, utility, query, test, dan alur yang menggunakan pola sama.
3. Perbaiki seluruh kasus dengan root cause sama.
4. Laporkan kasus mirip yang memiliki behavior berbeda; jangan otomatis mengubahnya.
5. Tambahkan atau jalankan test regresi yang membuktikan bug tidak kembali.

## Perlindungan data dan database

Data existing tidak disposable. Tanpa persetujuan eksplisit, jangan reset/recreate database, menjalankan `migrate:fresh`, `DROP DATABASE`, `DROP SCHEMA`, truncate, delete massal, menghapus Docker volume, destructive seed/migration, atau mengubah migration lama yang telah dipakai shared/staging/production.

Gunakan migration forward-only dan non-destructive. Sebelum migration, seed, atau mutasi berisiko: verifikasi environment dan database target, pahami dampak ke data existing, lalu pilih solusi non-destructive. Jika satu-satunya solusi dapat kehilangan data, berhenti dan minta persetujuan eksplisit.

Deploy, build, startup, CI/CD, Dockerfile, entrypoint, dan post-deploy tidak boleh berisi database reset.

## Validasi dan performa

Uji proporsional terhadap risiko, khususnya business logic, permission, calculation, mutasi data, migration, shared behavior, dan regresi bug. Jangan mengklaim tervalidasi bila belum dijalankan.

Optimasi hanya untuk task atau bottleneck nyata: hilangkan kerja/query/render tak perlu, cegah N+1, paginasi dataset besar, minimalkan payload, cache bila invalidasi jelas, lalu tambah index dari access pattern nyata. Jangan korbankan simplicity demi micro-optimization.

## Klarifikasi dan konteks

Minta klarifikasi hanya bila ambiguitas mengubah business rule, permission, operasi destruktif, interpretasi data, scope, atau menghasilkan beberapa behavior valid.

- Product/business rule: baca `PRODUCT.md` dan `docs/PRD.md`.
- Architecture, dependency, integration, data, deployment: baca `docs/TECH-STACK.md` dan `docs/ARCHITECTURE.md`.
- UI/UX: baca `DESIGN.md`.
- Database: baca `docs/DATABASE.md`, schema, migration, dan deployment yang relevan.

Jika Graphify, Impeccable, test, build, atau tool wajib gagal, laporkan perintah dan error relevan; jangan mengklaim berhasil, membuat hasil tiruan, atau memasang tool pengganti tanpa kebutuhan/izin.

Saat aturan bertentangan, prioritaskan: keselamatan data, security/permission, correctness, scope/acceptance criteria, existing behavior, existing architecture, regression prevention, testing, performance, lalu cleanup.

## Prinsip akhir

`Understand → Trace → Change minimally → Protect data → Test → Validate → Stop`
