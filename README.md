# Point of Sales (POS) & Manajemen Stok

Aplikasi kasir dan manajemen stok berbasis web. Aplikasi dijalankan di PC server dan dapat diakses melalui browser dari perangkat lain di jaringan lokal.

## Fitur

- Pengelolaan data barang dan stok.
- Transaksi penjualan dan pembelian.
- Laporan penjualan, termasuk laporan **Barang Terlaris** per kelompok dan ekspor PDF.
- Form tambah dan edit barang yang diringkas.

## Persyaratan

- Windows PC untuk server.
- Node.js dan npm.
- MySQL yang dapat diakses oleh PC server.
- Database dan tabel aplikasi yang sudah tersedia.

> Konfigurasi koneksi database saat ini berada di `server.js`. Sesuaikan bagian `dbConfig` dengan server dan database yang digunakan sebelum menjalankan aplikasi. Jangan menyimpan atau membagikan kredensial database di repositori publik.

## Menjalankan aplikasi

Buka PowerShell atau Command Prompt, lalu jalankan:

```powershell
cd D:\pos
npm install
npm start
```

Secara default aplikasi berjalan pada port `3000`. Buka `http://localhost:3000` dari PC server untuk memastikan aplikasi dapat diakses.

Untuk menggunakan port lain, atur environment variable `PORT` sebelum menjalankan aplikasi.

## Rilis dan pembaruan

Folder [`server-deploy`](./server-deploy) adalah paket rilis siap salin. Salin **isi folder tersebut** ke folder aplikasi di PC server, termasuk seluruh folder `public` dan subfolder `public/pages`; jangan hanya menyalin `index.html`.

Setelah file diperbarui:

1. Jika dependensi belum tersedia di folder aplikasi server, jalankan `npm install`.
2. Jika aplikasi dijalankan dengan PM2, restart prosesnya:

   ```powershell
   pm2 restart pos-server
   ```

Rilis ini tidak menambahkan dependency atau perubahan skema database.

## Menjalankan terus-menerus dengan PM2 (Windows)

PM2 dapat menjaga aplikasi tetap berjalan dan memulihkannya setelah aplikasi berhenti. Jalankan perintah berikut di PC server:

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
cd D:\pos
pm2 start server.js --name "pos-server"
pm2 save
```

Perintah berguna:

```powershell
pm2 status
pm2 logs pos-server
pm2 restart pos-server
```

## Akses dari HP atau komputer lain

1. Hubungkan perangkat klien dan PC server ke jaringan Wi-Fi/LAN yang sama.
2. Izinkan koneksi masuk TCP pada port `3000` melalui Windows Firewall. Sebaiknya aktifkan hanya pada profil jaringan **Private** yang dipercaya.
3. Cari alamat IP lokal PC server, lalu buka alamat berikut dari browser perangkat klien:

   ```text
   http://ALAMAT-IP-SERVER:3000
   ```

   Contoh: `http://192.168.1.82:3000`

Untuk menghindari perubahan alamat IP server, atur DHCP reservation di router atau konfigurasi IP tetap sesuai pengaturan jaringan setempat.

### Menambahkan shortcut

- **Android/iPhone:** buka aplikasi di browser, lalu pilih **Tambahkan ke Layar Utama** / **Add to Home Screen**.
- **Chrome/Edge di komputer:** buka menu browser, lalu pilih opsi membuat shortcut atau memasang aplikasi jika tersedia.

## Catatan penting

- Sebelum mengubah kelompok barang saat mengedit barang, buat backup database. Perubahan ini mengganti `KdBar` dan memperbarui data terkait pada tabel `dbeli`, `djual`, `dpending`, `kstock`, `opname`, `rdbeli`, `pos_rdjual`, `tempdbeli`, dan `tempdjual`.
- Proses perubahan tersebut tidak atomik pada database MyISAM. Jika proses terhenti di tengah jalan, data dapat memerlukan pemulihan manual.
- Simpan file konfigurasi dan kredensial database dengan aman; jangan masukkan rahasia ke dalam commit atau rilis publik.
