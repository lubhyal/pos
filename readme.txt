Agar aplikasi Manajemen Stok ini bisa berjalan 24/7 di latar belakang server dan langsung otomatis jalan setiap kali komputer server dinyalakan (serta gampang diakses lewat HP/Laptop client), berikut panduan langkah-langkah dan persiapannya:

Catatan pembaruan (deploy):
- File halaman menu berada di `public\pages`. Saat menyalin/memperbarui aplikasi di server, salin seluruh folder `public` beserta subfoldernya, bukan hanya `index.html`.
- Fitur baru: menu "Barang Terlaris" (laporan per kelompok + export PDF) dan form tambah/edit barang yang diringkas (Rak/Warna/Ukuran otomatis 0).
- Mengubah kelompok barang saat edit akan mengganti Kode Barang (KdBar) dan ikut memperbarui tabel terkait (dbeli, djual, dpending, kstock, opname, rdbeli, pos_rdjual, tempdbeli, tempdjual). Proses ini tidak atomik (MyISAM), jadi sebaiknya backup database sebelum dipakai.
- Tidak ada perubahan skema database dan tidak ada dependency baru.
- Langkah update di server: salin `server.js`, folder `public`, `package.json`, `package-lock.json`, lalu jalankan `pm2 restart pos-server`. Jalankan `npm install` hanya jika folder `node_modules` belum ada.

1. Persiapan di PC Server
A. Install PM2 (Process Manager Node.js)
Gunakan PM2 agar aplikasi berjalan terus di background dan otomatis menyala (auto-restart) saat server reboot atau jika ada error tiba-tiba.

Buka Terminal / Command Prompt (run as Administrator) di PC Server.

Install PM2 secara global:

Bash
npm install -g pm2
npm install -g pm2-windows-startup
Daftarkan PM2 ke sistem startup Windows:

Bash
pm2-startup install
Masuk ke folder projek POS/Stok kamu (misal D:\pos):

Bash
cd D:\pos
Jalankan aplikasi menggunakan PM2:

Bash
pm2 start server.js --name "pos-server"
Simpan konfigurasi agar PM2 mengingat aplikasi ini setiap Windows dinyalakan:

Bash
pm2 save
Catatan: Setelah langkah di atas, server Node.js kamu sudah otomatis berjalan 24 jam di background tanpa perlu membuka layar VS Code / Terminal lagi.

B. Buat Shortcut di Desktop Server (Opsional / Akses Cepat)
Jika ingin membuat tombol pintas (shortcut) untuk memantau, merestart, atau mematikan server dengan sekali klik:

Klik kanan di Desktop PC Server → New → Shortcut.

Isikan lokasi perintah berikut:

Untuk Cek Status Server:

DOS
cmd.exe /k "pm2 status"
Untuk Restart Server:

DOS
cmd.exe /k "pm2 restart pos-server"
Beri nama shortcut (misal: Status Server POS / Restart Server POS) lalu klik Finish.

C. Buka Port 3000 di Windows Firewall Server
Agar HP/Laptop client di dalam jaringan WiFi/LAN yang sama bisa mengakses server, kamu harus mengizinkan lalu lintas Port 3000:

Buka Windows Defender Firewall di PC Server.

Klik Advanced settings di kolom sebelah kiri.

Klik Inbound Rules → Klik New Rule... di sebelah kanan.

Pilih Port → Klik Next.

Pilih TCP, lalu masukkan 3000 pada Specific local ports → Klik Next.

Pilih Allow the connection → Klik Next.

Centang Domain, Private, dan Public → Klik Next.

Beri nama NodeJS POS Port 3000 → Klik Finish.

D. Bikin IP Server Jadi Tetap (Static IP)
Agar alamat IP PC Server tidak berubah-ubah setiap kali router WiFi restart:

Di PC Server, tekan Win + R, ketik ncpa.cpl lalu Enter.

Klik kanan pada Koneksi LAN / WiFi Server → Properties.

Pilih Internet Protocol Version 4 (TCP/IPv4) → Klik Properties.

Set IP Server secara manual ke IP yang digunakan saat ini (misal 192.168.1.82).

2. Persiapan & Cara Akses di HP / Laptop Client
Di sisi perangkat client (HP, Tablet, atau Laptop kasir/karyawan), persiapannya sangat sederhana:

Koneksikan ke WiFi / Router yang Sama: Pastikan HP/Laptop client terhubung ke jaringan LAN/WiFi yang sama dengan PC Server.

Buka Browser (Chrome / Edge / Safari) di HP atau Laptop.

Ketikkan alamat IP Server beserta port-nya di URL bar:

Plaintext
http://192.168.1.82:3000
Bikin Shortcut di HP / Laptop Client (Biar Seperti Aplikasi Native):

Di HP Android/iOS (Chrome/Safari):
Buka webnya → Klik ikon titik tiga (di kanan atas) → Pilih "Tambahkan ke Layar Utama" (Add to Home Screen).

Di Laptop Client (Chrome/Edge):
Buka webnya → Klik titik tiga → Save and share / More tools → Create shortcut... (centang Open as window).

Sekarang, aplikasi sudah berjalan 24/7 di server dan semua perangkat client tinggal klik icon di layar utama tanpa perlu ribet urusan koding lagi.