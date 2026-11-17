# Quick Reference - Perubahan Kode

## 🎯 Tujuan
Menambahkan support ukuran kertas 40mm untuk cetak nota dan barcode (sebelumnya hanya 58mm).

## 📝 Perubahan Singkat

### 1. Database (Otomatis saat startup)
```sql
-- Kolom baru akan ditambahkan otomatis ke tabel usaha:
ALTER TABLE usaha ADD COLUMN ReceiptSize varchar(2) NOT NULL default '58'
```

### 2. Backend (server.js)

**Tambahan Fungsi:**
```javascript
async function ensureReceiptSizeColumn() {
  const found = await query("SHOW COLUMNS FROM usaha LIKE 'ReceiptSize'");
  if (!found.length) {
    await query("ALTER TABLE usaha ADD COLUMN ReceiptSize varchar(2) NOT NULL default '58'");
  }
}
```

**Panggil di startServer():**
```javascript
await ensureReceiptSizeColumn();
```

**GET /api/pengaturan:**
- Tambah `, ReceiptSize` ke SELECT query

**PUT /api/pengaturan:**
- Tambah validasi: `!['40', '58'].includes(receiptSize)`
- Tambah ke payload: `values.ReceiptSize = receiptSize`

### 3. Frontend (public/index.html)

**Tambahan Konstanta:**
```javascript
const RECEIPT_SIZES = {
  '40': { page: 40, effective: 38, extra: 1 },
  '58': { page: 58, effective: 48, extra: 2 }
};
```

**Fungsi Baru:**
```javascript
function receiptSizeKey() {
  return document.getElementById('receiptSize')?.value || '58';
}

function getReceiptCSS(sizeKey = '58') {
  const size = RECEIPT_SIZES[sizeKey];
  const fontSize = sizeKey === '40' ? '7pt' : '8.5pt';
  const nameFontSize = sizeKey === '40' ? '9pt' : '11pt';
  return `#printWrap{width:${size.effective}mm;...}...`;
}
```

**Update renderReceipt():**
```javascript
const sizeKey = receiptSizeKey();
const size = RECEIPT_SIZES[sizeKey];
printDocument({
  html,
  css: getReceiptCSS(sizeKey),
  widthMm: size.page,
  extraMm: size.extra
});
```

**Update loadSettings():**
- Add `settingReceiptSize: 'ReceiptSize'` dan `receiptSize: 'ReceiptSize'` to fields

**Update saveSettings():**
- Add `ReceiptSize: document.getElementById('settingReceiptSize').value || '58'` to payload

**Hidden Input (Di sekitar line 427):**
```html
<input type="hidden" id="receiptSize" value="58">
```

### 4. Settings UI (public/pages/settings.html)

**Tambah Dropdown (Setelah field settingQty):**
```html
<div class="col-md-4">
  <label class="form-label small" for="settingReceiptSize">Ukuran kertas nota</label>
  <select id="settingReceiptSize" class="form-select">
    <option value="58" selected>58 mm (thermal printer)</option>
    <option value="40">40 mm (label printer)</option>
  </select>
</div>
```

---

## 🔄 Flow Operasional

```
1. USER Opens App
   ↓
2. Server startup → ensureReceiptSizeColumn() berjalan
   ↓
3. Database: Check ReceiptSize column
   - Jika tidak ada → CREATE column (default '58')
   - Jika ada → skip
   ↓
4. Frontend loads → hidden input #receiptSize = '58' (default)
   ↓
5. Admin buka Pengaturan
   ↓
6. loadSettings() → GET /api/pengaturan
   - Fetch ReceiptSize dari DB
   - Set dropdown settingReceiptSize
   - Set hidden input receiptSize
   ↓
7. Admin ubah dropdown → pilih '40' atau '58'
   ↓
8. Admin click Simpan
   ↓
9. saveSettings() → PUT /api/pengaturan
   - Kirim ReceiptSize ke server
   - Server validasi & simpan ke DB
   ↓
10. Page refresh/reload
   ↓
11. loadSettings() ulang → hidden input receiptSize updated
   ↓
12. User print nota
   ↓
13. renderReceipt() berjalan
   - Baca receiptSize dari hidden input
   - Generate CSS dinamis via getReceiptCSS()
   - Render layout sesuai ukuran
   ↓
14. Print dialog muncul dengan ukuran yang benar
```

---

## ✅ Checklist Implementasi

- [x] Function ensureReceiptSizeColumn() dibuat
- [x] ensureReceiptSizeColumn() dipanggil di startServer()
- [x] GET /api/pengaturan include ReceiptSize
- [x] PUT /api/pengaturan include validasi & save ReceiptSize
- [x] RECEIPT_SIZES konstanta dibuat
- [x] receiptSizeKey() function dibuat
- [x] getReceiptCSS() function dibuat (dengan CSS dinamis)
- [x] renderReceipt() di-update
- [x] loadSettings() di-update
- [x] saveSettings() di-update
- [x] Hidden input #receiptSize dibuat
- [x] Dropdown settingReceiptSize di Settings UI
- [x] Syntax validated
- [x] Barcode feature sudah support (no change needed)
- [x] Backward compatible (default 58mm)

---

## 🧪 Quick Test

1. **Buka aplikasi** → cek console (tidak ada error)
2. **Login admin** → buka Settings
3. **Lihat dropdown "Ukuran kertas nota"** → harus ada
4. **Pilih "40 mm"** → click Simpan
5. **Refresh halaman** → buka Settings ulang
6. **Cek dropdown** → harus tetap "40 mm"
7. **Print nota** → lihat formatting untuk 40mm
8. **Ubah ke "58 mm"** → Simpan
9. **Print nota** → lihat formatting untuk 58mm

---

## 📊 Perbandingan Ukuran

| Aspek | 40mm | 58mm |
|-------|------|------|
| Lebar Kertas | 40mm | 58mm |
| Lebar Print | 38mm | 48mm |
| Font Utama | 7pt | 8.5pt |
| Nama Toko | 9pt | 11pt |
| Font Kecil | 6.5pt | 7.5pt |
| Total Font | 9pt | 11pt |
| Logo | 35mm max | 40mm max |

---

## 🎓 Konsep Kunci

1. **RECEIPT_SIZES** - Object yang menyimpan config ukuran
2. **receiptSizeKey()** - Baca setting dari HTML element
3. **getReceiptCSS()** - Generate CSS string dinamis
4. **renderReceipt()** - Gunakan setting untuk print
5. **loadSettings()** - Load dari DB ke HTML element
6. **saveSettings()** - Send HTML value ke DB

---

## ⚡ Performance Impact
- **Minimal** - Hanya menambahkan CSS conditional
- **Database** - 1 kolom baru, default value
- **Queries** - Tidak ada query tambahan (hanya read/write existing endpoint)

---

## 🔒 Security
- Validasi input (hanya '40' atau '58')
- Setting hanya untuk Admin/Manager
- Parameterized queries (no SQL injection)

---

**Siap Production ✅**
