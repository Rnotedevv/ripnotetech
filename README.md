# Telegram Auto Store - Supabase + Vercel + Payment Gateway Modular

Starter kit ini dibuat untuk kebutuhan auto store Telegram dengan fitur:

- menu utama bot yang bisa diedit dari `/dashboard`
- tombol menu user: beli qty, deposit, cek stok, list product, garansi, saldo
- panel admin tersembunyi dari user biasa
- bulk upload item digital (email, akun, lisensi, dan lain-lain)
- note delivery per produk
- harga bertingkat per qty
- deposit saldo + webhook payment gateway
- log aktivitas user ke grup admin
- command admin di bot: `/dashboard`, `/stats`, `/pendingdeposits`, `/addsaldo`, `/hapussaldo`
- dashboard web aesthetic untuk produk, stok, saldo, deposit, dan broadcast
- total user dan total transaksi di dashboard
- mode broadcast batch

## Stack

- **Next.js App Router** untuk dashboard web + API route webhook
- **Supabase Postgres** untuk database utama
- **Telegram Bot API** via webhook
- **Vercel** untuk hosting
- **Payment provider modular**: sekarang ada `dummy` dan contoh adapter `pakasir`

---

## Struktur penting

```bash
app/
  api/
    telegram/webhook/route.js
    telegram/set-webhook/route.js
    payment/webhook/route.js
    products/route.js
    inventory/route.js
    users/route.js
    deposits/route.js
    broadcast/dispatch/route.js
  dashboard/
    page.js
    products/page.js
    inventory/page.js
    users/page.js
    deposits/page.js
    broadcast/page.js
lib/
  bot/handlers.js
  db.js
  telegram.js
  payment/
    index.js
    providers/
      dummy.js
      pakasir.js
supabase/
  schema.sql
```

---

## 1. Buat bot Telegram

1. Buka `@BotFather`
2. Jalankan `/newbot`
3. Ambil token bot
4. Simpan ke `.env` pada `TELEGRAM_BOT_TOKEN`

Untuk mengetahui admin Telegram ID, kamu bisa pakai bot seperti `@userinfobot` atau bot sejenis.

---

## 2. Siapkan Supabase

1. Buat project di Supabase
2. Buka **SQL Editor**
3. Jalankan isi file `supabase/schema.sql`
4. Ambil:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

> Dashboard ini memakai service role **hanya di server**. Jangan pernah expose key ini ke frontend publik.

---

## 3. Isi environment

Copy `.env.example` menjadi `.env.local` saat lokal.

```env
APP_URL=https://your-domain.vercel.app
TELEGRAM_BOT_TOKEN=isi_token_bot_dari_botfather
TELEGRAM_WEBHOOK_SECRET=rahasia_webhook_telegram
ADMIN_TELEGRAM_IDS=123456789,987654321
ADMIN_GROUP_CHAT_ID=-1001234567890
DASHBOARD_EMAIL=admin@example.com
DASHBOARD_PASSWORD=superpasswordkuat
DASHBOARD_SECRET=ubah_dengan_random_string_panjang
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key
PAYMENT_PROVIDER=dummy
PAYMENT_API_BASE_URL=https://payment.example.com
PAYMENT_API_KEY=isi_api_key_pakasir
PAYMENT_WEBHOOK_SECRET=isi_signature_secret_jika_ada
DEFAULT_CURRENCY=IDR
DEFAULT_MIN_DEPOSIT=10000
```

Keterangan:

- `ADMIN_TELEGRAM_IDS`: admin bot yang boleh memakai command admin
- `ADMIN_GROUP_CHAT_ID`: semua log user akan dikirim ke grup ini
- `DASHBOARD_EMAIL`, `DASHBOARD_PASSWORD`: login dashboard web
- `PAYMENT_PROVIDER`: set `dummy` untuk tes manual, ganti ke `pakasir` setelah mapping API selesai

---

## 4. Jalankan lokal

```bash
npm install
npm run dev
```

Buka:

```bash
http://localhost:3000/login
```

---

## 5. Deploy ke Vercel

1. Push project ke GitHub
2. Import repository ke Vercel
3. Isi semua environment variables di Project Settings
4. Deploy
5. Setelah live, login ke dashboard dan klik **Set Telegram Webhook**

Webhook Telegram akan diarahkan ke:

```bash
https://domain-kamu.vercel.app/api/telegram/webhook
```

---

## 6. Flow bot user

### Menu user

- **Beli Qty** -> tampil list produk -> pilih produk -> input qty -> confirm -> saldo terpotong -> item dikirim otomatis
- **Deposit** -> user input nominal -> bot buat invoice/QR -> saat paid saldo user bertambah
- **Cek Stok** -> tampil stok semua produk
- **List Product** -> tampil nomor produk dan stok
- **Garansi** -> user paste email bermasalah -> request diteruskan ke admin group
- **Saldo Saya** -> tampil saldo user

### Menu admin di bot

- hidden dari user biasa
- admin dapat tombol `🧰 Admin`
- command admin:
  - `/dashboard`
  - `/stats`
  - `/pendingdeposits`
  - `/addsaldo @username 50000`
  - `/hapussaldo @username 50000`

---

## 7. Cara input produk dan stok

### Tambah produk

Masuk ke `/dashboard/products`

Isi:
- kode produk
- nama produk
- deskripsi
- note delivery

**Note delivery** akan dikirim di atas item stok saat pembelian sukses.

Contoh note delivery:

```text
Password panel domain: abc123
Login webmail: https://mail.domain.com
Catatan: jangan ganti MX record.
```

### Atur harga tier per qty

Contoh tier:

- min 1, max 4, harga 5000
- min 5, max 9, harga 4500
- min 10, max kosong, harga 4000

Artinya kalau user beli 10 item, harga per item jadi 4000.

### Bulk upload stok

Masuk ke `/dashboard/inventory`

Paste satu item per baris:

```text
mail1@domain.com
mail2@domain.com
mail3@domain.com
```

Kalau user beli qty 3, sistem akan ambil 3 baris stok terlama yang masih `available`.

---

## 8. Payment gateway

## Mode awal: `dummy`

Kalau `PAYMENT_PROVIDER=dummy`:
- bot tetap bisa membuat deposit
- status deposit bisa di-**Mark Paid** manual dari `/dashboard/deposits`
- cocok untuk ngetes bot sebelum payment live

## Mode production: `pakasir`

Adapter ada di:

```bash
lib/payment/providers/pakasir.js
```

Di file itu sudah saya siapkan 2 bagian penting:

1. `createPayment(...)`
2. `normalizeWebhook(...)`

Kalau format API Pakasir berbeda, kamu tinggal mapping field di file itu.

### Yang biasanya perlu kamu sesuaikan

- endpoint create invoice
- header authorization
- field response `reference`
- field response `qr_string` / `qr_url` / `pay_url`
- field webhook `status`
- field webhook `amount`
- verifikasi signature webhook

### Alur payment yang dipakai project ini

1. user pilih menu deposit
2. bot minta nominal
3. server panggil provider payment
4. data deposit disimpan di tabel `deposits`
5. provider kirim webhook ke `/api/payment/webhook`
6. saldo user otomatis bertambah lewat function database `confirm_deposit(...)`
7. user dan grup admin dapat notifikasi

---

## 9. Dashboard pages

### `/dashboard`
- KPI utama
- edit tampilan menu utama bot
- recent order
- recent activity
- quick actions

### `/dashboard/products`
- tambah produk
- set harga tier
- aktif/nonaktif produk
- lihat stok per produk

### `/dashboard/inventory`
- bulk upload stok item digital

### `/dashboard/users`
- list user
- adjust saldo manual

### `/dashboard/deposits`
- lihat semua deposit
- mark paid manual

### `/dashboard/broadcast`
- queue broadcast
- kirim batch 200 user per klik

---

## 10. Broadcast

Broadcast memakai tabel `broadcast_jobs`.

Flow:
- buat message di dashboard
- klik **Queue Broadcast**
- klik **Proses Batch 200 User** untuk kirim 200 user berikutnya
- ulangi sampai status `done`

Ini sengaja dibuat manual batch supaya aman untuk serverless dan mudah dites.
Kalau nanti mau otomatis, kamu bisa pasang scheduler sendiri ke endpoint yang memanggil fungsi process batch.

---

## 11. Function database penting

Di `supabase/schema.sql` ada function inti:

- `get_unit_price(...)`
- `purchase_product(...)`
- `confirm_deposit(...)`
- `adjust_balance_by_username(...)`

### Kenapa function ini penting?

Karena pembelian dan deposit harus atomik:
- saldo user tidak boleh double potong
- stok tidak boleh double terkirim
- deposit tidak boleh double masuk

Makanya proses kritikal dipindah ke SQL function supaya lebih aman.

---

## 12. Alur garansi

1. user klik menu **Garansi**
2. bot minta email bermasalah
3. email disimpan ke tabel `warranty_requests`
4. grup admin menerima notifikasi lengkap:
   - nama user
   - username
   - email bermasalah

Kalau nanti kamu mau, flow ini bisa ditambah status resolve/reject di dashboard.

---

## 13. Tips produksi

- pakai domain HTTPS
- ganti semua secret dengan value random panjang
- jangan expose `SUPABASE_SERVICE_ROLE_KEY`
- whitelist admin IDs dengan benar
- tes webhook Telegram dan payment di environment sandbox dulu
- isi `ADMIN_GROUP_CHAT_ID` dengan grup admin yang bot-nya sudah join

---

## 14. Next improvement yang mudah ditambah

Kalau kamu mau upgrade versi berikutnya, yang paling enak ditambah:

- upload bukti transfer manual
- dashboard resolve garansi
- kategori produk
- pagination product di bot
- history order user di bot
- export CSV transaksi
- rate limit dan anti spam
- scheduler otomatis untuk broadcast batch

---

## 15. Command ringkas admin di grup

```text
/dashboard
/stats
/pendingdeposits
/addsaldo @username 50000 bonus event
/hapussaldo @username 15000 koreksi saldo
```

---

## 16. Checklist go-live

- [ ] schema Supabase sudah dijalankan
- [ ] env Vercel sudah lengkap
- [ ] bot sudah join ke grup admin
- [ ] webhook Telegram sudah di-set
- [ ] adapter payment provider sudah dimapping
- [ ] test deposit sukses
- [ ] test pembelian sukses
- [ ] test garansi masuk ke grup
- [ ] test broadcast batch

---

Kalau nanti kamu mau, project ini paling enak dilanjutkan ke versi 2 dengan:

- login dashboard via Supabase Auth
- cron otomatis untuk broadcast
- resolve garansi dari dashboard
- invoice PDF / export laporan
- kategori dan gambar produk


## Konfigurasi Pakasir
Project ini sudah disesuaikan dengan alur resmi Pakasir:
- Create transaksi: `POST /api/transactioncreate/{method}`
- Webhook: isi ke `https://domainkamu.com/api/payment/webhook`
- Cek status: `GET /api/transactiondetail`
- Tombol bayar diarahkan ke URL Pakasir `https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}` dan otomatis menambahkan `qris_only=1` untuk mode QRIS.

Environment minimum:
- `PAYMENT_PROVIDER=pakasir`
- `PAKASIR_PROJECT_SLUG=ripnote`
- `PAKASIR_API_KEY=...`
- `PAKASIR_PAYMENT_METHOD=qris`

Catatan fee:
- Jika di dashboard Pakasir `Fee By Merchant = Tidak`, maka fee dibebankan ke buyer.
- Jika `Fee By Merchant = Ya`, maka fee dibebankan ke merchant.
