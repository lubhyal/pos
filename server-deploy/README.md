# ABID KARYA SAYUR – Point of Sales (POS) & Manajemen Stok

Aplikasi kasir, stok, dan laporan berbasis web berbahasa Indonesia. Aplikasi dijalankan di satu PC server, lalu dapat dibuka lewat browser dari PC, tablet, atau HP di jaringan lokal (Wi-Fi/LAN). Tidak perlu memasang aplikasi di perangkat kasir.

## Keunggulan

- **Satu aplikasi untuk semuanya:** kasir, stok, pembelian, retur, piutang, laporan, dan manajemen user.
- **Ringan dan tanpa instalasi di klien:** cukup browser; bisa ditambahkan ke layar utama HP seperti aplikasi.
- **Tampilan modern:** gaya dashboard admin dengan tema gradient/glass, mode terang dan gelap, serta responsif untuk HP (tabel stok berubah menjadi kartu ringkas).
- **Kasir tidak terhambat stok:** barang dengan stok kosong tetap bisa dijual; stok tercatat minus sehingga selisih mudah ditelusuri.
- **Kontrol kasir yang jelas:** setiap kasir melaporkan uang real, selisih plus/minus dihitung otomatis dan dicatat.
- **Akses berdasarkan peran:** admin/bos, kasir, dan gudang hanya melihat menu sesuai tugasnya.
- **Laporan lengkap:** grafik, diagram, filter, tabel, dan ekspor CSV/PDF.
- **Kompatibel dengan database lama:** memakai tabel MySQL yang sudah ada (termasuk MySQL versi lama).

## Daftar fitur

### Dashboard (admin/bos)
Halaman awal berisi statistik penjualan, jumlah transaksi, ringkasan stok, grafik tren penjualan, barang terlaris, dan transaksi terakhir.

### Stok Barang
- Daftar barang dengan pencarian dan pagination.
- **Filter dan urutan per kolom:** nama A–Z/Z–A, stok 1–10/10–1, harga beli, harga jual, kelompok, dan lainnya.
- Tambah, ubah, hapus barang; impor/ekspor Excel (template tersedia).
- Stok minus ditampilkan jelas (warna merah).
- Di HP, tabel tampil sebagai kartu padat tanpa geser kiri-kanan.

### Kasir (penjualan)
- Cari barang berdasarkan nama, kode, atau barcode, lalu tambahkan ke keranjang.
- Diskon, pembayaran **tunai**, **kartu**, atau **kredit/piutang** (dengan uang muka).
- Transaksi **tertunda (pending)** dapat disimpan dan dilanjutkan nanti.
- Struk otomatis dicetak (dapat dimatikan di Pengaturan).
- Stok kosong tetap bisa di-checkout; stok menjadi minus.
- Pembatalan transaksi.

### Cetak ulang nota
- Di **Laporan Penjualan → tab Transaksi**, tombol **Nota** mencetak ulang struk transaksi mana pun (diberi tanda "CETAK ULANG").
- Di **Retur Jual**, riwayat retur menyediakan tombol **Nota** untuk mencetak ulang nota retur.

### Retur Jual
Pilih faktur asal, isi jumlah retur per barang (tidak boleh melebihi sisa), tentukan refund tunai. Stok bertambah kembali dan kas kasir terkoreksi. **Nota retur** langsung tercetak setelah disimpan.

### Pembelian dan Retur Beli
Catat pembelian dari supplier (stok dan harga beli ikut diperbarui), serta retur ke supplier.

### Stok Opname
Sesuaikan stok sistem dengan hasil hitung fisik; selisih dicatat di kartu stok.

### Piutang
Daftar piutang pelanggan/anggota dan pencatatan pembayaran cicilan.

### Laporan Penjualan (kasir dan admin)
- Filter tanggal, kasir (admin), dan tombol cepat Hari ini / 7 hari / Bulan ini.
- Kartu ringkasan: penjualan, rata-rata transaksi, diskon, transaksi batal, uang sistem, uang real, selisih.
- Tab **Ringkasan** (grafik per hari, per kasir, per jam, barang terlaris), **Transaksi** (cari, batalkan, cetak ulang nota, ekspor CSV), **Barang Terjual**, dan **Setoran & Selisih**.
- Kasir hanya melihat data miliknya sendiri.

### Setoran & Selisih Kasir
- Kasir mengisi **uang real** yang didapat untuk hari ini atau kemarin; sistem menghitung selisih (plus/minus) dan akumulasinya.
- Admin melihat semua kasir, dapat mengoreksi atau menghapus catatan. Laporan yang sudah dikoreksi admin tidak dapat diubah kasir.

### Laporan Lengkap (admin/bos)
Satu halaman berisi filter tanggal/kasir/kelompok, tab Ringkasan, Penjualan, Barang, Pembelian, Retur, Kas, dan Stok, lengkap dengan grafik, pencarian tabel, dan ekspor CSV.

### Manajemen User (admin/bos)
Tambah, ubah, ganti password, dan **hapus** user. Pencarian dan filter berdasarkan role. Sistem mencegah penghapusan akun sendiri dan admin terakhir.

### Data Master dan Pengaturan
Kelompok barang, supplier, anggota/pelanggan; profil usaha, header/footer struk, dan opsi cetak.

## Hak akses per role

| Role | Akses |
|------|-------|
| **admin / bos** | Semua menu: dashboard, laporan lengkap, user, data master, pengaturan, setoran semua kasir |
| **kasir** | Kasir, piutang, retur jual, laporan penjualan milik sendiri, lapor setoran sendiri |
| **gudang** | Stok barang, pembelian, retur beli, stok opname, supplier |

## Persyaratan

- Windows PC untuk server.
- Node.js dan npm.
- MySQL yang dapat diakses oleh PC server dengan database dan tabel aplikasi yang sudah tersedia. Tabel tambahan (`pos_auth`, `pos_setoran`, dan sejenisnya) dibuat otomatis saat server pertama kali berjalan.

> Konfigurasi koneksi database berada di `server.js` (`dbConfig`). Sesuaikan `host`, `user`, `password`, dan `database` sebelum menjalankan aplikasi. Jangan menyimpan atau membagikan kredensial database di repositori publik.

## Menjalankan aplikasi

```powershell
cd D:\pos
npm install
npm start
```

Aplikasi berjalan di port `3000` secara default. Buka `http://localhost:3000`. Untuk port lain, atur environment variable `PORT`.

### Login pertama
Jika belum ada user, aplikasi meminta pembuatan akun administrator pertama (memakai token setup yang tampil di jendela server). Setelah itu login dengan memilih user dan memasukkan password.

## Cara pakai harian

1. **Buka aplikasi** di browser, pilih user, masukkan password.
2. Admin: mulai dari **Dashboard** untuk melihat ringkasan; atur user, kelompok, dan barang lewat menu Administrasi/Stok.
3. Kasir: buka menu **Kasir** untuk bertransaksi.
4. Akhir hari: kasir melapor uang real di **Laporan Penjualan → Setoran & Selisih**. Admin memeriksa laporan.

## Cara transaksi (kasir)

1. Buka menu **Kasir**.
2. Cari barang (nama/kode/barcode) lalu klik untuk menambah ke keranjang; ubah jumlah bila perlu.
3. Isi diskon (jika ada) dan pilih pelanggan bila transaksi kredit.
4. Pilih pembayaran:
   - **Tunai:** isi uang diterima, kembalian dihitung otomatis.
   - **Kartu:** pilih kartu.
   - **Kredit:** isi uang muka; sisa menjadi piutang.
5. Selesaikan transaksi. Struk tercetak dan stok berkurang.
6. Pelanggan menunggu? Simpan sebagai **transaksi tertunda**, lanjutkan dari daftar tertunda.
7. Salah input? Batalkan lewat **Laporan Penjualan → Transaksi → Batal**.

## Cara retur penjualan

1. Buka **Retur Jual**, pilih faktur asal.
2. Isi jumlah barang yang diretur dan nominal refund tunai.
3. Klik **Simpan Retur**; nota retur tercetak. Cetak ulang kapan saja dari tabel riwayat.

## Cara mengisi setoran kasir

1. Buka **Laporan Penjualan → tab Setoran & Selisih**.
2. Pilih tanggal (hari ini/kemarin), hitung uang di laci, isi **Uang real**, tambahkan catatan jika perlu.
3. Klik **Kirim Laporan**. Selisih (plus/minus) dan akumulasinya tampil otomatis.

## Rilis dan pembaruan

Folder [`server-deploy`](./server-deploy) adalah paket rilis siap salin (`server-deploy.zip` berisi paket yang sama). Salin **isi folder tersebut** ke folder aplikasi di PC server, termasuk seluruh folder `public` dan subfolder `public/pages`; jangan hanya menyalin `index.html`.

Setelah file diperbarui:

1. Jalankan `npm install` jika dependensi belum ada.
2. Pastikan `dbConfig` di `server.js` server tujuan sesuai (paket rilis memakai host database server produksi).
3. Restart aplikasi. Dengan PM2: `pm2 restart pos-server`.
4. Di browser, tekan **Ctrl+F5** agar tampilan terbaru dimuat.

Perubahan versi ini: tabel `pos_setoran` dibuat otomatis saat server berjalan; tidak ada dependency baru. Menu "Barang Terlaris" digantikan oleh Laporan Penjualan/Laporan Lengkap.

## Menjalankan terus-menerus dengan PM2 (Windows)

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
cd D:\pos
pm2 start server.js --name "pos-server"
pm2 save
```

Perintah berguna: `pm2 status`, `pm2 logs pos-server`, `pm2 restart pos-server`.

## Akses dari HP atau komputer lain

1. Hubungkan perangkat klien dan PC server ke Wi-Fi/LAN yang sama.
2. Izinkan koneksi masuk TCP port `3000` di Windows Firewall (sebaiknya hanya profil jaringan **Private**).
3. Buka `http://ALAMAT-IP-SERVER:3000` di browser perangkat klien, misalnya `http://192.168.1.82:3000`.

Atur DHCP reservation di router atau IP tetap agar alamat server tidak berubah.

**Shortcut:** di Android/iPhone pilih **Tambahkan ke Layar Utama**; di Chrome/Edge komputer pilih opsi membuat shortcut/memasang aplikasi.

## Catatan penting

- Buat backup database sebelum mengubah kelompok barang saat mengedit barang. Perubahan ini mengganti `KdBar` dan memperbarui tabel terkait (`dbeli`, `djual`, `dpending`, `kstock`, `opname`, `rdbeli`, `pos_rdjual`, `tempdbeli`, `tempdjual`).
- Proses tersebut tidak atomik pada MyISAM; jika terhenti di tengah jalan, data dapat memerlukan pemulihan manual.
- Stok boleh minus karena penjualan tidak diblokir; lakukan stok opname secara berkala.
- Simpan kredensial database dengan aman; jangan masukkan rahasia ke commit atau rilis publik.
