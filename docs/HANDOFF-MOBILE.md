# Handoff: aplikasi mobile Auto-Drive

Status per 8 November 2026, branch `feat/mobile-app` (belum di-commit). Dokumen ini untuk developer yang melanjutkan mobile (`apps/mobile`) dan untuk partner backend (`apps/api`). Acuan produk: `PRODUCT.md`, `docs/PRD.md`, dan dokumen "Fitur Bengkel" (18 poin).

## 1. Ringkasan

Aplikasi kasir sudah bisa dipakai end-to-end di Android dan iOS untuk alur utama bengkel:

**kendaraan datang → cari/daftarkan plat → pilih jasa + sparepart → bayar → bukti transaksi → riwayat servis kendaraan**

Semua fitur di bawah memakai endpoint API yang **sudah ada**. Tidak ada perubahan backend, skema, migrasi, atau Docker, kecuali `apps/mobile` yang ditambahkan ke `.dockerignore`.

## 2. Yang sudah jadi di mobile

| Layar | Route | Isi | Endpoint |
|---|---|---|---|
| Login | `/login` | Email + password; role dideteksi otomatis | `POST /auth/login`, `GET /dashboard` (cek role) |
| Home (owner) | `/` | Omzet hari ini, transaksi, laba kotor, pengeluaran, **sparepart terlaris hari ini**, stok menipis, transaksi terakhir | `GET /reports/summary`, `GET /dashboard` |
| Home (kasir) | `/` | Tombol transaksi baru + stok menipis | `GET /products` |
| Kasir | `/kasir` | Cari/filter katalog, keranjang, stepper, batas stok, **chip kendaraan di header** | `GET /products`, `GET /services` |
| Kendaraan | `/kendaraan` | Cari plat; kalau belum ada, **daftarkan pelanggan + kendaraan langsung**; lepas/ganti kendaraan | `GET /vehicles?plate=`, `POST /customers`, `POST /vehicles` |
| Riwayat Servis | `/kendaraan/[id]` | Terakhir datang, jumlah kunjungan, total belanja, daftar transaksi (tap untuk lihat isi nota) | `GET /vehicles/:id/history` |
| Pembayaran | `/checkout` | Isi keranjang, kendaraan, diskon, Tunai/QRIS/Transfer, Idempotency-Key | `POST /sales` |
| Bukti Transaksi | `/sales/[id]` | Nota, bagikan sebagai teks, batal transaksi (owner, wajib alasan) | `GET /sales/:id/receipt`, `POST /sales/:id/void` |
| Stok | `/stok` | Daftar stok (mendukung desimal), tombol **+ Sparepart** untuk owner | `GET /products` |
| Tambah Katalog | `/katalog?kind=product\|service` | Owner menambah sparepart (satuan bebas, harga modal, stok minimum, **stok awal**) atau jasa | `POST /products`, `POST /inventory/adjustments`, `POST /services` |
| Lainnya | `/lainnya` | Role aktif, menu katalog (owner), keluar | `POST /auth/logout` |

Stok awal dicatat sebagai adjustment dengan alasan `"Stok awal"`, jadi tetap muncul di inventory movement.

## 3. Menjalankan dan mengecek

Lihat `apps/mobile/README.md`. Singkatnya:

```bash
cd apps/mobile
cp .env.example .env        # isi EXPO_PUBLIC_API_URL dan EXPO_PUBLIC_DEV_WORKSHOP_ID
npm install
npm run android             # atau: npm run ios
npm test && npm run typecheck && npm run lint   # wajib hijau sebelum handoff
```

Catatan:
- **Uji di browser (`w`) belum bisa login.** API belum punya CORS, dan SecureStore tidak punya implementasi web. Pakai emulator, simulator, atau HP fisik lewat Expo Go.
- Emulator Android: jalankan `adb reverse tcp:3000 tcp:3000` supaya `localhost:3000` sampai ke API.

## 4. Peta kode mobile

```
apps/mobile/src/
  api.ts          client REST + terjemahan error API (Inggris) ke pesan Indonesia
  session.ts      login/logout, simpan sesi di SecureStore, deteksi role
  cart.ts         aturan keranjang murni (dites di cart.test.ts)
  cart-store.ts   state keranjang (zustand)
  queries.ts      query key bersama + hook katalog
  format.ts       Rupiah, kuantitas desimal, tanggal (parseQuantity dites di format.test.ts)
  theme.ts        SEMUA warna/spasi/ukuran font. Jangan hardcode nilai di layar.
  components.tsx  Button, Plate, PlateNumber, Band, Field, Stepper, Badge, dst.
  app/            route Expo Router (lihat tabel di atas)
```

Aturan yang dipakai:
- **Desain "Plat Nomor":** shell hitam/putih seperti plat kendaraan. **Kuning hanya untuk aksi utama**, merah hanya untuk bahaya/stok habis. Angka memakai Barlow Condensed. Arah desain lengkap ada di `.impeccable/surfaces/apps-mobile-src-app.md`.
- Target sentuh minimal 48dp, dan teks memakai skala 12/14/16/20/24/32.
- Setiap pesan error API baru **wajib** ditambahkan ke peta `messages` di `api.ts`. Kalau tidak, user melihat "Permintaan gagal (400)".
- Setelah mutasi, invalidasi query key yang relevan dari `queries.ts`.
- Jalan pintas sengaja ditandai komentar `shortcut:`. Cari dengan `grep -rn "shortcut:" apps/mobile/src`.

## 5. Permintaan ke backend (prioritas)

| # | Prioritas | Kebutuhan | Kenapa | Usulan kontrak |
|---|---|---|---|---|
| B1 | **Blocker rilis** | Endpoint identitas user | Login hanya mengembalikan token. Mobile terpaksa mengambil workshop dari `.env` dan menebak role lewat 200/403 `/dashboard`. Ini tidak jalan untuk bengkel kedua. | `GET /me` → `{ userId, email, memberships: [{ workshopId, workshopName, role }] }` |
| B2 | Tinggi | Riwayat kendaraan yang lengkap | Fitur pembeda #1 di dokumen Fitur Bengkel: ganti oli apa, kampas rem kapan, km terakhir. Sekarang API hanya mengembalikan nomor transaksi + total. | `GET /vehicles/:id/history` menyertakan `items[]` (nama, qty, type) dan `kilometer` per transaksi |
| B3 | Tinggi | Catat kilometer per servis | Kolom `vehicles.current_kilometer` ada, tapi tidak pernah ditulis atau dibaca. Tabel `sales` tidak punya km. | Tambah `kilometer?: number` di `POST /sales`, simpan di sale, lalu update `current_kilometer` |
| B4 | Sedang | Idempotency di adjustment stok | Form stok awal bisa dobel kalau respons hilang lalu user menekan coba lagi. | Header `Idempotency-Key` di `POST /inventory/adjustments`, seperti `/sales` |
| B5 | Sedang | Kode error yang stabil | Mobile mencocokkan teks error bahasa Inggris dan teks constraint Postgres (plat duplikat → 400 teks mentah). | `{ error: "...", code: "PLATE_ALREADY_REGISTERED" }`; plat duplikat sebaiknya 409 |
| B6 | Sedang | Endpoint daftar | Belum ada cara membaca daftar transaksi (selain ringkasan hari ini), pembelian, pengeluaran, pelanggan, dan **pergerakan stok** (sudah tercatat di DB tapi tidak bisa dibaca). | `GET /sales?from&to`, `GET /purchases`, `GET /expenses`, `GET /customers?q=`, `GET /inventory/movements?productId=` |
| B7 | Rendah | Cari plat sebagian | `GET /vehicles?plate=` hanya cocok persis, jadi kasir harus mengetik plat lengkap. | Prefix/contains match pada `normalized_plate`, maksimal 10 hasil |
| B8 | Rendah | Edit katalog | `PATCH /products` dan `PATCH /services` sudah ada; mobile belum memakainya (lihat M2). Tidak perlu perubahan backend. | — |
| B9 | Kalau web dipakai | CORS | Hanya perlu kalau tim mau uji atau pakai lewat browser. | `@fastify/cors` dengan allowlist origin dev |

## 6. Gap terhadap dokumen "Fitur Bengkel"

| Poin | Status | Pemilik |
|---|---|---|
| 1–2 Target bengkel motor 1–5 mekanik | ✅ Sesuai | — |
| 3 Alur dimulai dari kendaraan | ✅ Chip kendaraan di Kasir, tetap boleh dilewati untuk pembeli eceran | — |
| 4 Dashboard omzet, laba, transaksi, stok menipis, terlaris | ✅ | — |
| 5 Histori kendaraan (servis terakhir, total belanja) | ⚠️ Ada, tapi tanpa km dan isi item di daftar | Backend B2, B3 |
| 5 Reminder servis | ❌ | Fase berikutnya |
| 6 Inventory: stok masuk, auto keluar, adjustment, minimum, satuan desimal | ⚠️ API lengkap; mobile baru punya stok awal. Belum ada UI pembelian/stok masuk, adjustment, dan riwayat pergerakan. | Mobile M3, Backend B6 |
| 7 Jasa + sparepart dalam satu nota | ✅ | — |
| 7, 15 Mekanik pengerja jasa, komisi | ❌ Tidak ada di DB/API/mobile | **Keputusan produk** |
| 8 Bon / hutang pelanggan | ❌ Metode bayar hanya Tunai/QRIS/Transfer | **Keputusan produk** (PRD: P1; Fitur Bengkel: "sangat relevan") |
| 12 Invoice / reminder WhatsApp | ❌ Baru ada "Bagikan bukti" sebagai teks (bisa dikirim ke WA manual) | Fase berikutnya |
| 13 Owner mode: kendaraan masuk, mekanik aktif, notifikasi | ⚠️ Sebagian di Home | Tergantung mekanik + B6 |
| 14 Web PWA + Next.js + Supabase | ⚠️ Tim memilih Expo native + Fastify + Postgres (TECH-STACK.md). Perlu dikonfirmasi bahwa ini disengaja. | **Keputusan tim** |
| 16 Role Owner/Kasir | ✅ (Mekanik ditunda) | — |
| 17 Onboarding / import CSV | ⚠️ Owner bisa menambah sparepart/jasa satu per satu di app; import CSV belum ada | Mobile/Backend |

## 7. Keputusan yang ditunggu

1. **Bon/hutang masuk pilot atau tidak?** Kalau ya: enum `payment_method` + tabel piutang + pelunasan (backend), lalu opsi "Bon" di Pembayaran dan piutang di Home (mobile).
2. **Catat mekanik per jasa di pilot?** Kalau ya: tabel `mechanics`, `sale_items.mechanic_id`, lalu pemilih mekanik di keranjang.
3. **Kilometer wajib atau opsional saat transaksi dengan kendaraan?** Usulan: opsional, diisi di layar Pembayaran.
4. **Web/PWA tetap di luar scope?** Kalau tidak, butuh B9 dan pengganti SecureStore di web.

## 8. Lanjutan mobile (urut)

- **M1:** Setelah B1 jadi, ganti `resolveMembership` di `session.ts` dengan `GET /me`, hapus `EXPO_PUBLIC_DEV_WORKSHOP_ID`, dan tambahkan pemilih bengkel kalau membership lebih dari satu.
- **M2:** Edit sparepart/jasa (harga, nonaktifkan) memakai `PATCH` yang sudah ada.
- **M3:** Stok masuk (pembelian dari supplier, `POST /purchases` + Idempotency-Key) dan penyesuaian stok dengan alasan.
- **M4:** Pengeluaran (`POST /expenses`) dan laporan periode (`GET /reports/summary` dengan rentang tanggal).
- **M5:** Kelola kasir (`/memberships/cashiers`) untuk owner.
- **M6:** Setelah B2 dan B3: tampilkan km dan item di Riwayat Servis, lalu input km di Pembayaran.
- **M7:** Kuantitas desimal di keranjang (oli eceran, kabel per meter). API sudah menerima; stepper mobile masih +1/−1.

## 9. Masalah yang diketahui

- **Android:** setelah cold relaunch, tab bar kadang mendapat ruang kosong ~48dp di bawah. Inset navigasi sistem dihitung dua kali. Masalahnya ada di level `expo-router/native-tabs` atau Expo Go dan belum terselesaikan. Perlu dicek ulang di development build (bukan Expo Go).
- **Deep link** langsung ke `/kasir` sebagai tab pertama yang dirender bisa membuat bar total tertutup tab bar. Alur normal (tap tab atau tombol Transaksi Baru) aman.
- **Review desain (Impeccable)** belum final. Masih menunggu screenshot iOS untuk Home, Kasir dengan item, dan Pembayaran. Setelah itu token "Plat Nomor" akan digabung ke `DESIGN.md`, yang saat ini masih memuat token awal FigCraft.
- Tidak ada test UI otomatis. Yang dites: aturan keranjang (`cart.test.ts`) dan parser kuantitas (`format.test.ts`). Layar diverifikasi manual di emulator Android 360dp dan simulator iOS.
