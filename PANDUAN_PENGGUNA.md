# 📖 PANDUAN PENGGUNA - Cetak Nota dan Barcode 40mm

## Untuk Siapa?
Panduan ini untuk pengguna aplikasi POS yang ingin:
- ✅ Cetak nota dengan kertas 40mm (label printer)
- ✅ Cetak nota dengan kertas 58mm (thermal printer)
- ✅ Cetak barcode dengan dua ukuran

---

## 🎯 SETUP AWAL (Untuk Admin/Manager)

### Langkah 1: Buka Pengaturan
1. Login dengan akun **Admin** atau **Manager**
2. Di sidebar kiri, scroll ke bagian **ADMINISTRASI**
3. Klik **Pengaturan** (icon gear ⚙️)

### Langkah 2: Cari dan Set Ukuran Kertas
1. Scroll down di halaman Pengaturan
2. Temukan field **"Ukuran kertas nota"** (setelah field "Baris item struk")
3. Ada dropdown dengan 2 pilihan:
   - **58 mm (thermal printer)** - Untuk printer thermal standar
   - **40 mm (label printer)** - Untuk printer label 40mm
4. Pilih sesuai dengan printer yang Anda gunakan

### Langkah 3: Simpan Pengaturan
1. Scroll ke bawah
2. Klik tombol **"Simpan Pengaturan"** (warna hijau)
3. Tunggu sampai ada konfirmasi "Pengaturan usaha disimpan"

✅ **Selesai!** Setting telah disimpan ke sistem.

---

## 📝 CETAK NOTA

### Normal (Saat Transaksi)
1. Lakukan transaksi penjualan seperti biasa
2. Saat checkout, akan ada tombol **"Cetak"** untuk struk
3. Klik tombol Cetak
4. Dialog print akan terbuka di Chrome

### Cetak Ulang Nota
1. Buka menu **"Laporan Penjualan"** atau **"Retur Jual"**
2. Cari transaksi yang ingin dicetak ulang
3. Klik icon **Printer** (🖨️) di baris transaksi
4. Dialog print akan terbuka

### Setting Print di Chrome
Setelah klik Cetak, ikuti langkah ini:

**Untuk Kertas 40mm:**
1. Di dialog "Print", pilih printer Anda
2. Klik **"More settings"** atau icon ⚙️
3. **Paper size** → Pilih "Custom" atau "40mm x 20mm"
4. **Margins** → Pilih "None"
5. **Scale** → 100%
6. Pastikan **Header and footers** tidak ter-centang (unchecked)
7. Klik **Print**

**Untuk Kertas 58mm:**
1. Di dialog "Print", pilih printer Anda
2. Klik **"More settings"** atau icon ⚙️
3. **Paper size** → Pilih "Custom" atau "58mm x 26mm"
4. **Margins** → Pilih "None"
5. **Scale** → 100%
6. Pastikan **Header and footers** tidak ter-centang
7. Klik **Print**

---

## 🏷️ CETAK BARCODE

### Cara Cetak Barcode
1. Buka menu **"Stok Barang"**
2. Cari barang yang ingin di-print barcodenya
3. Di baris barang, klik icon **Barcode** (icon garis2)
4. Modal "Print Barcode" akan terbuka

### Di Modal Barcode
1. **"Ukuran kertas"** - Pilih ukuran:
   - **Label 40 x 20 mm** - Untuk label printer 40mm
   - **Printer thermal 58mm (label 48 x 26 mm)** - Untuk thermal printer
2. **"Jumlah label"** - Tentukan berapa lembar mau dicetak
3. Klik **"Cetak"** (tombol biru)
4. Dialog print akan terbuka

### Setting Print Barcode di Chrome
1. **Paper size** → Sesuai pilihan yang Anda ambil:
   - Untuk 40mm: Pilih "Custom 40mm x 20mm"
   - Untuk 58mm: Pilih "Custom 58mm x 26mm"
2. **Margins** → "None"
3. **Scale** → 100%
4. **Headers and footers** → Unchecked
5. Klik **Print**

---

## ⚠️ TROUBLESHOOTING

### Masalah 1: Nota Terpotong atau Terlalu Kecil
**Solusi:**
- Pastikan ukuran kertas yang dipilih di setting cocok dengan printer
- Cek lagi: Pengaturan → "Ukuran kertas nota"
- Refresh halaman (F5) sebelum print
- Di Chrome print dialog, pastikan ukuran kertas benar
- Scale harus 100% (bukan zoom)

### Masalah 2: Barcode Tidak Muncul
**Solusi:**
- Butuh koneksi internet untuk load barcode library (pertama kali)
- Cek di Chrome console (F12) apakah ada error
- Pastikan JavaScript enabled di browser
- Pilih ukuran kertas yang tepat saat print

### Masalah 3: Setting Tidak Tersimpan
**Solusi:**
- Pastikan login dengan akun Admin/Manager (ADMINISTRATOR atau MANAGER)
- Cek apakah ada error saat click Simpan
- Refresh halaman (F5) sebelum buka Pengaturan lagi
- Cek koneksi internet

### Masalah 4: Tulisan Terlalu Kecil di 40mm
**Solusi:**
- Ini normal untuk kertas 40mm (lebih sempit)
- Font sudah di-optimize untuk ukuran 40mm
- Jika masih susah dibaca, pertimbangkan gunakan 58mm

### Masalah 5: Ingin Kembali ke 58mm
**Solusi:**
- Buka Pengaturan
- "Ukuran kertas nota" → Pilih "58 mm (thermal printer)"
- Simpan
- Nota berikutnya akan print dengan 58mm

---

## 💡 TIPS & TRIK

### Tip 1: Print Multiple Copies
Saat print nota atau barcode, di Chrome dialog:
- **Copies** → Set ke jumlah yang diinginkan
- Klik Print

### Tip 2: Preview Sebelum Print
1. Di Chrome dialog, scroll atas
2. Lihat preview di sebelah kanan
3. Jika ukuran tidak pas, ubah paper size atau scale

### Tip 3: Printer Tidak Terbaca
Jika printer tidak muncul di Chrome:
1. Pastikan printer USB terhubung atau wifi tersambung
2. Install driver printer dari CD yang disertakan
3. Test print dari Windows Print Settings
4. Refresh halaman browser

### Tip 4: Setting Default untuk Semua User
Setting "Ukuran kertas nota" berlaku untuk SEMUA user:
- User lain tidak perlu set lagi
- Setting disimpan di database
- Jika diubah, berlaku untuk semua orang

---

## 📊 PERBANDINGAN 40mm vs 58mm

| Aspek | 40mm | 58mm |
|-------|------|------|
| Untuk Printer | Label printer | Thermal printer |
| Lebar Kertas | 40mm | 58mm |
| Teks | Lebih kecil | Normal |
| Logo | 35mm max | 40mm max |
| Detail | Ringkas | Lengkap |

---

## ✅ CHECKLIST SETUP

Setup Baru:
- [ ] Login dengan Admin/Manager
- [ ] Buka Pengaturan
- [ ] Set "Ukuran kertas nota" sesuai printer
- [ ] Klik Simpan Pengaturan
- [ ] Refresh halaman
- [ ] Test print nota
- [ ] Test print barcode

Pergantian Kertas:
- [ ] Buka Pengaturan
- [ ] Ubah "Ukuran kertas nota"
- [ ] Simpan
- [ ] Refresh
- [ ] Test print

---

## 📞 BANTUAN LEBIH LANJUT

Jika ada pertanyaan:
1. Baca dokumentasi di folder aplikasi
2. Hubungi Tim Support
3. Cek file berikut:
   - `IMPLEMENTATION_SUMMARY.md` - Info lengkap
   - `QUICK_REFERENCE.md` - Referensi cepat
   - `RECEIPT_SETTINGS.md` - User manual

---

## 🎓 FAQ (Pertanyaan Umum)

**Q: Apakah perlu setting lagi kalau print barcode?**
A: Tidak perlu untuk nota. Barcode punya setting sendiri di modal, bisa dipilih per transaksi.

**Q: Bisa print 40mm nota kalau printer tidak ada ukuran 40mm?**
A: Bisa, tapi teks akan ter-scale. Lebih baik punya printer 40mm atau buat custom size di driver printer.

**Q: Apakah setting 40mm mempengaruhi barcode?**
A: Tidak. Barcode punya setting terpisah, bisa pilih ukuran saat print.

**Q: Kalau setting error apa yang terjadi?**
A: Tidak ada, karena ada validasi. Hanya bisa pilih 40 atau 58.

**Q: Apakah perlu restart server?**
A: Tidak perlu. Setting otomatis ter-save dan ter-load.

---

**Good luck! 🎉**

*Untuk pertanyaan teknis, lihat IMPLEMENTATION_SUMMARY.md*
*Untuk referensi cepat, lihat QUICK_REFERENCE.md*
