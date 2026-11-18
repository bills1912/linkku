# ⚡ Linkku — Link-in-bio internal (mirip Linktree)

Satu halaman berisi semua tautan penting tim, beralamat `http://server/username`.

## Fitur
**Tautan**
- Tambah tautan (judul terisi otomatis dari domain), tambah **header/judul bagian**
- Edit judul & URL langsung di kartu, tersimpan otomatis
- **Seret untuk mengurutkan** (drag & drop)
- Saklar tampil/sembunyi, sembunyikan tautan nonaktif dari daftar
- **Thumbnail**: unggah gambar atau pilih emoji
- **Prioritaskan**: animasi goyang / denyut / bergoyang / berpendar
- **Jadwalkan**: tautan tampil hanya di rentang waktu tertentu
- Duplikat, salin URL, hapus, jumlah klik per tautan

**Tampilan**
- Foto profil, judul profil, bio (160 karakter)
- **Ikon sosial** (WhatsApp, Instagram, Email, Telepon, LinkedIn, YouTube, TikTok, dll.) — bisa diurutkan, posisi atas/bawah. Nomor `08xx` otomatis jadi `wa.me/628xx`
- 14 **tema siap pakai** (termasuk tema *BPS*)
- Kustom: latar warna polos / gradien / gambar, 12 gaya tombol (isi, garis tepi, bayangan tegas, bayangan lembut × kotak, membulat, kapsul), warna tombol, warna teks, warna bayangan, 12 font
- **Pratinjau HP langsung** di sisi kanan (di layar kecil: tombol "Pratinjau")

**Bagikan & analitik**
- Tombol bagikan: salin tautan, **QR code** (bisa diunduh), WhatsApp, Telegram, Email
- Setiap tautan di halaman publik punya menu ⋯ untuk dibagikan sendiri
- Analitik: kunjungan, pengunjung unik, klik, CTR, grafik harian (7/30/90/365 hari), klik per tautan, perangkat, sumber kunjungan

**Pengaturan**
- Ganti username, email, kata sandi; judul & deskripsi SEO; sembunyikan dari mesin pencari (aktif secara default); hapus akun

## Menjalankan
Butuh Node.js 18+.

```bash
npm install
npm start          # http://localhost:3000
```

Buka `http://localhost:3000`, daftar akun, lalu kelola tautan di `/admin`.

## Variabel lingkungan (opsional)
| Variabel | Fungsi |
|---|---|
| `PORT` | Port server (default 3000) |
| `REGISTRATION_CODE` | Kode undangan wajib saat daftar — **disarankan** agar hanya tim yang bisa membuat akun |
| `PUBLIC_URL` | URL publik, mis. `https://link.domainmu.id` (dipakai untuk QR & tautan bagikan) |
| `JWT_SECRET` | Rahasia sesi login (default: dibuat otomatis & disimpan di `data/db.json`) |
| `COOKIE_SECURE=1` | Aktifkan bila memakai HTTPS |
| `DATA_DIR` | Lokasi data (default `./data`) |

Contoh:
```bash
REGISTRATION_CODE=menujupusat PUBLIC_URL=https://link.contoh.id PORT=8080 npm start
```

## Deploy ke Railway
1. Push folder ini ke repositori GitHub (private).
2. Railway → **New Project → Deploy from GitHub repo** → pilih repo. `railway.json` sudah mengatur build, start, dan health check (`/healthz`).
3. **Wajib:** buat **Volume**, attach ke service, mount path `/data` (tanpa ini data hilang setiap deploy).
4. Variables: `REGISTRATION_CODE` (disarankan) dan `JWT_SECRET` (opsional). Jangan isi `PORT`.
5. Settings → Networking → **Generate Domain**, lalu Redeploy.
6. Cek `https://DOMAIN/healthz` → `{"ok":true,...}` dan log berisi `Folder data: /data`.

Panduan lengkap bergambar: `Panduan-Linkku.pdf`.

## Deploy singkat (VPS)
```bash
npm install --omit=dev
npm i -g pm2
REGISTRATION_CODE=menujupusat PUBLIC_URL=https://link.contoh.id pm2 start server.js --name linkku
```
Lalu arahkan Nginx (reverse proxy) ke port tersebut. Cadangkan folder `data/` (berisi `db.json` dan `uploads/`).

## Struktur
```
server.js          API, autentikasi, redirect klik, QR, halaman publik
lib/db.js          penyimpanan JSON (tulis atomik)
lib/meta.js        tema, font, ikon sosial, normalisasi URL
lib/render.js      render halaman publik /username
public/index.html  masuk & daftar
public/admin.*     editor (Tautan, Tampilan, Analitik, Pengaturan)
public/profile.*   gaya & skrip halaman publik
```
Catatan: penyimpanan berbasis file JSON cukup untuk puluhan–ratusan pengguna internal. Bila nanti perlu skala lebih besar, `lib/db.js` bisa diganti ke SQLite/PostgreSQL.
