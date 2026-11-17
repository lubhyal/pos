# Changelog - Perbaikan Nota dan Print Barcode (40mm Support)

## Ringkasan Perubahan
Aplikasi POS sekarang mendukung ukuran kertas 40mm untuk cetak nota dan barcode, selain ukuran 58mm yang sudah ada.

## File yang Diubah

### 1. server.js
**Perubahan Backend:**
- ✅ Menambahkan function `ensureReceiptSizeColumn()` untuk auto-migration database
  - Kolom `ReceiptSize` akan dibuat otomatis jika belum ada
  - Default value: '58' (thermal printer)

- ✅ Update endpoint `GET /api/pengaturan`
  - Menambahkan field `ReceiptSize` ke response

- ✅ Update endpoint `PUT /api/pengaturan`
  - Menambahkan validasi untuk `ReceiptSize` (hanya accept '40' atau '58')
  - Menyimpan `ReceiptSize` ke database saat save settings

**Lokasi perubahan:**
- Line 2430: Memanggil `ensureReceiptSizeColumn()` di `startServer()`
- Line 1701: Menambahkan `ReceiptSize` ke GET SELECT
- Line 1713-1748: Menambahkan validasi dan penyimpanan `ReceiptSize` di PUT

### 2. public/index.html
**Perubahan Frontend (HTML & JavaScript):**

- ✅ Menambahkan konstanta `RECEIPT_SIZES`
  ```javascript
  const RECEIPT_SIZES = {
    '40': { page: 40, effective: 38, extra: 1 },
    '58': { page: 58, effective: 48, extra: 2 }
  };
  ```

- ✅ Menambahkan function `receiptSizeKey()` dan `getReceiptCSS(sizeKey)`
  - Membaca setting dari hidden input #receiptSize
  - Generate CSS dinamis berdasarkan ukuran yang dipilih
  - Menyesuaikan font size, logo width, dan layout

- ✅ Update function `renderReceipt()`
  - Menggunakan `receiptSizeKey()` untuk membaca setting
  - Menggunakan `getReceiptCSS()` untuk generate CSS yang sesuai
  - Pass widthMm dan extraMm yang tepat ke `printDocument()`

- ✅ Update function `loadSettings()`
  - Menambahkan `settingReceiptSize` dan `receiptSize` ke fields mapping
  - Load `ReceiptSize` dari database dengan default '58'

- ✅ Update function `saveSettings()`
  - Menambahkan `ReceiptSize` ke payload
  - Kirim nilai ke server

- ✅ Menambahkan hidden input `#receiptSize`
  - Menyimpan setting size yang digunakan untuk renderReceipt
  - Default: '58'

**Lokasi perubahan:**
- Line 2991-3026: Konstanta RECEIPT_SIZES dan fungsi receipt size
- Line 3027-3062: Update renderReceipt()
- Line 1712-1722: Update loadSettings()
- Line 1744-1751: Update saveSettings()
- Line 427: Hidden input receiptSize

### 3. public/pages/settings.html
**Perubahan Settings UI:**

- ✅ Menambahkan dropdown untuk "Ukuran kertas nota"
  ```html
  <select id="settingReceiptSize" class="form-select">
    <option value="58" selected>58 mm (thermal printer)</option>
    <option value="40">40 mm (label printer)</option>
  </select>
  ```

**Lokasi perubahan:**
- Line 17: Dropdown settingReceiptSize (setelah field settingQty)

## Feature yang Sudah Ada (No Change Needed)

### Barcode Printing
✅ Sudah support 40mm dan 58mm
- Dropdown #barcodeSize di modal "Print Barcode"
- BARCODE_SIZES constant dengan config untuk kedua ukuran
- CSS classes .s40 dan .s58 untuk styling
- Function `barcodeSizeKey()` untuk membaca setting dari dropdown

Tidak perlu perubahan karena sudah lengkap.

## Detail Penyesuaian untuk 40mm vs 58mm

### Nota Layout
| Aspek | 40mm | 58mm |
|-------|------|------|
| Page Width | 40mm | 58mm |
| Effective Width | 38mm | 48mm |
| Font Size | 7pt | 8.5pt |
| Business Name | 9pt | 11pt |
| Small Text | 6.5pt | 7.5pt |
| Total Font | 9pt | 11pt |
| Logo Max Width | 35mm | 40mm |
| Extra Margin | 1mm | 2mm |

### Barcode Label
| Aspek | 40mm | 58mm |
|-------|------|------|
| Label Width | 40mm | 48mm |
| Label Height | 20mm | 26mm |
| Barcode Height | 8mm | 11mm |
| Name Font | 6.5pt | 8.5pt |
| Number Font | 5.5pt | 7.5pt |
| Price Font | 8.5pt | 11pt |

## Proses Upgrade

### User yang Upgrade:
1. Server akan otomatis menambahkan kolom `ReceiptSize` ke database saat startup
2. Default value '58' untuk backward compatibility
3. User dengan role manager/admin dapat mengubah di Settings
4. Setting berlaku untuk semua user saat print nota

### Testing Checklist:
- [ ] Kolom ReceiptSize berhasil dibuat di database
- [ ] Setting dropdown muncul di halaman Pengaturan
- [ ] Setting dapat disimpan dengan baik
- [ ] Nota terbuka saat user memilih cetak nota
- [ ] Nota 40mm ter-format dengan benar (text pas di kertas)
- [ ] Nota 58mm tetap bekerja seperti sebelumnya (backward compatible)
- [ ] Barcode 40mm dan 58mm dapat dipilih
- [ ] Print barcode berfungsi untuk kedua ukuran

## Database Migration
Query yang akan dijalankan otomatis:
```sql
ALTER TABLE usaha ADD COLUMN ReceiptSize varchar(2) NOT NULL default '58'
```

## Backward Compatibility
✅ Sepenuhnya backward compatible:
- Default setting '58mm' untuk existing users
- Tidak mengubah logic cetak yang existing
- Hanya menambahkan fitur baru
- User yang tidak mengubah setting tetap cetak dengan 58mm seperti sebelumnya
