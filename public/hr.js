// Frontend absensi selfie, shift, kinerja, slip gaji (Karyawan) dan pengaturan shift/penggajian (Admin & Bos).
// Dimuat setelah script utama di index.html; memakai showView, dashChart, formatRupiah, escapeHtml, printDocument, dll.

const HR_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HR_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let hrView = '';
let empMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
let empData = null;
let absenStream = null;
let absenClockTimer = null;
let absenBusy = false;
let hrAdminReady = false;
let payReady = false;
let hrUsers = [];
window.empSlip = null;
window.adminSlip = null;

const hrEl = id => document.getElementById(id);
const hrSet = (id, text) => { const e = hrEl(id); if (e) e.textContent = text; };
const hrToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hrMonthLabel = periode => `${HR_MONTHS[Number(periode.slice(5, 7)) - 1]} ${periode.slice(0, 4)}`;
const hrDayName = tgl => HR_DAYS[new Date(tgl + 'T00:00:00Z').getUTCDay()];
const hrDateLabel = tgl => `${tgl.slice(8, 10)}/${tgl.slice(5, 7)}/${tgl.slice(0, 4)}`;
const hrClock = dt => (dt ? dt.slice(11, 16) : '-');
function hrDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return m >= 60 ? `${Math.floor(m / 60)} j ${m % 60} m` : `${m} m`;
}

async function hrJson(url, options = {}) {
  const init = { ...options };
  if (init.body && typeof init.body !== 'string') {
    init.headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch(url, init);
  let result = null;
  try { result = await response.json(); } catch (e) { /* respons bukan JSON */ }
  if (!response.ok || !result || !result.success) throw new Error((result && result.message) || `Permintaan gagal (HTTP ${response.status}).`);
  return result;
}

function hrStatusBadge(status) {
  const tone = status === 'Telat' ? 'warning' : status === 'Tepat waktu' ? 'success' : 'secondary';
  return `<span class="badge text-bg-${tone}">${escapeHtml(status)}</span>`;
}

// ===== Pengait ke aplikasi utama =====
const hrOriginalShowView = showView;
showView = function (viewId) {
  hrOriginalShowView(viewId);
  hrView = viewId;
  if (viewId !== 'absenView') { stopAbsenCamera(); clearInterval(absenClockTimer); absenClockTimer = null; }
  const hooks = {
    empDashView: loadEmployeeData, absenView: openAbsenView, kinerjaView: loadEmployeeData, hadirView: loadEmployeeData,
    shiftView: loadShiftSaya, slipView: loadSlipSaya, shiftAdminView: initShiftAdmin, payrollView: initPayroll
  };
  if (hooks[viewId]) hooks[viewId]();
};

const hrOriginalLogout = logoutUser;
logoutUser = async function () {
  stopAbsenCamera();
  clearInterval(absenClockTimer);
  absenClockTimer = null;
  empData = null;
  return hrOriginalLogout();
};

const hrOriginalLoadMenuViews = loadMenuViews;
loadMenuViews = async function () {
  await hrOriginalLoadMenuViews();
  document.querySelectorAll('.hr-modal').forEach(modal => document.body.appendChild(modal));
  document.querySelectorAll('.emp-month').forEach(input => {
    input.value = empMonth;
    input.addEventListener('change', () => {
      if (!/^\d{4}-\d{2}$/.test(input.value)) return;
      empMonth = input.value;
      document.querySelectorAll('.emp-month').forEach(other => { other.value = empMonth; });
      const reload = { empDashView: loadEmployeeData, kinerjaView: loadEmployeeData, hadirView: loadEmployeeData, shiftView: loadShiftSaya, slipView: loadSlipSaya }[hrView];
      if (reload) reload();
    });
  });
  hrEl('shiftForm').addEventListener('submit', saveShiftForm);
  hrEl('gajiForm').addEventListener('submit', saveGajiForm);
  hrEl('shiftFilterUser').addEventListener('change', loadShiftAdmin);
  hrEl('shiftFilterMonth').addEventListener('change', loadShiftAdmin);
  hrEl('payMonth').addEventListener('change', loadPayroll);
  hrEl('absenFile').addEventListener('change', () => { /* ditangani oleh pickPhotoFile */ });
};

// ===== Karyawan: data & dashboard =====
async function loadEmployeeData() {
  if (!currentUser || !(currentUser.Role === 'karyawan' || currentUser.IsKaryawan === 'Y')) return;
  try {
    empData = await hrJson(`/api/karyawan/ringkasan?bulan=${encodeURIComponent(empMonth)}`);
    renderEmpDash();
    renderAbsenToday();
    renderKinerja();
    renderHadir();
  } catch (err) {
    console.error('Gagal memuat data karyawan:', err);
    const box = hrEl('absenTodayBox');
    if (box) box.textContent = err.message;
  }
}

function hrChartOptions(extra = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartTextColor() } } },
    ...extra
  };
}
const hrScales = () => ({
  x: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
  y: { beginAtZero: true, ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } }
});

function renderEmpDash() {
  if (!empData) return;
  const s = empData.summary;
  const now = new Date();
  const hour = now.getHours();
  hrSet('empGreeting', `${hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'}, ${currentUser.Nmuser}`);
  hrSet('empDate', now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  hrSet('empKpiHadir', `${s.hadir} hari`);
  hrSet('empKpiHadirSub', `${s.tepatWaktu} tepat waktu · jadwal ${s.hariJadwal} hari`);
  hrSet('empKpiTelat', `${s.telat} kali`);
  hrSet('empKpiTelatSub', s.potonganTelat ? `Potongan ${formatRupiah(s.potonganTelat)}` : 'Tidak ada potongan');
  hrSet('empKpiLembur', hrDuration(s.lemburMenit));
  hrSet('empKpiLemburSub', s.bonusLembur ? `Bonus ${formatRupiah(s.bonusLembur)}` : `${empData.aturan.lemburKelipatanMenit} mnt = ${formatRupiah(empData.aturan.lemburBonus)}`);
  hrSet('empKpiPersen', s.persenKehadiran === null ? '-' : `${s.persenKehadiran}%`);
  hrSet('empKpiPersenSub', `${s.alpha} hari tidak hadir`);
  const t = empData.todayRecord;
  hrSet('empTodayText', empData.state === 'belum'
    ? (empData.shiftToday ? `Belum absen · shift ${empData.shiftToday.Mulai.slice(0, 5)}-${empData.shiftToday.Selesai.slice(0, 5)}` : 'Belum absen · tidak ada shift terjadwal')
    : `Masuk ${hrClock(t.JamMasuk)}${t.JamPulang ? ` · Pulang ${hrClock(t.JamPulang)}` : ' · sedang bekerja'} (${t.Status})`);

  dashChart('empChartHadir', {
    type: 'doughnut',
    data: { labels: ['Tepat waktu', 'Telat', 'Tidak hadir'], datasets: [{ data: [s.tepatWaktu + (s.hadir - s.tepatWaktu - s.telat), s.telat, s.alpha], backgroundColor: ['#16a34a', '#facc15', '#ef4444'], borderWidth: 0 }] },
    options: hrChartOptions({ cutout: '62%' })
  });
  const days = empData.records;
  dashChart('empChartJam', {
    data: {
      labels: days.map(r => r.Tgl.slice(8, 10)),
      datasets: [
        { type: 'bar', label: 'Jam kerja', data: days.map(r => Math.round((r.JamKerjaMenit || 0) / 6) / 10), backgroundColor: '#16a34a', borderRadius: 4 },
        { type: 'line', label: 'Lembur (jam)', data: days.map(r => Math.round(r.LemburMenit / 6) / 10), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: .3 }
      ]
    },
    options: hrChartOptions({ scales: hrScales() })
  });
}

function renderKinerja() {
  if (!empData) return;
  const s = empData.summary;
  hrSet('kinTepat', s.persenTepatWaktu === null ? '-' : `${s.persenTepatWaktu}%`);
  hrSet('kinHadir', s.persenKehadiran === null ? '-' : `${s.persenKehadiran}%`);
  hrSet('kinJam', hrDuration(s.jamKerjaMenit));
  const done = empData.records.filter(r => r.JamKerjaMenit !== null).length;
  hrSet('kinRata', done ? hrDuration(s.jamKerjaMenit / done) : '-');
  dashChart('kinChartPersen', {
    type: 'bar',
    data: { labels: ['Kehadiran', 'Ketepatan waktu'], datasets: [{ label: '%', data: [s.persenKehadiran || 0, s.persenTepatWaktu || 0], backgroundColor: ['#16a34a', '#facc15'], borderRadius: 6 }] },
    options: hrChartOptions({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } }, y: { ticks: { color: chartTextColor() }, grid: { display: false } } } })
  });
  const withShift = empData.records.filter(r => r.SelisihMasuk !== null);
  dashChart('kinChartMasuk', {
    type: 'bar',
    data: { labels: withShift.map(r => r.Tgl.slice(8, 10)), datasets: [{ label: 'Menit vs jam masuk', data: withShift.map(r => r.SelisihMasuk), backgroundColor: withShift.map(r => (r.Status === 'Telat' ? '#f59e0b' : '#16a34a')), borderRadius: 4 }] },
    options: hrChartOptions({ plugins: { legend: { display: false } }, scales: { x: hrScales().x, y: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } } } })
  });
}

function renderHadir() {
  if (!empData) return;
  const s = empData.summary;
  hrSet('hdTepat', `${s.tepatWaktu + (s.hadir - s.tepatWaktu - s.telat)} hari`);
  hrSet('hdTelat', `${s.telat} hari`);
  hrSet('hdAlpha', `${s.alpha} hari`);
  hrSet('hdLembur', hrDuration(s.lemburMenit));
  hrSet('hdLemburSub', `Total lembur · ${s.lemburKelipatan}x kelipatan ${empData.aturan.lemburKelipatanMenit} mnt`);
  const body = hrEl('hdBody');
  body.replaceChildren();
  if (!empData.records.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 6; cell.className = 'text-center text-body-secondary py-3';
    cell.textContent = 'Belum ada data absensi pada bulan ini.';
    return;
  }
  [...empData.records].reverse().forEach(r => {
    const row = body.insertRow();
    row.insertCell().textContent = `${hrDayName(r.Tgl)}, ${hrDateLabel(r.Tgl)}`;
    row.insertCell().textContent = r.ShiftMulai ? `${r.ShiftMulai.slice(0, 5)}-${r.ShiftSelesai.slice(0, 5)}` : '-';
    row.insertCell().textContent = hrClock(r.JamMasuk);
    row.insertCell().textContent = r.JamPulang ? hrClock(r.JamPulang) : 'Belum pulang';
    row.insertCell().innerHTML = hrStatusBadge(r.Status);
    const lembur = row.insertCell();
    lembur.className = 'text-end';
    lembur.textContent = r.LemburMenit ? hrDuration(r.LemburMenit) : '-';
  });
}

// ===== Karyawan: absen selfie =====
function openAbsenView() {
  const tick = () => {
    const d = new Date();
    hrSet('absenClock', d.toLocaleTimeString('id-ID', { hour12: false }));
    hrSet('absenDateText', d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  };
  tick();
  clearInterval(absenClockTimer);
  absenClockTimer = setInterval(tick, 1000);
  loadEmployeeData();
  loadFaceDetector();
  startAbsenCamera();
}

function renderAbsenToday() {
  if (!empData || !hrEl('absenTodayBox')) return;
  const state = empData.state;
  const badge = hrEl('absenStateBadge');
  badge.textContent = state === 'belum' ? 'Belum absen' : state === 'masuk' ? 'Sedang bekerja' : 'Selesai hari ini';
  badge.className = `badge text-bg-${state === 'belum' ? 'secondary' : state === 'masuk' ? 'success' : 'primary'}`;
  hrEl('btnAbsenMasuk').disabled = absenBusy || state !== 'belum';
  hrEl('btnAbsenPulang').disabled = absenBusy || state !== 'masuk';
  const shift = empData.shiftToday;
  hrSet('absenShift', shift ? `Shift ${shift.Nama || ''} ${shift.Mulai.slice(0, 5)} - ${shift.Selesai.slice(0, 5)}` : 'Tidak ada shift terjadwal hari ini');
  hrSet('absenHint', `Wajah harus terlihat jelas. Waktu dicatat otomatis oleh server. Foto dihapus otomatis setelah ${empData.fotoRetensiHari} hari; jam absensi tetap tersimpan.`);
  const r = empData.todayRecord;
  const box = hrEl('absenTodayBox');
  if (!r) { box.innerHTML = '<div class="text-body-secondary">Belum ada absensi hari ini.</div>'; return; }
  const rows = [
    ['Absen masuk', hrClock(r.JamMasuk) + ' ' + hrStatusBadge(r.Status)],
    ['Absen pulang', r.JamPulang ? hrClock(r.JamPulang) : '<span class="text-body-secondary">Belum</span>'],
    ['Jam kerja', r.JamKerjaMenit !== null ? hrDuration(r.JamKerjaMenit) : '-'],
    ['Lembur', r.LemburMenit ? `${hrDuration(r.LemburMenit)} (bonus ${formatRupiah(r.BonusLembur)})` : '-'],
    ['Potongan telat', r.PotonganTelat ? formatRupiah(r.PotonganTelat) : '-']
  ];
  box.innerHTML = '<ul class="list-group list-group-flush">' + rows.map(([k, v]) => `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent px-0"><span class="text-body-secondary">${k}</span><span class="fw-semibold">${v}</span></li>`).join('') + '</ul>';
}

function hrAbsenMessage(text, tone) {
  const box = hrEl('absenMsg');
  box.textContent = text;
  box.className = `alert alert-${tone} py-2 mb-2`;
}

async function startAbsenCamera() {
  if (absenStream) return;
  const video = hrEl('absenVideo');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hrAbsenMessage('Kamera langsung tidak tersedia (butuh HTTPS atau localhost). Tombol absen akan membuka kamera ponsel untuk mengambil selfie.', 'warning');
    return;
  }
  try {
    absenStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = absenStream;
    await video.play();
    video.classList.remove('d-none');
    hrEl('absenPreview').classList.add('d-none');
    hrEl('absenPlaceholder').classList.add('d-none');
    hrEl('absenMsg').className = 'alert d-none py-2 mb-2';
    hrEl('btnCamera').classList.add('d-none');
  } catch (err) {
    absenStream = null;
    hrAbsenMessage(`Kamera tidak bisa dibuka (${err.name || 'error'}). Izinkan akses kamera di browser, atau gunakan tombol absen untuk mengambil foto lewat kamera ponsel.`, 'warning');
    hrEl('btnCamera').classList.remove('d-none');
  }
}

function stopAbsenCamera() {
  if (absenStream) absenStream.getTracks().forEach(track => track.stop());
  absenStream = null;
  const video = hrEl('absenVideo');
  if (video) { video.srcObject = null; video.classList.add('d-none'); }
  const placeholder = hrEl('absenPlaceholder');
  if (placeholder) placeholder.classList.remove('d-none');
  const button = hrEl('btnCamera');
  if (button) button.classList.remove('d-none');
}

// Gambar dikecilkan dan diberi cap waktu agar ringan (sekitar 30-60 KB) dan mudah divalidasi.
function imageToJpeg(source, width, height, jenis) {
  const canvas = hrEl('absenCanvas');
  const scale = Math.min(1, 480 / width);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const stamp = `${jenis} ${new Date().toLocaleString('id-ID')} - ${currentUser.Nmuser}`;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, canvas.height - 22, canvas.width, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.fillText(stamp, 6, canvas.height - 7);
  for (const quality of [0.6, 0.45, 0.3]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= 180000) return data;
  }
  throw new Error('Ukuran foto terlalu besar. Coba lagi dengan pencahayaan lebih baik.');
}

function pickPhotoFile(jenis) {
  return new Promise((resolve, reject) => {
    const input = hrEl('absenFile');
    input.value = '';
    const cleanup = () => { input.onchange = null; input.oncancel = null; };
    input.oncancel = () => { cleanup(); resolve(null); };
    input.onchange = () => {
      cleanup();
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try { resolve(imageToJpeg(img, img.naturalWidth, img.naturalHeight, jenis)); } catch (err) { reject(err); }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File foto tidak bisa dibaca.')); };
      img.src = url;
    };
    input.click();
  });
}

// Deteksi wajah: FaceDetector bawaan browser, atau MediaPipe (dimuat dari CDN). Mengembalikan null bila detektor tidak tersedia.
let faceDetectorPromise = null;
function loadFaceDetector() {
  if (faceDetectorPromise) return faceDetectorPromise;
  faceDetectorPromise = (async () => {
    if (window.FaceDetector) {
      try { const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 }); return async canvas => (await native.detect(canvas)).length; } catch (e) { /* lanjut ke MediaPipe */ }
    }
    const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const vision = await import(`${base}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    const detector = await vision.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
      runningMode: 'IMAGE', minDetectionConfidence: 0.6
    });
    return async canvas => detector.detect(canvas).detections.length;
  })().catch(err => { console.warn('Detektor wajah tidak tersedia:', err); faceDetectorPromise = null; return null; });
  return faceDetectorPromise;
}

async function countFaces(canvas) {
  const detect = await loadFaceDetector();
  return detect ? detect(canvas) : null;
}

async function submitAbsen(jenis) {
  if (absenBusy) return;
  absenBusy = true;
  hrEl('btnAbsenMasuk').disabled = true;
  hrEl('btnAbsenPulang').disabled = true;
  try {
    if (!absenStream) await startAbsenCamera();
    let foto = null;
    const video = hrEl('absenVideo');
    if (absenStream && video.videoWidth) foto = imageToJpeg(video, video.videoWidth, video.videoHeight, jenis);
    else foto = await pickPhotoFile(jenis);
    if (!foto) { hrAbsenMessage('Foto belum diambil, absen dibatalkan.', 'secondary'); return; }
    hrAbsenMessage('Memeriksa wajah pada foto...', 'info');
    const faces = await countFaces(hrEl('absenCanvas'));
    if (faces === 0) { hrAbsenMessage('Wajah tidak terdeteksi. Hadapkan wajah ke kamera dengan cahaya cukup, lalu coba lagi.', 'danger'); return; }
    const preview = hrEl('absenPreview');
    if (!absenStream) { preview.src = foto; preview.classList.remove('d-none'); hrEl('absenPlaceholder').classList.add('d-none'); }
    const result = await hrJson('/api/absensi', { method: 'POST', body: { Jenis: jenis, Foto: foto } });
    hrAbsenMessage(result.message + (faces === null ? ' (Deteksi wajah otomatis tidak tersedia, foto tidak diverifikasi.)' : ''), faces === null ? 'warning' : 'success');
  } catch (err) {
    hrAbsenMessage(err.message, 'danger');
  } finally {
    absenBusy = false;
    await loadEmployeeData();
  }
}

// ===== Karyawan: shift & slip =====
async function loadShiftSaya() {
  const body = hrEl('shiftBody');
  if (!body) return;
  try {
    const r = await hrJson(`/api/jadwal/saya?bulan=${encodeURIComponent(empMonth)}`);
    body.replaceChildren();
    if (!r.data.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = 4; cell.className = 'text-center text-body-secondary py-3';
      cell.textContent = 'Belum ada jadwal shift pada bulan ini. Hubungi bos/admin.';
      return;
    }
    const today = hrToday();
    r.data.forEach(j => {
      const row = body.insertRow();
      if (j.Tgl === today) row.className = 'table-success';
      row.insertCell().textContent = hrDateLabel(j.Tgl);
      row.insertCell().textContent = hrDayName(j.Tgl);
      row.insertCell().textContent = j.Nama || 'Shift';
      row.insertCell().textContent = `${j.Mulai} - ${j.Selesai}`;
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadSlipSaya() {
  const box = hrEl('slipBox');
  if (!box) return;
  try {
    const r = await hrJson(`/api/gaji/slip?periode=${encodeURIComponent(empMonth)}`);
    window.empSlip = r.data;
    box.innerHTML = slipHtml(r.data);
  } catch (err) {
    window.empSlip = null;
    box.innerHTML = `<div class="text-danger">${escapeHtml(err.message)}</div>`;
  }
}

function slipRows(slip) {
  const s = slip.summary;
  return {
    pendapatan: [
      ['Gaji pokok', slip.Pokok],
      ['Tunjangan', slip.Tunjangan],
      ['Bonus', slip.Bonus],
      [`Bonus lembur (${s.lemburKelipatan}x kelipatan ${hrAturan().lemburKelipatanMenit} menit)`, slip.BonusLembur]
    ],
    potongan: [
      [`Potongan telat (${s.telat} kali, ${s.telatMenit} menit)`, slip.PotonganTelat],
      ['Potongan lainnya', slip.PotonganLain]
    ]
  };
}
const hrAturan = () => ({ lemburKelipatanMenit: 50 });

function slipHtml(slip) {
  if (!slip) return '';
  const rows = slipRows(slip);
  const line = ([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="sl-r">${escapeHtml(formatRupiah(value))}</td></tr>`;
  const s = slip.summary;
  return `<div class="sl">
    <div class="sl-head"><div class="sl-biz">${escapeHtml(businessSettings.NmUsaha || 'ABID KARYA SAYUR')}</div><div class="sl-title">SLIP GAJI - ${escapeHtml(hrMonthLabel(slip.Periode))}</div></div>
    <table class="sl-info"><tr><td>Nama</td><td>: ${escapeHtml(slip.Nmuser)} (${escapeHtml(slip.KdUser)})</td></tr>
      <tr><td>Kehadiran</td><td>: ${s.hadir} hari, telat ${s.telat}x, lembur ${escapeHtml(hrDuration(s.lemburMenit))}, tidak hadir ${s.alpha} hari</td></tr></table>
    <table class="sl-tbl"><thead><tr><th>Pendapatan</th><th class="sl-r">Jumlah</th></tr></thead><tbody>${rows.pendapatan.map(line).join('')}
      <tr class="sl-sub"><td>Total pendapatan</td><td class="sl-r">${escapeHtml(formatRupiah(slip.Pendapatan))}</td></tr></tbody></table>
    <table class="sl-tbl"><thead><tr><th>Potongan</th><th class="sl-r">Jumlah</th></tr></thead><tbody>${rows.potongan.map(line).join('')}
      <tr class="sl-sub"><td>Total potongan</td><td class="sl-r">${escapeHtml(formatRupiah(slip.Potongan))}</td></tr></tbody></table>
    <div class="sl-total"><span>GAJI BERSIH</span><span>${escapeHtml(formatRupiah(slip.Total))}</span></div>
    ${slip.Catatan ? `<div class="sl-note">Catatan: ${escapeHtml(slip.Catatan)}</div>` : ''}
    ${slip.tersimpan ? '' : '<div class="sl-note">Komponen gaji bulan ini belum diinput oleh admin; nilai di atas masih sementara.</div>'}
  </div>`;
}

const SLIP_CSS = `.sl{font:11pt/1.4 Arial,Helvetica,sans-serif;color:#000;padding:10mm;width:148mm}
.sl-head{text-align:center;margin-bottom:5mm}.sl-biz{font-size:15pt;font-weight:700}.sl-title{font-size:11pt;margin-top:1mm}
.sl-info{width:100%;margin-bottom:4mm;font-size:10pt}.sl-info td{padding:.5mm 0;vertical-align:top}.sl-info td:first-child{width:24mm}
.sl-tbl{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:10pt}.sl-tbl th,.sl-tbl td{border:1px solid #000;padding:1.5mm 2mm;text-align:left}
.sl-tbl th{background:#e5e7eb}.sl-r{text-align:right !important;white-space:nowrap}.sl-sub td{font-weight:700}
.sl-total{display:flex;justify-content:space-between;border:2px solid #000;padding:2.5mm;font-size:13pt;font-weight:700}
.sl-note{margin-top:3mm;font-size:9pt}`;

function printSlip(slip) {
  if (!slip) return alert('Slip gaji belum tersedia.');
  printDocument({ html: slipHtml(slip), css: SLIP_CSS, widthMm: 148, heightMm: 210 });
}

function downloadSlipPdf(slip) {
  if (!slip) return alert('Slip gaji belum tersedia.');
  if (!window.jspdf || !window.jspdf.jsPDF) return alert('Modul PDF belum siap (butuh koneksi internet). Coba lagi sebentar.');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a5' });
  const rows = slipRows(slip);
  const money = v => formatRupiah(v);
  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.text(businessSettings.NmUsaha || 'ABID KARYA SAYUR', 74, 14, { align: 'center' });
  doc.setFontSize(10); doc.setFont(undefined, 'normal');
  doc.text(`SLIP GAJI - ${hrMonthLabel(slip.Periode)}`, 74, 20, { align: 'center' });
  doc.text(`Nama : ${slip.Nmuser} (${slip.KdUser})`, 12, 29);
  const s = slip.summary;
  doc.text(`Hadir ${s.hadir} hari | Telat ${s.telat}x | Lembur ${hrDuration(s.lemburMenit)} | Tidak hadir ${s.alpha} hari`, 12, 35);
  const common = { theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [22, 163, 74] }, columnStyles: { 1: { halign: 'right', cellWidth: 38 } }, margin: { left: 12, right: 12 } };
  doc.autoTable({ ...common, startY: 40, head: [['Pendapatan', 'Jumlah']], body: [...rows.pendapatan.map(([l, v]) => [l, money(v)]), [{ content: 'Total pendapatan', styles: { fontStyle: 'bold' } }, { content: money(slip.Pendapatan), styles: { fontStyle: 'bold' } }]] });
  doc.autoTable({ ...common, startY: doc.lastAutoTable.finalY + 4, head: [['Potongan', 'Jumlah']], body: [...rows.potongan.map(([l, v]) => [l, money(v)]), [{ content: 'Total potongan', styles: { fontStyle: 'bold' } }, { content: money(slip.Potongan), styles: { fontStyle: 'bold' } }]] });
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text('GAJI BERSIH', 12, y);
  doc.text(money(slip.Total), 136, y, { align: 'right' });
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  if (slip.Catatan) doc.text(`Catatan: ${slip.Catatan}`, 12, y + 7);
  if (!slip.tersimpan) doc.text('Komponen gaji belum diinput admin; nilai masih sementara.', 12, y + 12);
  doc.save(`slip-gaji-${slip.KdUser}-${slip.Periode}.pdf`);
}

// ===== Admin: pengaturan shift =====
async function loadHrUsers() {
  const r = await hrJson('/api/karyawan');
  hrUsers = r.data;
  return hrUsers;
}

async function initShiftAdmin() {
  try {
    await loadHrUsers();
    const list = hrEl('shiftUsers');
    const checked = new Set([...list.querySelectorAll('input:checked')].map(i => i.value));
    list.replaceChildren();
    if (!hrUsers.length) list.innerHTML = '<span class="text-body-secondary small">Belum ada user dengan role Karyawan. Tambahkan di Manajemen User.</span>';
    hrUsers.forEach(u => {
      const label = document.createElement('label');
      label.className = 'form-check d-block';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.className = 'form-check-input'; input.value = u.KdUser; input.checked = checked.has(u.KdUser);
      const span = document.createElement('span');
      span.className = 'form-check-label'; span.textContent = `${u.Nmuser} (${u.KdUser})`;
      label.append(input, span);
      list.appendChild(label);
    });
    const filter = hrEl('shiftFilterUser');
    const previous = filter.value;
    filter.replaceChildren(new Option('Semua karyawan', ''));
    hrUsers.forEach(u => filter.add(new Option(u.Nmuser, u.KdUser)));
    filter.value = previous;
    if (!hrAdminReady) {
      hrAdminReady = true;
      const days = hrEl('shiftDays');
      ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach((name, i) => {
        days.insertAdjacentHTML('beforeend', `<input type="checkbox" class="btn-check" id="shiftDay${i}" value="${i}" ${i >= 1 && i <= 6 ? 'checked' : ''}><label class="btn btn-sm btn-outline-success" for="shiftDay${i}">${name}</label>`);
      });
      const today = hrToday();
      hrEl('shiftDari').value = today;
      hrEl('shiftSampai').value = today.slice(0, 8) + String(new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate()).padStart(2, '0');
      hrEl('shiftFilterMonth').value = today.slice(0, 7);
    }
    loadShiftAdmin();
  } catch (err) {
    hrEl('shiftUsers').textContent = err.message;
  }
}

function toggleAllShiftUsers(on) { hrEl('shiftUsers').querySelectorAll('input').forEach(i => { i.checked = on; }); }
function applyShiftPreset(nama, mulai, selesai) { hrEl('shiftNama').value = nama; hrEl('shiftMulai').value = mulai; hrEl('shiftSelesai').value = selesai; }

// Jam kerja 11 jam, shift malam 10 jam.
function syncShiftEnd() {
  const start = hrEl('shiftMulai').value;
  if (!/^\d{2}:\d{2}$/.test(start)) return;
  const hours = /malam/i.test(hrEl('shiftNama').value) ? 10 : 11;
  const total = (Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + hours * 60) % 1440;
  hrEl('shiftSelesai').value = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function saveShiftForm(event) {
  event.preventDefault();
  const error = hrEl('shiftError');
  error.classList.add('d-none');
  const button = hrEl('btnSaveShift');
  button.disabled = true;
  try {
    const result = await hrJson('/api/jadwal', {
      method: 'PUT',
      body: {
        KdUsers: [...hrEl('shiftUsers').querySelectorAll('input:checked')].map(i => i.value),
        dari: hrEl('shiftDari').value, sampai: hrEl('shiftSampai').value,
        hari: [...hrEl('shiftDays').querySelectorAll('input:checked')].map(i => Number(i.value)),
        Mulai: hrEl('shiftMulai').value, Selesai: hrEl('shiftSelesai').value, Nama: hrEl('shiftNama').value
      }
    });
    hrEl('shiftFilterMonth').value = hrEl('shiftDari').value.slice(0, 7);
    await loadShiftAdmin();
    alert(result.message);
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('d-none');
  } finally {
    button.disabled = false;
  }
}

async function loadShiftAdmin() {
  const body = hrEl('shiftAdminBody');
  try {
    const month = hrEl('shiftFilterMonth').value || hrToday().slice(0, 7);
    const user = hrEl('shiftFilterUser').value;
    const r = await hrJson(`/api/jadwal?bulan=${encodeURIComponent(month)}${user ? `&kdUser=${encodeURIComponent(user)}` : ''}`);
    body.replaceChildren();
    if (!r.data.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = 5; cell.className = 'text-center text-body-secondary py-3';
      cell.textContent = 'Belum ada jadwal pada bulan ini.';
      return;
    }
    r.data.forEach(j => {
      const row = body.insertRow();
      row.insertCell().textContent = `${hrDayName(j.Tgl)}, ${hrDateLabel(j.Tgl)}`;
      row.insertCell().textContent = j.Nmuser || j.KdUser;
      row.insertCell().textContent = j.Nama || 'Shift';
      row.insertCell().textContent = `${j.Mulai} - ${j.Selesai}`;
      const action = row.insertCell();
      action.className = 'text-end';
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'btn btn-sm btn-outline-danger'; del.title = 'Hapus jadwal';
      del.innerHTML = '<i class="bi bi-trash"></i>';
      del.addEventListener('click', async () => {
        if (!confirm(`Hapus jadwal ${j.Nmuser || j.KdUser} tanggal ${hrDateLabel(j.Tgl)}?`)) return;
        try { await hrJson(`/api/jadwal?kdUser=${encodeURIComponent(j.KdUser)}&dari=${j.Tgl}&sampai=${j.Tgl}`, { method: 'DELETE' }); loadShiftAdmin(); }
        catch (err) { alert(err.message); }
      });
      action.appendChild(del);
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ===== Admin: penggajian & rekap absensi =====
async function initPayroll() {
  try {
    await loadHrUsers();
    const filter = hrEl('absFilterUser');
    const previous = filter.value;
    filter.replaceChildren(new Option('Semua karyawan', ''));
    hrUsers.forEach(u => filter.add(new Option(u.Nmuser, u.KdUser)));
    filter.value = previous;
    if (!payReady) {
      payReady = true;
      const today = hrToday();
      hrEl('payMonth').value = today.slice(0, 7);
      hrEl('absDari').value = today.slice(0, 8) + '01';
      hrEl('absSampai').value = today;
    }
    loadPayroll();
    loadAbsensiAdmin();
  } catch (err) {
    hrEl('payBody').innerHTML = `<tr><td colspan="12" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function loadPayroll() {
  const body = hrEl('payBody');
  try {
    const periode = hrEl('payMonth').value || hrToday().slice(0, 7);
    const r = await hrJson(`/api/gaji?periode=${encodeURIComponent(periode)}`);
    const a = r.aturan;
    hrSet('payRules', `Aturan otomatis: telat dihitung sejak ${a.telatMulaiSebelumMenit} menit sebelum jam masuk shift, potongan ${formatRupiah(a.telatPotongan)} setiap kelipatan ${a.telatKelipatanMenit} menit. Lembur: bonus ${formatRupiah(a.lemburBonus)} setiap kelipatan ${a.lemburKelipatanMenit} menit melewati jam pulang shift.`);
    body.replaceChildren();
    if (!r.data.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = 12; cell.className = 'text-center text-body-secondary py-3';
      cell.textContent = 'Belum ada karyawan aktif. Tambahkan user dengan role Karyawan.';
      return;
    }
    r.data.forEach(slip => {
      const row = body.insertRow();
      const name = row.insertCell();
      name.innerHTML = `<div class="fw-semibold">${escapeHtml(slip.Nmuser)}</div><div class="small text-body-secondary">${escapeHtml(slip.KdUser)}${slip.tersimpan ? '' : ' · <span class="text-warning">belum diinput</span>'}</div>`;
      const num = value => { const c = row.insertCell(); c.className = 'text-end'; c.textContent = value; return c; };
      num(slip.summary.hadir);
      num(slip.summary.telat);
      num(slip.summary.lemburMenit);
      num(formatRupiah(slip.Pokok));
      num(formatRupiah(slip.Tunjangan));
      num(formatRupiah(slip.Bonus));
      num(formatRupiah(slip.BonusLembur)).classList.add('text-success');
      num(formatRupiah(slip.PotonganTelat)).classList.add('text-danger');
      num(formatRupiah(slip.PotonganLain)).classList.add('text-danger');
      num(formatRupiah(slip.Total)).classList.add('fw-bold');
      const action = row.insertCell();
      action.className = 'text-end text-nowrap';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-1'; edit.textContent = 'Input';
      edit.addEventListener('click', () => openGajiModal(slip));
      const view = document.createElement('button');
      view.type = 'button'; view.className = 'btn btn-sm btn-outline-success'; view.textContent = 'Slip';
      view.addEventListener('click', () => openSlipAdmin(slip));
      action.append(edit, view);
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="12" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openGajiModal(slip) {
  hrEl('gajiTitle').textContent = `${slip.Nmuser} (${slip.KdUser}) - ${hrMonthLabel(slip.Periode)}`;
  hrEl('gajiForm').dataset.kdUser = slip.KdUser;
  hrEl('gajiForm').dataset.periode = slip.Periode;
  hrEl('gajiPokok').value = slip.Pokok;
  hrEl('gajiTunjangan').value = slip.Tunjangan;
  hrEl('gajiBonus').value = slip.Bonus;
  hrEl('gajiPotongan').value = slip.PotonganLain;
  hrEl('gajiCatatan').value = slip.Catatan || '';
  hrEl('gajiError').classList.add('d-none');
  bootstrap.Modal.getOrCreateInstance(hrEl('modalGaji')).show();
}

async function saveGajiForm(event) {
  event.preventDefault();
  const form = hrEl('gajiForm');
  const error = hrEl('gajiError');
  error.classList.add('d-none');
  try {
    await hrJson('/api/gaji', {
      method: 'PUT',
      body: {
        KdUser: form.dataset.kdUser, Periode: form.dataset.periode,
        Pokok: Number(hrEl('gajiPokok').value || 0), Tunjangan: Number(hrEl('gajiTunjangan').value || 0),
        Bonus: Number(hrEl('gajiBonus').value || 0), PotonganLain: Number(hrEl('gajiPotongan').value || 0),
        Catatan: hrEl('gajiCatatan').value
      }
    });
    bootstrap.Modal.getOrCreateInstance(hrEl('modalGaji')).hide();
    loadPayroll();
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('d-none');
  }
}

function openSlipAdmin(slip) {
  window.adminSlip = slip;
  hrEl('slipAdminBox').innerHTML = slipHtml(slip);
  bootstrap.Modal.getOrCreateInstance(hrEl('modalSlipAdmin')).show();
}

async function loadAbsensiAdmin() {
  const body = hrEl('absBody');
  try {
    const user = hrEl('absFilterUser').value;
    const r = await hrJson(`/api/absensi?dari=${hrEl('absDari').value}&sampai=${hrEl('absSampai').value}${user ? `&kdUser=${encodeURIComponent(user)}` : ''}`);
    hrSet('absNote', `Foto selfie dihapus otomatis setelah ${r.fotoRetensiHari} hari; jam masuk/pulang tetap tersimpan.`);
    body.replaceChildren();
    if (!r.data.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = 8; cell.className = 'text-center text-body-secondary py-3';
      cell.textContent = 'Tidak ada data absensi pada rentang ini.';
      return;
    }
    r.data.forEach(a => {
      const row = body.insertRow();
      row.insertCell().textContent = hrDateLabel(a.Tgl);
      row.insertCell().textContent = a.Nmuser || a.KdUser;
      row.insertCell().textContent = a.ShiftMulai ? `${a.ShiftMulai.slice(0, 5)}-${a.ShiftSelesai.slice(0, 5)}` : '-';
      row.insertCell().textContent = hrClock(a.JamMasuk);
      row.insertCell().textContent = a.JamPulang ? hrClock(a.JamPulang) : '-';
      row.insertCell().innerHTML = hrStatusBadge(a.Status);
      const lembur = row.insertCell();
      lembur.className = 'text-end';
      lembur.textContent = a.LemburMenit || '-';
      const photos = row.insertCell();
      photos.className = 'text-nowrap';
      [['masuk', a.AdaFotoMasuk, 'Masuk'], ['pulang', a.AdaFotoPulang, 'Pulang']].forEach(([jenis, ada, label]) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'btn btn-sm btn-outline-secondary me-1';
        button.innerHTML = `<i class="bi bi-image"></i> ${label}`;
        button.disabled = !ada;
        if (!ada) button.title = 'Foto tidak ada atau sudah dihapus otomatis';
        button.addEventListener('click', () => showAbsenPhoto(a, jenis));
        photos.appendChild(button);
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function showAbsenPhoto(record, jenis) {
  const img = hrEl('fotoImg');
  hrSet('fotoTitle', `Foto absen ${jenis} - ${record.Nmuser || record.KdUser} (${hrDateLabel(record.Tgl)})`);
  hrSet('fotoMsg', 'Memuat...');
  img.classList.add('d-none');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  bootstrap.Modal.getOrCreateInstance(hrEl('modalFotoAbsen')).show();
  try {
    const response = await fetch(`/api/absensi/foto/${record.Id}/${jenis}`);
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Foto tidak tersedia.');
    const url = URL.createObjectURL(await response.blob());
    img.dataset.url = url;
    img.src = url;
    img.classList.remove('d-none');
    hrSet('fotoMsg', '');
  } catch (err) {
    hrSet('fotoMsg', err.message);
  }
}
