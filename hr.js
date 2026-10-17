// Modul absensi selfie, shift kerja, dan penggajian karyawan.
// Kompatibel dengan MySQL lama (tanpa subquery / ON DUPLICATE KEY).

const ATURAN = {
  telatMulaiSebelumMenit: 5, // hitungan telat dimulai 5 menit sebelum jam masuk shift
  telatKelipatanMenit: 5,
  telatPotongan: 5000,
  lemburKelipatanMenit: 50,
  lemburBonus: 10000,
  jamKerja: 11,
  jamKerjaMalam: 10
};
const FOTO_RETENSI_HARI = Math.max(1, parseInt(process.env.ABSEN_FOTO_HARI, 10) || 2);
const FOTO_MAKS_KARAKTER = 200000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DATA_FOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

const reDate = /^\d{4}-\d{2}-\d{2}$/;
const reMonth = /^\d{4}-(0[1-9]|1[0-2])$/;
const reTime = /^([01]\d|2[0-3]):[0-5]\d$/;

// Waktu dari DB berupa teks lokal 'YYYY-MM-DD HH:MM:SS'; dihitung sebagai waktu naif agar bebas zona waktu.
function toMs(dateText, timeText) {
  const [y, m, d] = dateText.split('-').map(Number);
  const [hh, mm, ss] = String(timeText || '00:00:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}
function dtMs(dt) { return toMs(dt.slice(0, 10), dt.slice(11, 19)); }
function addDays(dateText, n) { return new Date(Date.parse(dateText + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function eachDate(dari, sampai) {
  const out = [];
  for (let d = dari; d <= sampai; d = addDays(d, 1)) out.push(d);
  return out;
}
function monthRange(periode) {
  const [y, m] = periode.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${periode}-01`, end: `${periode}-${String(last).padStart(2, '0')}` };
}
function shiftWindow(tgl, mulai, selesai) {
  const start = toMs(tgl, mulai);
  let end = toMs(tgl, selesai);
  if (end <= start) end += 864e5; // shift malam melewati tengah malam
  return { start, end };
}

function hitungMenit(tgl, masukDt, pulangDt, mulai, selesai) {
  let telat = 0, lembur = 0;
  if (mulai && selesai) {
    const w = shiftWindow(tgl, mulai, selesai);
    if (masukDt) telat = Math.max(0, Math.floor((dtMs(masukDt) - (w.start - ATURAN.telatMulaiSebelumMenit * 60000)) / 60000));
    if (pulangDt) lembur = Math.max(0, Math.floor((dtMs(pulangDt) - w.end) / 60000));
  }
  return { telat, lembur };
}

function dekor(r) {
  const telatUnit = Math.floor(Number(r.TelatMenit || 0) / ATURAN.telatKelipatanMenit);
  const lemburUnit = Math.floor(Number(r.LemburMenit || 0) / ATURAN.lemburKelipatanMenit);
  let selisihMasuk = null;
  if (r.ShiftMulai) selisihMasuk = Math.round((dtMs(r.JamMasuk) - toMs(r.Tgl, r.ShiftMulai)) / 60000);
  const jamKerjaMenit = r.JamPulang ? Math.max(0, Math.round((dtMs(r.JamPulang) - dtMs(r.JamMasuk)) / 60000)) : null;
  return {
    ...r,
    Status: !r.ShiftMulai ? 'Tanpa shift' : telatUnit > 0 ? 'Telat' : 'Tepat waktu',
    SelisihMasuk: selisihMasuk,
    JamKerjaMenit: jamKerjaMenit,
    TelatMenit: Number(r.TelatMenit || 0),
    LemburMenit: Number(r.LemburMenit || 0),
    PotonganTelat: telatUnit * ATURAN.telatPotongan,
    BonusLembur: lemburUnit * ATURAN.lemburBonus
  };
}

const ABSEN_COLS = `a.Id, a.KdUser, DATE_FORMAT(a.Tgl, '%Y-%m-%d') AS Tgl,
  DATE_FORMAT(a.JamMasuk, '%Y-%m-%d %H:%i:%s') AS JamMasuk, DATE_FORMAT(a.JamPulang, '%Y-%m-%d %H:%i:%s') AS JamPulang,
  TIME_FORMAT(a.ShiftMulai, '%H:%i:%s') AS ShiftMulai, TIME_FORMAT(a.ShiftSelesai, '%H:%i:%s') AS ShiftSelesai,
  a.TelatMenit, a.LemburMenit, (a.FotoMasuk IS NOT NULL) AS AdaFotoMasuk, (a.FotoPulang IS NOT NULL) AS AdaFotoPulang`;

module.exports = function createHr({ query, hasManagerRole }) {
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (err) {
      console.error('HR error:', err.message);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server: ' + err.message });
    }
  };
  const fail = (res, status, message) => res.status(status).json({ success: false, message });
  const manager = (req, res) => {
    if (hasManagerRole(req.user)) return true;
    fail(res, 403, 'Akses khusus administrator atau pemilik.');
    return false;
  };
  const isStaff = user => Boolean(user) && (user.Role === 'karyawan' || user.IsKaryawan === 'Y');
  const employee = (req, res) => {
    if (isStaff(req.user)) return true;
    fail(res, 403, 'Fitur ini khusus untuk user yang ditandai ikut absensi (karyawan).');
    return false;
  };

  async function nowText() {
    const [r] = await query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n");
    return r.n;
  }

  async function ensureTables() {
    await query(`CREATE TABLE IF NOT EXISTS pos_jadwal (
      KdUser varchar(5) NOT NULL,
      Tgl date NOT NULL,
      Mulai time NOT NULL,
      Selesai time NOT NULL,
      Nama varchar(20) default NULL,
      DicatatOleh varchar(5) default NULL,
      PRIMARY KEY (KdUser, Tgl),
      KEY Tgl (Tgl)
    ) TYPE=MyISAM`);
    await query(`CREATE TABLE IF NOT EXISTS pos_absen (
      Id int unsigned NOT NULL auto_increment,
      KdUser varchar(5) NOT NULL,
      Tgl date NOT NULL,
      JamMasuk datetime NOT NULL,
      JamPulang datetime default NULL,
      FotoMasuk mediumtext,
      FotoPulang mediumtext,
      ShiftMulai time default NULL,
      ShiftSelesai time default NULL,
      TelatMenit int NOT NULL default '0',
      LemburMenit int NOT NULL default '0',
      PRIMARY KEY (Id),
      KEY UserTgl (KdUser, Tgl),
      KEY JamMasuk (JamMasuk)
    ) TYPE=MyISAM`);
    await query(`CREATE TABLE IF NOT EXISTS pos_gaji (
      KdUser varchar(5) NOT NULL,
      Periode char(7) NOT NULL,
      Pokok decimal(14,2) NOT NULL default '0.00',
      Tunjangan decimal(14,2) NOT NULL default '0.00',
      Bonus decimal(14,2) NOT NULL default '0.00',
      PotonganLain decimal(14,2) NOT NULL default '0.00',
      Catatan varchar(100) default NULL,
      DicatatOleh varchar(5) default NULL,
      DicatatPada datetime default NULL,
      PRIMARY KEY (KdUser, Periode)
    ) TYPE=MyISAM`);
  }

  // Foto hanya untuk validasi sementara: dikosongkan permanen setelah FOTO_RETENSI_HARI hari; jam absensi tetap tersimpan.
  async function hapusFotoKadaluarsa() {
    const days = FOTO_RETENSI_HARI;
    const a = await query(`UPDATE pos_absen SET FotoMasuk = NULL WHERE FotoMasuk IS NOT NULL AND JamMasuk < DATE_SUB(NOW(), INTERVAL ${days} DAY)`);
    const b = await query(`UPDATE pos_absen SET FotoPulang = NULL WHERE FotoPulang IS NOT NULL AND JamPulang < DATE_SUB(NOW(), INTERVAL ${days} DAY)`);
    const n = (a.affectedRows || 0) + (b.affectedRows || 0);
    if (n) console.log(`[absensi] ${n} foto lebih dari ${days} hari dihapus.`);
    return n;
  }

  function startCleanup() {
    const run = () => hapusFotoKadaluarsa().catch(err => console.error('[absensi] gagal hapus foto lama:', err.message));
    run();
    const timer = setInterval(run, CLEANUP_INTERVAL_MS);
    if (timer.unref) timer.unref();
  }

  async function ambilJadwal(kdUser, tgl) {
    const rows = await query(`SELECT TIME_FORMAT(Mulai, '%H:%i:%s') AS Mulai, TIME_FORMAT(Selesai, '%H:%i:%s') AS Selesai, Nama
      FROM pos_jadwal WHERE KdUser = ? AND Tgl = ? LIMIT 1`, [kdUser, tgl]);
    return rows[0] || null;
  }

  async function ringkasanBulan(kdUser, periode) {
    const { start, end } = monthRange(periode);
    const today = (await nowText()).slice(0, 10);
    const rawRows = await query(`SELECT ${ABSEN_COLS} FROM pos_absen a WHERE a.KdUser = ? AND a.Tgl BETWEEN ? AND ? ORDER BY a.Tgl ASC, a.Id ASC`, [kdUser, start, end]);
    const records = rawRows.map(r => dekor({ ...r, AdaFotoMasuk: Boolean(r.AdaFotoMasuk), AdaFotoPulang: Boolean(r.AdaFotoPulang) }));
    const jadwal = await query(`SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, TIME_FORMAT(Mulai, '%H:%i') AS Mulai, TIME_FORMAT(Selesai, '%H:%i') AS Selesai, Nama
      FROM pos_jadwal WHERE KdUser = ? AND Tgl BETWEEN ? AND ? ORDER BY Tgl ASC`, [kdUser, start, end]);
    const hadirTgl = new Set(records.map(r => r.Tgl));
    const jadwalLewat = jadwal.filter(j => j.Tgl < today);
    const alpha = jadwalLewat.filter(j => !hadirTgl.has(j.Tgl)).length;
    const sum = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0);
    const telatList = records.filter(r => r.Status === 'Telat');
    const lemburMenit = sum(records, 'LemburMenit');
    return {
      periode, records, jadwal,
      summary: {
        hadir: records.length,
        tepatWaktu: records.filter(r => r.Status === 'Tepat waktu').length,
        telat: telatList.length,
        telatMenit: sum(telatList, 'TelatMenit'),
        lemburMenit,
        lemburKelipatan: records.reduce((s, r) => s + Math.floor(r.LemburMenit / ATURAN.lemburKelipatanMenit), 0),
        jamKerjaMenit: sum(records, 'JamKerjaMenit'),
        hariJadwal: jadwal.length,
        hariJadwalLewat: jadwalLewat.length,
        alpha,
        persenKehadiran: jadwalLewat.length ? Math.round((jadwalLewat.length - alpha) / jadwalLewat.length * 100) : null,
        persenTepatWaktu: records.length ? Math.round(records.filter(r => r.Status !== 'Telat').length / records.length * 100) : null,
        potonganTelat: sum(records, 'PotonganTelat'),
        bonusLembur: sum(records, 'BonusLembur')
      }
    };
  }

  async function hitungSlip(kdUser, periode) {
    const [user] = await query('SELECT KdUser, Nmuser FROM pos_auth WHERE KdUser = ? LIMIT 1', [kdUser]);
    if (!user) return null;
    const [gaji] = await query(`SELECT Pokok, Tunjangan, Bonus, PotonganLain, Catatan,
      DATE_FORMAT(DicatatPada, '%Y-%m-%d %H:%i') AS DicatatPada FROM pos_gaji WHERE KdUser = ? AND Periode = ? LIMIT 1`, [kdUser, periode]);
    const data = await ringkasanBulan(kdUser, periode);
    const g = gaji || { Pokok: 0, Tunjangan: 0, Bonus: 0, PotonganLain: 0, Catatan: '', DicatatPada: null };
    const pokok = Number(g.Pokok), tunjangan = Number(g.Tunjangan), bonus = Number(g.Bonus), potonganLain = Number(g.PotonganLain);
    const { bonusLembur, potonganTelat } = data.summary;
    return {
      KdUser: user.KdUser, Nmuser: user.Nmuser, Periode: periode, tersimpan: Boolean(gaji), DicatatPada: g.DicatatPada, Catatan: g.Catatan || '',
      Pokok: pokok, Tunjangan: tunjangan, Bonus: bonus, PotonganLain: potonganLain,
      BonusLembur: bonusLembur, PotonganTelat: potonganTelat,
      Pendapatan: pokok + tunjangan + bonus + bonusLembur,
      Potongan: potonganTelat + potonganLain,
      Total: pokok + tunjangan + bonus + bonusLembur - potonganTelat - potonganLain,
      summary: data.summary
    };
  }

  async function periodeDefault(req) {
    const p = String(req.query.periode || req.query.bulan || '').trim();
    if (p && !reMonth.test(p)) return null;
    return p || (await nowText()).slice(0, 7);
  }

  function register(app) {
    // ===== Karyawan =====
    app.get('/api/karyawan/ringkasan', handle(async (req, res) => {
      if (!employee(req, res)) return;
      const periode = await periodeDefault(req);
      if (!periode) return fail(res, 400, 'Format bulan harus YYYY-MM.');
      const now = await nowText();
      const today = now.slice(0, 10);
      const data = await ringkasanBulan(req.user.KdUser, periode);
      const shiftToday = await ambilJadwal(req.user.KdUser, today);
      const [open] = await query(`SELECT ${ABSEN_COLS} FROM pos_absen a WHERE a.KdUser = ? AND a.JamPulang IS NULL ORDER BY a.JamMasuk DESC LIMIT 1`, [req.user.KdUser]);
      const openFresh = open && (dtMs(now) - dtMs(open.JamMasuk)) < 20 * 3600 * 1000;
      const [todayRow] = await query(`SELECT ${ABSEN_COLS} FROM pos_absen a WHERE a.KdUser = ? AND a.Tgl = ? ORDER BY a.Id DESC LIMIT 1`, [req.user.KdUser, today]);
      const state = openFresh ? 'masuk' : todayRow ? 'selesai' : 'belum';
      const current = openFresh ? open : todayRow;
      res.json({
        success: true, now, ...data, shiftToday, state,
        todayRecord: current ? dekor({ ...current, AdaFotoMasuk: Boolean(current.AdaFotoMasuk), AdaFotoPulang: Boolean(current.AdaFotoPulang) }) : null,
        aturan: ATURAN, fotoRetensiHari: FOTO_RETENSI_HARI
      });
    }));

    app.get('/api/jadwal/saya', handle(async (req, res) => {
      if (!employee(req, res)) return;
      const periode = await periodeDefault(req);
      if (!periode) return fail(res, 400, 'Format bulan harus YYYY-MM.');
      const { start, end } = monthRange(periode);
      const data = await query(`SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, TIME_FORMAT(Mulai, '%H:%i') AS Mulai, TIME_FORMAT(Selesai, '%H:%i') AS Selesai, Nama
        FROM pos_jadwal WHERE KdUser = ? AND Tgl BETWEEN ? AND ? ORDER BY Tgl ASC`, [req.user.KdUser, start, end]);
      res.json({ success: true, periode, data });
    }));

    app.post('/api/absensi', handle(async (req, res) => {
      if (!employee(req, res)) return;
      const jenis = String(req.body.Jenis || '').toUpperCase();
      const foto = String(req.body.Foto || '');
      if (!['MASUK', 'PULANG'].includes(jenis)) return fail(res, 400, 'Jenis absen harus MASUK atau PULANG.');
      if (!foto || foto.length > FOTO_MAKS_KARAKTER || !DATA_FOTO.test(foto)) return fail(res, 400, 'Foto selfie wajib diambil lewat kamera (JPEG, maksimal sekitar 150 KB).');
      const kdUser = req.user.KdUser;
      const now = await nowText();
      const today = now.slice(0, 10);
      const [open] = await query(`SELECT Id, DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, DATE_FORMAT(JamMasuk, '%Y-%m-%d %H:%i:%s') AS JamMasuk,
        TIME_FORMAT(ShiftMulai, '%H:%i:%s') AS ShiftMulai, TIME_FORMAT(ShiftSelesai, '%H:%i:%s') AS ShiftSelesai
        FROM pos_absen WHERE KdUser = ? AND JamPulang IS NULL ORDER BY JamMasuk DESC LIMIT 1`, [kdUser]);
      const openFresh = open && (dtMs(now) - dtMs(open.JamMasuk)) < 20 * 3600 * 1000;

      if (jenis === 'MASUK') {
        if (openFresh) return fail(res, 409, 'Anda sudah absen masuk. Silakan absen pulang saat selesai bekerja.');
        const [done] = await query('SELECT Id FROM pos_absen WHERE KdUser = ? AND Tgl = ? LIMIT 1', [kdUser, today]);
        if (done) return fail(res, 409, 'Absensi hari ini sudah lengkap (masuk dan pulang).');
        const shift = await ambilJadwal(kdUser, today);
        const { telat } = hitungMenit(today, now, null, shift && shift.Mulai, shift && shift.Selesai);
        await query(`INSERT INTO pos_absen (KdUser, Tgl, JamMasuk, FotoMasuk, ShiftMulai, ShiftSelesai, TelatMenit)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, [kdUser, today, now, foto, shift ? shift.Mulai : null, shift ? shift.Selesai : null, telat]);
        const status = shift ? (Math.floor(telat / ATURAN.telatKelipatanMenit) > 0 ? 'Telat' : 'Tepat waktu') : 'Tanpa shift';
        return res.json({ success: true, message: `Absen masuk tercatat pukul ${now.slice(11, 16)} (${status}).`, waktu: now, status });
      }

      if (!open) return fail(res, 409, 'Belum ada absen masuk yang bisa ditutup. Lakukan absen masuk dahulu.');
      const { lembur } = hitungMenit(open.Tgl, open.JamMasuk, now, open.ShiftMulai, open.ShiftSelesai);
      await query('UPDATE pos_absen SET JamPulang = ?, FotoPulang = ?, LemburMenit = ? WHERE Id = ?', [now, foto, lembur, open.Id]);
      const bonus = Math.floor(lembur / ATURAN.lemburKelipatanMenit) * ATURAN.lemburBonus;
      res.json({ success: true, message: `Absen pulang tercatat pukul ${now.slice(11, 16)}.` + (bonus ? ` Lembur ${lembur} menit, bonus Rp ${bonus.toLocaleString('id-ID')}.` : ''), waktu: now, lemburMenit: lembur, bonusLembur: bonus });
    }));

    app.get('/api/gaji/slip', handle(async (req, res) => {
      const periode = await periodeDefault(req);
      if (!periode) return fail(res, 400, 'Format periode harus YYYY-MM.');
      const kdUser = hasManagerRole(req.user) && req.query.kdUser ? String(req.query.kdUser).trim() : req.user.KdUser;
      if (!kdUser) return fail(res, 400, 'Karyawan wajib dipilih.');
      if (!hasManagerRole(req.user) && !isStaff(req.user)) return fail(res, 403, 'Role tidak memiliki akses ke fitur ini.');
      const slip = await hitungSlip(kdUser, periode);
      if (!slip) return fail(res, 404, 'Karyawan tidak ditemukan.');
      res.json({ success: true, data: slip, aturan: ATURAN });
    }));

    // ===== Admin / Bos =====
    app.get('/api/karyawan', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const data = await query("SELECT KdUser, Nmuser       FROM pos_auth WHERE (Role = 'karyawan' OR IsKaryawan = 'Y') AND IsActive = 'Y' ORDER BY Nmuser ASC");
      res.json({ success: true, data });
    }));

    app.get('/api/jadwal', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const periode = await periodeDefault(req);
      if (!periode) return fail(res, 400, 'Format bulan harus YYYY-MM.');
      const { start, end } = monthRange(periode);
      const kdUser = String(req.query.kdUser || '').trim();
      const params = [start, end];
      let extra = '';
      if (kdUser) { extra = ' AND j.KdUser = ?'; params.push(kdUser); }
      const data = await query(`SELECT j.KdUser, u.Nmuser, DATE_FORMAT(j.Tgl, '%Y-%m-%d') AS Tgl,
        TIME_FORMAT(j.Mulai, '%H:%i') AS Mulai, TIME_FORMAT(j.Selesai, '%H:%i') AS Selesai, j.Nama
        FROM pos_jadwal j LEFT JOIN pos_auth u ON u.KdUser = j.KdUser
        WHERE j.Tgl BETWEEN ? AND ?${extra} ORDER BY j.Tgl ASC, u.Nmuser ASC`, params);
      res.json({ success: true, periode, data });
    }));

    app.put('/api/jadwal', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const users = [...new Set((Array.isArray(req.body.KdUsers) ? req.body.KdUsers : []).map(u => String(u).trim()).filter(Boolean))];
      const { dari, sampai } = req.body;
      const Mulai = String(req.body.Mulai || ''), Selesai = String(req.body.Selesai || '');
      const Nama = String(req.body.Nama || '').trim().slice(0, 20) || null;
      const hari = (Array.isArray(req.body.hari) && req.body.hari.length ? req.body.hari : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter(n => n >= 0 && n <= 6);
      if (!users.length) return fail(res, 400, 'Pilih minimal satu karyawan.');
      if (!reDate.test(dari) || !reDate.test(sampai) || sampai < dari) return fail(res, 400, 'Rentang tanggal tidak valid.');
      if (!reTime.test(Mulai) || !reTime.test(Selesai) || Mulai === Selesai) return fail(res, 400, 'Jam mulai dan selesai harus valid dan tidak sama.');
      const isMalam = /malam/i.test(Nama || '');
      const targetJam = isMalam ? ATURAN.jamKerjaMalam : ATURAN.jamKerja;
      const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const durasi = (toMin(Selesai) - toMin(Mulai) + 1440) % 1440;
      if (durasi !== targetJam * 60) return fail(res, 400, `Durasi ${isMalam ? 'shift malam' : 'shift'} harus ${targetJam} jam (pulang = masuk + ${targetJam} jam).`);
      const dates = eachDate(dari, sampai).filter(d => hari.includes(new Date(d + 'T00:00:00Z').getUTCDay()));
      if (eachDate(dari, sampai).length > 62) return fail(res, 400, 'Rentang tanggal maksimal 62 hari sekali atur.');
      if (!dates.length) return fail(res, 400, 'Tidak ada tanggal yang cocok dengan hari yang dipilih.');
      const valid = await query("SELECT KdUser FROM pos_auth WHERE (Role = 'karyawan' OR IsKaryawan = 'Y') AND IsActive = 'Y' AND KdUser IN (?)", [users]);
      const validIds = valid.map(v => v.KdUser);
      if (validIds.length !== users.length) return fail(res, 400, 'Ada karyawan yang tidak valid atau nonaktif.');
      await query('DELETE FROM pos_jadwal WHERE KdUser IN (?) AND Tgl IN (?)', [validIds, dates]);
      const values = [];
      validIds.forEach(u => dates.forEach(d => values.push([u, d, Mulai + ':00', Selesai + ':00', Nama, req.user.KdUser])));
      await query('INSERT INTO pos_jadwal (KdUser, Tgl, Mulai, Selesai, Nama, DicatatOleh) VALUES ?', [values]);
      res.json({ success: true, message: `${values.length} jadwal shift disimpan.`, jumlah: values.length });
    }));

    app.delete('/api/jadwal', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const kdUser = String(req.query.kdUser || '').trim();
      const dari = String(req.query.dari || ''), sampai = String(req.query.sampai || dari);
      if (!kdUser || !reDate.test(dari) || !reDate.test(sampai) || sampai < dari) return fail(res, 400, 'Karyawan dan rentang tanggal wajib valid.');
      const result = await query('DELETE FROM pos_jadwal WHERE KdUser = ? AND Tgl BETWEEN ? AND ?', [kdUser, dari, sampai]);
      res.json({ success: true, message: `${result.affectedRows || 0} jadwal dihapus.` });
    }));

    app.get('/api/absensi', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const today = (await nowText()).slice(0, 10);
      const dari = String(req.query.dari || today.slice(0, 8) + '01'), sampai = String(req.query.sampai || today);
      if (!reDate.test(dari) || !reDate.test(sampai) || sampai < dari) return fail(res, 400, 'Rentang tanggal tidak valid.');
      const params = [dari, sampai];
      let extra = '';
      const kdUser = String(req.query.kdUser || '').trim();
      if (kdUser) { extra = ' AND a.KdUser = ?'; params.push(kdUser); }
      const rows = await query(`SELECT ${ABSEN_COLS}, u.Nmuser FROM pos_absen a LEFT JOIN pos_auth u ON u.KdUser = a.KdUser
        WHERE a.Tgl BETWEEN ? AND ?${extra} ORDER BY a.Tgl DESC, a.JamMasuk DESC LIMIT 1000`, params);
      res.json({ success: true, fotoRetensiHari: FOTO_RETENSI_HARI, data: rows.map(r => dekor({ ...r, AdaFotoMasuk: Boolean(r.AdaFotoMasuk), AdaFotoPulang: Boolean(r.AdaFotoPulang) })) });
    }));

    app.get('/api/absensi/foto/:id/:jenis', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const column = req.params.jenis === 'masuk' ? 'FotoMasuk' : req.params.jenis === 'pulang' ? 'FotoPulang' : null;
      const id = parseInt(req.params.id, 10);
      if (!column || !id) return fail(res, 400, 'Parameter foto tidak valid.');
      const [row] = await query(`SELECT ${column} AS Foto FROM pos_absen WHERE Id = ? LIMIT 1`, [id]);
      if (!row || !row.Foto) return fail(res, 404, `Foto sudah dihapus otomatis (lebih dari ${FOTO_RETENSI_HARI} hari) atau tidak ada.`);
      const base64 = String(row.Foto).split(',')[1] || '';
      res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
      res.send(Buffer.from(base64, 'base64'));
    }));

    app.get('/api/gaji', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const periode = await periodeDefault(req);
      if (!periode) return fail(res, 400, 'Format periode harus YYYY-MM.');
      const users = await query("SELECT KdUser       FROM pos_auth WHERE (Role = 'karyawan' OR IsKaryawan = 'Y') AND IsActive = 'Y' ORDER BY Nmuser ASC");
      const data = [];
      for (const u of users) data.push(await hitungSlip(u.KdUser, periode));
      res.json({ success: true, periode, aturan: ATURAN, data });
    }));

    app.put('/api/gaji', handle(async (req, res) => {
      if (!manager(req, res)) return;
      const KdUser = String(req.body.KdUser || '').trim();
      const Periode = String(req.body.Periode || '').trim();
      const nums = ['Pokok', 'Tunjangan', 'Bonus', 'PotonganLain'].map(k => Number(req.body[k] || 0));
      if (!KdUser || !reMonth.test(Periode) || nums.some(n => !Number.isFinite(n) || n < 0 || n > 999999999)) return fail(res, 400, 'Karyawan, periode (YYYY-MM), dan nominal (0 atau lebih) wajib valid.');
      const [user] = await query("SELECT KdUser FROM pos_auth WHERE KdUser = ? AND (Role = 'karyawan' OR IsKaryawan = 'Y') LIMIT 1", [KdUser]);
      if (!user) return fail(res, 404, 'Karyawan tidak ditemukan.');
      const Catatan = String(req.body.Catatan || '').trim().slice(0, 100) || null;
      await query('DELETE FROM pos_gaji WHERE KdUser = ? AND Periode = ?', [KdUser, Periode]);
      await query('INSERT INTO pos_gaji (KdUser, Periode, Pokok, Tunjangan, Bonus, PotonganLain, Catatan, DicatatOleh, DicatatPada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [KdUser, Periode, ...nums, Catatan, req.user.KdUser]);
      res.json({ success: true, message: 'Komponen gaji disimpan.', data: await hitungSlip(KdUser, Periode) });
    }));
  }

  return { ensureTables, register, startCleanup, hapusFotoKadaluarsa, ATURAN, hitungMenit };
};
