# Design System — POS Bengkel

## Product mode

**Operate.** Pengguna menyelesaikan pekerjaan di lingkungan bengkel yang sibuk. Scanability, nominal yang terbaca jelas, dan langkah sesedikit mungkin lebih penting daripada dekorasi.

## Prinsip antarmuka

- Bahasa operasional: `Kasir`, `Sparepart`, `Jasa`, `Stok Masuk`, `Stok Menipis`, `Bon`, `Batal Transaksi`.
- Touch target minimum 44 × 44 px, tombol checkout dan tindakan destruktif mudah dibedakan.
- Nominal Rupiah selalu memakai format lokal dan menjadi informasi paling menonjol pada POS.
- Search produk, pelanggan, dan plat nomor tersedia sebelum daftar panjang.
- Input teks seminimal mungkin; item cepat, quantity stepper, dan pilihan pembayaran jelas.
- Error harus menjelaskan tindakan pemulihan, terutama stok kurang dan koneksi terputus.

## Navigasi pilot

Bottom navigation berisi `Home`, `Kasir`, `Stok`, dan `Lainnya`.

- **Home:** ringkasan hari ini, stok menipis, transaksi terakhir, serta tombol `Transaksi Baru`.
- **Kasir:** katalog/search, cart, customer/kendaraan opsional, pembayaran, dan bukti transaksi digital.
- **Stok:** produk, stok saat ini, riwayat movement, pembelian.
- **Lainnya:** customer, kendaraan, jasa, pengeluaran, laporan, pengaturan.

## POS flow

`Transaksi baru → (opsional) pilih/tambah kendaraan atau customer → tambah produk/jasa → review cart → pilih satu pembayaran → selesai → lihat/bagikan bukti transaksi.`

Untuk pilot, transaksi normal tidak meminta kendaraan. Saat kendaraan dipilih, histori servis diperbarui otomatis setelah checkout berhasil.

## Komponen minimum

- App shell dan bottom navigation.
- Search field dengan hasil instan dan empty state.
- Product/service row dengan nama, harga, stok (khusus produk), dan tombol tambah.
- Cart line dengan quantity stepper, hapus, diskon per-transaksi.
- Currency input, date picker, select payment method, status badge.
- Confirmation sheet untuk checkout dan void.
- List/table mobile dengan filter tanggal dan pagination.

## Token awal untuk FigCraft

Sebelum branding final, gunakan token semantik agar visual dapat berubah tanpa mengubah flow: `surface`, `surface-muted`, `text-primary`, `text-muted`, `success`, `warning`, `danger`, `action-primary`; spacing 4/8/12/16/24/32; radius 8/12; tipe 12/14/16/20/24/32. Tetapkan warna dan font final setelah discovery dengan bengkel pilot.

## Wireframe yang dibuat pertama di FigCraft

1. Home owner.
2. POS: pencarian dan cart.
3. Checkout dan hasil transaksi.
4. Pencarian plat nomor serta histori kendaraan.
5. Daftar stok menipis dan penerimaan pembelian.
