# Operasional API dan Database

## Role database

- Job `migrate` memakai `bengkel_app` untuk migration forward-only.
- API memakai `bengkel_runtime`, yang hanya dapat `SET LOCAL ROLE bengkel_api` di dalam transaction.
- Jalankan migration sebelum menyalakan atau memperbarui API; startup API tidak menjalankan migration.

## Health check

- `GET /health` membuktikan proses API hidup.
- `GET /ready` membuktikan API dapat mengakses PostgreSQL. Docker memakai endpoint ini sebagai health check.

## Backup dan restore

Backup dan restore harus dilakukan oleh operator terjadwal, bukan oleh API. Simpan hasil backup di penyimpanan yang terpisah dari host database (misalnya bucket MinIO yang aksesnya khusus backup).

Contoh backup manual dari host yang menjalankan Compose:

```powershell
docker compose exec -T postgres pg_dump -U bengkel_app -d bengkel -Fc > backups/bengkel-YYYYMMDD.dump
```

Sebelum mengandalkan prosedur ini, lakukan rehearsal berkala ke database baru yang namanya berakhiran `_restore_test`. Jangan pernah menjalankan restore ke database `bengkel` tanpa persetujuan eksplisit dan backup yang sudah diverifikasi. Minimal verifikasi artefak dengan `pg_restore --list`; kemudian restore hanya ke target uji terisolasi dan jalankan smoke test API.

Retention, enkripsi backup, dan kredensial bucket adalah keputusan deployment. Nilai tersebut tidak disimpan di repository.
