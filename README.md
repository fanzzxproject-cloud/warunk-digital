# Warunk Digital: Menu & Order Setup

Aplikasi ini menggunakan **Supabase** sebagai backend. Ikuti langkah-langkah berikut untuk mengatur database Anda:

## 1. Persiapan Supabase
1. Buat proyek baru di [Supabase](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase Anda.
3. Salin isi dari file `SCHEMA.sql` dan jalankan di SQL Editor untuk membuat tabel yang diperlukan.

## 2. Pengaturan Environment
1. Dapatkan **Supabase URL** dan **Anon Key** dari menu `Project Settings > API`.
2. Masukkan nilai tersebut ke dalam variable secret di AI Studio:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 3. Akun Admin
1. Buka menu **Authentication** di Supabase.
2. Tambahkan user baru (email & password) yang akan Anda gunakan untuk login sebagai Admin.

## 4. Akses Admin Panel
Tambahkan parameter `?mode=admin` pada URL aplikasi Anda untuk masuk ke Admin Panel.
Contoh: `https://...cloudrun.app/?mode=admin`

## Fitur Unggulan
- **Menu Digital**: Browse by category & search.
- **Real-time Orders**: Admin mendapat notifikasi instan saat ada pesanan baru.
- **Admin Panel**: Kelola stok, harga, dan lihat statistik penjualan.
- **Export Excel**: Download histori transaksi untuk laporan.
- **QRIS Ready**: Integrasi payload QRIS untuk pembayaran digital.
