# ABID KARYA SAYUR – Point of Sales (POS) & Manajemen Stok

Aplikasi kasir, stok, dan laporan berbasis web berbahasa Indonesia. Aplikasi dijalankan di satu PC server, lalu dapat dibuka lewat browser dari PC, tablet, atau HP di jaringan lokal (Wi-Fi/LAN). Tidak perlu memasang aplikasi di perangkat kasir.

## Keunggulan

- **Satu aplikasi untuk semuanya:** kasir, stok, pembelian, retur, piutang, laporan, dan manajemen user.
- **Ringan dan tanpa instalasi di klien:** cukup browser; bisa ditambahkan ke layar utama HP seperti aplikasi.
- **Tampilan modern:** gaya dashboard admin bernuansa hijau dan kuning dengan tema gradient/glass, mode terang dan gelap (kontras teks tabel disesuaikan), serta responsif untuk HP (semua tabel berubah menjadi kartu).
- **Cetak barcode dan nota ringkas:** label barcode 40x20 mm untuk printer thermal, dan nota compact yang tetap lengkap.
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
- Di HP, semua tabel tampil sebagai kartu tanpa geser kiri-kanan.
- **Print Barcode:** tombol **Barcode** di setiap baris stok membuka pratinjau label (kode barcode, nomor, nama barang, harga) dan jumlah label yang dicetak. Ukuran label 40x20 mm. Di dialog cetak browser pilih printer thermal, atur ukuran kertas 40x20 mm, margin **None**, dan skala 100%. Barcode memakai kolom Barcode barang (EAN-13 bila 13 digit valid, selain itu CODE128), atau kode barang bila kosong. Library barcode dimuat dari internet (CDN).

### Kasir (penjualan)
- Cari barang berdasarkan nama, kode, atau barcode, lalu tambahkan ke keranjang.
- Diskon dan pembayaran **Tunai**, **QRIS**, **Transfer**, atau **EDC**. Pembayaran non-tunai tidak menampilkan kolom uang diterima. Layar kasir dirancang tanpa mouse (scanner + keyboard, lihat Cara transaksi).
- Transaksi **tertunda (pending)** dapat disimpan dan dilanjutkan nanti.
- Struk otomatis dicetak (dapat dimatikan di Pengaturan). Nota berformat compact (80 mm): identitas usaha, faktur, tanggal, kasir, item satu baris, jumlah item, total, rincian pembayaran.
- Stok kosong tetap bisa di-checkout; stok menjadi minus.
- Pembatalan transaksi.

### Cetak ulang nota
- Di **Laporan Penjualan → tab Transaksi**, tombol **Nota** mencetak ulang struk transaksi mana pun (diberi tanda "CETAK ULANG").
- Di **Retur Jual**, riwayat retur menyediakan tombol **Nota** untuk mencetak ulang nota retur.

### Retur Jual
Pilih faktur asal, isi jumlah retur per barang (tidak boleh melebihi sisa), tentukan refund tunai. Stok bertambah kembali dan kas kasir terkoreksi. **Nota retur** langsung tercetak setelah disimpan.

### Pembelian dan Retur Beli
Catat pembelian dari supplier (stok dan harga beli ikut diperbarui), serta retur ke supplier. Pada form pembelian yang sama, **harga beli dan harga jual** dapat diisi/diubah per barang (margin ditampilkan, merah bila negatif); keduanya otomatis tersimpan ke data barang saat pembelian disimpan.

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

### Kas Awal (Uang Laci)
- Setiap hari, saat membuka menu Kasir, kasir wajib mengisi **kas awal** (uang modal di laci). Penjualan ditolak sebelum kas awal diisi.
- Kas awal masuk ke **Uang Sistem** dan tampil di kolom **Kas Awal** pada Setoran & Selisih. Ubah dengan tombol di strip atas kasir atau **F9**.
- Setelah ada transaksi hari itu, kas awal hanya dapat diubah admin.

### Admin Gudang Merangkap Kasir
Di Manajemen User, role **Admin Gudang** punya opsi **"Boleh juga menjadi kasir"**. Bila aktif, menu Kasir muncul dan kas awal serta setoran berlaku sama seperti kasir.

Saat server pertama kali dijalankan, tabel `pos_kasawal` dan kolom `CanCashier` pada `pos_auth` dibuat otomatis.

### Laporan Lengkap (admin/bos)
Satu halaman berisi filter tanggal/kasir/kelompok, tab Ringkasan, Penjualan, Barang, Pembelian, Retur, Kas, dan Stok, lengkap dengan grafik, pencarian tabel, dan ekspor CSV.

### Manajemen User (admin/bos)
Tambah, ubah, ganti password, dan **hapus** user. Pencarian dan filter berdasarkan role. Sistem mencegah penghapusan akun sendiri dan admin terakhir.

### Data Master dan Pengaturan
Kelompok barang, supplier, anggota/pelanggan; profil usaha, header/footer struk, dan opsi cetak. Di **Pengaturan** admin juga dapat mengunggah **logo toko** (PNG/JPG) yang otomatis diubah hitam-putih dan dicetak di atas nama toko pada nota. Logo disimpan di file `logo.dat` di folder aplikasi. Teks nota dicetak tebal agar jelas di printer thermal.

### Absensi Selfie, Shift, dan Penggajian
- **Satu akun untuk semua**: kasir, admin gudang, admin, atau bos yang juga karyawan cukup punya satu akun. Di Manajemen User aktifkan opsi **Ikut absensi & penggajian**; menu Absen, Shift, Slip Gaji, Kinerja, dan Kehadiran muncul di akun itu, dan user masuk daftar gaji. Role **Karyawan** dipakai untuk pegawai yang hanya absen.
- **Karyawan** (role `karyawan`) hanya melihat menu: Dashboard (grafik kehadiran), Absen, Shift Kerja, Slip Gaji (cetak/unduh PDF), Kinerja, dan Status Kehadiran.
- **Absen Masuk/Pulang** wajib foto selfie dari kamera. Waktu dicatat otomatis oleh server. Kamera langsung hanya jalan di `localhost`/HTTPS; di HTTP lewat LAN, tombol absen membuka kamera ponsel.
- **Foto harus menampilkan wajah**: sebelum dikirim, foto diperiksa deteksi wajah di browser. Tanpa wajah, absen ditolak. Detektor bawaan browser atau MediaPipe (dimuat dari internet). Bila detektor tidak bisa dimuat (offline), absen tetap diterima dengan peringatan "tidak diverifikasi".
- **Jam kerja 11 jam; shift malam 10 jam** (shift yang namanya mengandung "Malam"). Jam pulang dihitung otomatis dari jam masuk, dan server menolak jadwal dengan durasi lain. Preset: Pagi 07-18, Siang 12-23, Malam 20-06.
- **Foto otomatis dihapus** setelah 2 hari (ubah dengan variabel lingkungan `ABSEN_FOTO_HARI`). Jam masuk/pulang tetap tersimpan. Pembersihan berjalan saat server start dan setiap 1 jam.
- **Admin/bos**: menu *Pengaturan Shift* (bagikan jadwal ke banyak karyawan sekaligus per rentang tanggal/hari) dan *Penggajian & Absensi* (input gaji pokok, tunjangan, bonus, potongan; lihat slip; rekap absensi dan foto).
- **Telat otomatis**: dihitung sejak 5 menit sebelum jam masuk shift; setiap kelipatan 5 menit dipotong Rp 5.000.
- **Lembur otomatis**: setiap kelipatan 50 menit setelah jam pulang shift mendapat bonus Rp 10.000.
- Tabel `pos_jadwal`, `pos_absen`, `pos_gaji` dibuat otomatis saat server pertama kali dijalankan.

### Cetak Printer Thermal 58mm
Nota dan label barcode dicetak lewat jendela cetak terpisah dengan ukuran halaman tepat (area cetak 48mm), tanpa margin, sehingga tidak lagi menghasilkan kertas kosong panjang. Di dialog cetak pilih printer thermal, margin **None**, skala **100%**.

## Hak akses per role

| Role | Akses |
|------|-------|
| **admin / bos** | Semua menu: dashboard, laporan lengkap, user, data master, pengaturan, setoran semua kasir, shift, penggajian |
| **karyawan** | Absen selfie, shift kerja, slip gaji, kinerja, status kehadiran milik sendiri |
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

1. Buka menu **Kasir**. Kursor otomatis ada di kolom scan; semua bisa dilakukan hanya dengan scanner dan keyboard (tanpa mouse):
   - **Scan barcode** (atau ketik nama/kode) lalu **Enter** menambah barang. Untuk pencarian nama, **↑/↓** memilih hasil.
   - Dengan kolom scan kosong: **↑/↓** memilih baris keranjang, **+ / -** mengubah qty, **Del** menghapus baris.
   - **Alt+1 Tunai, Alt+2 QRIS, Alt+3 Transfer, Alt+4 EDC.**
   - **Enter** pada kolom scan kosong = bayar. Tunai: kolom uang diterima terisi total (Enter = uang pas, atau ketik nominal lalu Enter). Non-tunai: transaksi langsung diselesaikan, tanpa kolom uang diterima.
   - **F2** tunda transaksi, **F4** panggil tertunda, **Ctrl+Del** kosongkan keranjang, **Esc** kembali ke kolom scan.
2. Kembalian tampil besar di panel pembayaran dan kolom scan siap untuk pelanggan berikutnya.
3. Isi diskon atau pilih anggota bila perlu (opsional).
4. Metode pembayaran: **Tunai, QRIS, Transfer, EDC**.
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
