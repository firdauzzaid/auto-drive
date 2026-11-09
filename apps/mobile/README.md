# Auto Drive — aplikasi mobile

Expo + React Native + Expo Router. Aplikasi ini berdiri sendiri (punya `package.json` dan lockfile sendiri) dan tidak memakai workspace root.

## Menjalankan lokal

1. Pastikan API lokal sehat: `curl http://localhost:3000/ready` (lihat README root).
2. `cp .env.example .env`, lalu isi:
   - `EXPO_PUBLIC_API_URL`: `http://localhost:3000` (simulator iOS), `http://10.0.2.2:3000` (emulator Android), atau `http://<IP-LAN>:3000` (HP fisik).
   - `EXPO_PUBLIC_DEV_WORKSHOP_ID`: ID workshop demo. Sementara wajib karena API belum punya endpoint yang mengembalikan workshop/role user.
3. `npm install`, lalu `npm run ios` atau `npm run android`.
4. Masuk dengan akun demo dari `.env` root (`DEMO_OWNER_EMAIL` / `DEMO_CASHIER_EMAIL`).

## Cek sebelum handoff

`npm test` (aturan cart), `npm run typecheck`, `npm run lint`.
