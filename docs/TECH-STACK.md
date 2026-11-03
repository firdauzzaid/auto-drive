# Tech Stack

## Pilihan MVP

| Layer | Pilihan | Alasan |
| --- | --- | --- |
| Mobile | Expo + React Native + TypeScript + Expo Router | Satu codebase Android/iOS; Android menjadi prioritas pilot. |
| Data fetching | TanStack Query | Cache, loading, retry, dan invalidation data server. |
| UI state | Zustand, hanya state UI/cart | Tidak menggandakan server state. |
| Forms/validation | React Hook Form + Zod | Form cepat dan kontrak input eksplisit. |
| Backend | Node.js LTS + TypeScript + Fastify | Modular monolith yang ringan dan cepat untuk dua orang. |
| Database | PostgreSQL 16 | Transaction, reporting, lock stok, RLS, dan indeks. |
| Storage | MinIO (S3-compatible) | Self-hosted/private storage untuk logo dan file receipt; bukan pengganti database/auth. |
| Local runtime | Docker Compose | PostgreSQL, MinIO, dan API repeatable di lokal/CI. |
| Migration | SQL migration forward-only | Schema eksplisit, dapat diaudit, tanpa reset data. |
| Monitoring | Error tracking mobile + API, structured logs | Cukup untuk pilot; metrics stack besar ditunda. |

## Yang sengaja tidak digunakan

- Supabase, termasuk Auth, Storage, dan database managed.
- Microservices, message broker, Kubernetes, GraphQL, dan full offline sync.
- Web/admin app terpisah pada pilot.

## Environment

- Development: Docker Compose dengan volume yang persisten; PostgreSQL memakai host port `5433` agar tidak mengganggu instance lokal pada `5432`.
- Test: database disposable khusus test saja, bukan database developer/pilot.
- Production: Postgres dan MinIO dengan backup, TLS, secret manager, dan migration job eksplisit. Hosting final dipilih setelah volume pilot dan kebutuhan operasional tervalidasi.
