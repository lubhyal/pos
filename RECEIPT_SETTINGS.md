# Pengaturan Ukuran Kertas Nota dan Barcode

## Perubahan yang Diterapkan

### 1. Support Ukuran Kertas Nota 40mm
Aplikasi POS sekarang mendukung dua ukuran kertas untuk cetak nota:

- **58mm** (Thermal Printer) - Ukuran standar, lebar efektif cetak 48mm
- **40mm** (Label Printer) - Ukuran label, lebar efektif cetak 38mm

### 2. Pengaturan di Menu Settings
1. Buka **Pengaturan**
2. Temukan field **"Ukuran kertas nota"**
3. Pilih ukuran yang sesuai dengan printer Anda:
   - Jika menggunakan thermal printer 58mm → pilih "58 mm (thermal printer)"
   - Jika menggunakan printer label 40mm → pilih "40 mm (label printer)"
4. Klik **Simpan Pengaturan**

### 3. Fitur Barcode
- Barcode support ukuran 40mm dan 58mm
- Pilih ukuran saat akan print barcode di modal "Print Barcode"
- Untuk 40mm: Label 40 x 20 mm
- Untuk 58mm: Printer thermal 58mm (label 48 x 26 mm)

### 4. Penyesuaian Otomatis
Ketika Anda memilih ukuran kertas:
- Font size akan menyesuaikan (lebih kecil untuk 40mm)
- Logo akan di-resize otomatis
- Layout akan ter-optimize untuk lebar kertas yang dipilih

## Catatan Penting

### Untuk Print Nota 40mm:
- Ukuran kertas efektif: 38mm (lebar cetak)
- Font lebih kecil agar muat di kertas yang lebih sempit
- Logo akan dikurangi ukurannya (max 35mm)

### Untuk Print Nota 58mm (Default):
- Ukuran kertas efektif: 48mm (lebar cetak)
- Font standar (seperti sebelumnya)
- Logo max 40mm

### Tip Printing di Chrome:
1. Buka print dialog (Ctrl+P)
2. Pilih printer (Iware atau printer thermal Anda)
3. Atur ukuran kertas sesuai setting:
   - Untuk 40mm: Custom 40mm x 20mm
   - Untuk 58mm: Custom 58mm x 26mm (atau Thermal 58mm)
4. Margin: None
5. Skala: 100%
6. Matikan: Headers dan Footers
7. Klik Print

## Database Migration
Kolom `ReceiptSize` akan otomatis ditambahkan ke tabel `usaha` saat aplikasi pertama kali dijalankan setelah update ini.

Default value: '58' (menggunakan ukuran 58mm)

## Troubleshooting

**Masalah: Nota terpotong atau terlalu kecil**
- Pastikan Anda memilih ukuran kertas yang benar di settings
- Reload halaman (F5) setelah mengubah setting
- Cek setting print di Chrome

**Masalah: Barcode tidak tercetak**
- Pastikan JsBarcode library ter-load (lihat console browser)
- Butuh koneksi internet untuk pertama kali load library
- Pilih ukuran kertas yang sesuai dengan printer barcode Anda

**Masalah: Setting tidak tersimpan**
- Login dengan akun Manager/Admin
- Refresh halaman setelah save
- Cek koneksi internet
