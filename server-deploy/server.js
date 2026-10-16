const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Database MySQL Remote (192.168.1.16)
const dbConfig = {
  host: '192.168.1.16',
  user: 'root',
  password: '',
  database: 'cipta',
  insecureAuth: true, // Diperlukan untuk versi MySQL kuno (MySQL 4.x)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Buat Connection Pool
const pool = mysql.createPool(dbConfig);
let bootstrapToken = '';
const SESSION_COOKIE = 'pos_session';
const SESSION_TTL_HOURS = 12;

// Helper Query dengan Auto-Reconnect / Pool
function query(sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Database Error:', err.message);
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function readSessionToken(req) {
  const cookies = String(req.headers.cookie || '').split(';');
  const cookie = cookies.find(part => part.trim().startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(SESSION_COOKIE.length + 1)) : '';
}

function setSessionCookie(res, token) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_HOURS * 60 * 60}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key));
  });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, cost, blockSize, parallelism, saltHex, hashHex] = parts;
  if (!/^\d+$/.test(cost) || !/^\d+$/.test(blockSize) || !/^\d+$/.test(parallelism) ||
      !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), expected.length,
      { N: Number(cost), r: Number(blockSize), p: Number(parallelism), maxmem: 64 * 1024 * 1024 },
      (err, key) => err ? reject(err) : resolve(key));
  });
  return crypto.timingSafeEqual(actual, expected);
}

async function createSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query('INSERT INTO pos_sessions (TokenHash, KdUser, ExpiresAt) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))', [tokenHash, user.KdUser, SESSION_TTL_HOURS]);
  setSessionCookie(res, token);
}

async function getSessionUser(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rows = await query(`SELECT a.KdUser, a.Nmuser, a.Role
    FROM pos_sessions s JOIN pos_auth a ON a.KdUser = s.KdUser
    WHERE s.TokenHash = ? AND s.ExpiresAt > NOW() AND a.IsActive = 'Y' LIMIT 1`, [tokenHash]);
  return rows[0] || null;
}

async function ensureAuthTables() {
  await query(`CREATE TABLE IF NOT EXISTS pos_auth (
    KdUser varchar(5) NOT NULL,
    Nmuser varchar(20) NOT NULL,
    PasswordHash varchar(255) NOT NULL,
    Role varchar(15) NOT NULL default 'kasir',
    IsActive char(1) NOT NULL default 'Y',
    PRIMARY KEY (KdUser)
  ) TYPE=MyISAM`);
  await query(`CREATE TABLE IF NOT EXISTS pos_sessions (
    TokenHash char(64) NOT NULL,
    KdUser varchar(5) NOT NULL,
    ExpiresAt datetime NOT NULL,
    PRIMARY KEY (TokenHash),
    KEY KdUser (KdUser),
    KEY ExpiresAt (ExpiresAt)
  ) TYPE=MyISAM`);
  await query(`CREATE TABLE IF NOT EXISTS pos_rjual (
    NoFak varchar(15) NOT NULL,
    SourceNoFak varchar(15) NOT NULL,
    SourceTgl date NOT NULL,
    KdKasir varchar(5) NOT NULL,
    TglFak date NOT NULL,
    Total decimal(12,2) NOT NULL default '0.00',
    PPN decimal(12,2) NOT NULL default '0.00',
    GTotal decimal(12,2) NOT NULL default '0.00',
    Bayar decimal(12,2) NOT NULL default '0.00',
    PRIMARY KEY (NoFak),
    KEY SourceInvoice (SourceTgl, KdKasir, SourceNoFak)
  ) TYPE=MyISAM`);
  await query(`CREATE TABLE IF NOT EXISTS pos_rdjual (
    NoFak varchar(15) NOT NULL,
    KdBar varchar(13) NOT NULL,
    Qty decimal(7,3) NOT NULL default '0.000',
    HJual decimal(12,2) NOT NULL default '0.00',
    Jumlah decimal(12,2) NOT NULL default '0.00',
    KEY NoFak (NoFak),
    KEY KdBar (KdBar)
  ) TYPE=MyISAM`);
  await query(`CREATE TABLE IF NOT EXISTS pos_piutang (
    NoBukti varchar(40) NOT NULL,
    KdAng char(15) NOT NULL,
    Tgl date NOT NULL,
    NoFak varchar(15) NOT NULL,
    KdUser varchar(5) NOT NULL,
    Debit decimal(12,2) NOT NULL default '0.00',
    Kredit decimal(12,2) NOT NULL default '0.00',
    Ket varchar(40) default NULL,
    PRIMARY KEY (NoBukti),
    KEY MemberInvoice (KdAng, NoFak),
    KEY Tgl (Tgl)
  ) TYPE=MyISAM`);
  await query(`CREATE TABLE IF NOT EXISTS pos_setoran (
    Tgl date NOT NULL,
    KdUser varchar(5) NOT NULL,
    Sistem decimal(14,2) NOT NULL default '0.00',
    Uang decimal(14,2) NOT NULL default '0.00',
    Selisih decimal(14,2) NOT NULL default '0.00',
    Ket varchar(100) default NULL,
    DicatatOleh varchar(5) default NULL,
    DicatatPada datetime default NULL,
    PRIMARY KEY (Tgl, KdUser)
  ) TYPE=MyISAM`);
  await query('DELETE FROM pos_sessions WHERE ExpiresAt <= NOW()');
  const users = await query('SELECT KdUser FROM pos_auth LIMIT 1');
  if (!users.length) {
    bootstrapToken = process.env.POS_BOOTSTRAP_TOKEN || crypto.randomBytes(24).toString('hex');
    console.log('Login awal belum disiapkan. Token setup admin satu kali: ' + bootstrapToken);
  }
}

app.use('/api', async (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  try {
    const user = await getSessionUser(readSessionToken(req));
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: 'Sesi login berakhir. Silakan masuk kembali.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memvalidasi sesi login.' });
  }
});

app.use('/api', (req, res, next) => {
  if (!req.user) return next();
  if (hasManagerRole(req.user)) return next();
  const method = req.method;
  const route = req.path;
  const isRead = method === 'GET';
  const commonRead = ['/options', '/barang', '/cari-barang', '/kode-barang-berikutnya', '/kelompok', '/pengaturan'];
  let allowed = commonRead.includes(route) && isRead;

  if (req.user.Role === 'kasir') {
    allowed ||= isRead && ['/anggota', '/kasir', '/penjualan/recent', '/penjualan/pending', '/piutang', '/laporan-kasir', '/setoran/saya', '/nota/penjualan', '/nota/retur', '/retur-penjualan/recent'].includes(route);
    allowed ||= isRead && /^\/penjualan\/pending\/[^/]+$/.test(route);
    allowed ||= isRead && (/^\/piutang\/[^/]+$/.test(route) || route === '/retur-penjualan/faktur');
    allowed ||= method === 'POST' && ['/penjualan', '/penjualan/pending', '/penjualan/batal', '/retur-penjualan', '/piutang/bayar'].includes(route);
    allowed ||= method === 'PUT' && route === '/setoran/saya';
    allowed ||= method === 'DELETE' && /^\/penjualan\/pending\/[^/]+$/.test(route);
  } else if (req.user.Role === 'gudang') {
    allowed ||= isRead && ['/supplier'].includes(route);
    allowed ||= isRead && ['/pembelian/recent'].includes(route);
    allowed ||= isRead && /^\/pembelian\/[^/]+$/.test(route);
    allowed ||= method === 'POST' && ['/barang', '/supplier'].includes(route);
    allowed ||= method === 'PUT' && /^\/barang\/[^/]+$/.test(route);
    allowed ||= method === 'PUT' && /^\/supplier\/[^/]+$/.test(route);
    allowed ||= method === 'POST' && ['/pembelian', '/retur-pembelian', '/opname'].includes(route);
  }

  if (!allowed) return res.status(403).json({ success: false, message: 'Role tidak memiliki akses ke fitur ini.' });
  next();
});

function requireAdmin(req, res) {
  if (req.user && ['admin', 'bos'].includes(req.user.Role)) return true;
  res.status(403).json({ success: false, message: 'Akses khusus administrator atau pemilik.' });
  return false;
}

function hasManagerRole(user) {
  return user && ['admin', 'bos'].includes(user.Role);
}

function requireRoles(req, res, roles) {
  if (req.user && roles.includes(req.user.Role)) return true;
  res.status(403).json({ success: false, message: 'Role tidak memiliki akses ke fitur ini.' });
  return false;
}

app.get('/api/auth/setup-status', async (req, res) => {
  try {
    const users = await query('SELECT KdUser FROM pos_auth LIMIT 1');
    if (users.length) return res.json({ success: true, setupRequired: false });
    const legacyUsers = await query('SELECT KdUser, Nmuser FROM kunci ORDER BY Nmuser ASC');
    res.json({ success: true, setupRequired: true, users: legacyUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memeriksa setup login.' });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  const setupToken = String(req.body.setupToken || '');
  const KdUser = String(req.body.KdUser || '').trim();
  const Nmuser = String(req.body.Nmuser || '').trim();
  const password = String(req.body.password || '');
  if (!bootstrapToken || setupToken.length !== bootstrapToken.length ||
      !crypto.timingSafeEqual(Buffer.from(setupToken), Buffer.from(bootstrapToken))) {
    return res.status(403).json({ success: false, message: 'Token setup tidak valid. Ambil token dari konsol server.' });
  }
  if (!/^[A-Za-z0-9_-]{1,5}$/.test(KdUser) || !Nmuser || Nmuser.length > 20 || password.length < 3) {
    return res.status(400).json({ success: false, message: 'Kode kasir maks. 5 karakter, nama maks. 20 karakter, dan password minimal 3 karakter.' });
  }

  try {
    const authUsers = await query('SELECT KdUser FROM pos_auth LIMIT 1');
    if (authUsers.length) return res.status(409).json({ success: false, message: 'Setup admin sudah dilakukan.' });
    const legacyUser = await query('SELECT KdUser FROM kunci WHERE KdUser = ? LIMIT 1', [KdUser]);
    if (legacyUser.length) await query('UPDATE kunci SET Nmuser = ? WHERE KdUser = ?', [Nmuser, KdUser]);
    else await query('INSERT INTO kunci (KdUser, Nmuser) VALUES (?, ?)', [KdUser, Nmuser]);

    const PasswordHash = await hashPassword(password);
    await query('INSERT INTO pos_auth (KdUser, Nmuser, PasswordHash, Role, IsActive) VALUES (?, ?, ?, ?, ?)',
      [KdUser, Nmuser, PasswordHash, 'admin', 'Y']);
    bootstrapToken = '';
    const user = { KdUser, Nmuser, Role: 'admin' };
    await createSession(res, user);
    res.json({ success: true, message: 'Admin pertama berhasil dibuat.', user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat admin pertama: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const KdUser = String(req.body.KdUser || '').trim();
  const password = String(req.body.password || '');
  try {
    const rows = await query(`SELECT a.KdUser, a.Nmuser, a.PasswordHash, a.Role, a.IsActive
      FROM pos_auth a WHERE a.KdUser = ? LIMIT 1`, [KdUser]);
    const user = rows[0];
    if (!user || user.IsActive !== 'Y' || !(await verifyPassword(password, user.PasswordHash))) {
      return res.status(401).json({ success: false, message: 'Kode user atau password salah.' });
    }
    await createSession(res, user);
    res.json({ success: true, user: { KdUser: user.KdUser, Nmuser: user.Nmuser, Role: user.Role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login gagal diproses.' });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    const data = await query("SELECT KdUser, Nmuser FROM pos_auth WHERE IsActive = 'Y' ORDER BY Nmuser ASC");
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar user login.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getSessionUser(readSessionToken(req));
    if (!user) return res.status(401).json({ success: false, message: 'Belum login.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memeriksa sesi.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = readSessionToken(req);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await query('DELETE FROM pos_sessions WHERE TokenHash = ?', [tokenHash]);
    }
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (err) {
    clearSessionCookie(res);
    res.status(500).json({ success: false, message: 'Gagal mengakhiri sesi.' });
  }
});

app.get('/api/users', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const data = await query('SELECT KdUser, Nmuser, Role, IsActive FROM pos_auth ORDER BY Nmuser ASC');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil user.' });
  }
});

app.post('/api/users', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const KdUser = String(req.body.KdUser || '').trim();
  const Nmuser = String(req.body.Nmuser || '').trim();
  const password = String(req.body.password || '');
  const Role = String(req.body.Role || 'kasir');
  if (!/^[A-Za-z0-9_-]{1,5}$/.test(KdUser) || !Nmuser || Nmuser.length > 20 || password.length < 3 || !['admin', 'bos', 'kasir', 'gudang'].includes(Role)) {
    return res.status(400).json({ success: false, message: 'Kode user maks. 5 karakter, nama maks. 20 karakter, password minimal 3 karakter, dan role harus valid.' });
  }
  try {
    const existing = await query('SELECT KdUser FROM pos_auth WHERE KdUser = ? LIMIT 1', [KdUser]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Kode user sudah memiliki login.' });
    const legacyUser = await query('SELECT KdUser FROM kunci WHERE KdUser = ? LIMIT 1', [KdUser]);
    if (legacyUser.length) await query('UPDATE kunci SET Nmuser = ? WHERE KdUser = ?', [Nmuser, KdUser]);
    else await query('INSERT INTO kunci (KdUser, Nmuser) VALUES (?, ?)', [KdUser, Nmuser]);
    const PasswordHash = await hashPassword(password);
    await query('INSERT INTO pos_auth (KdUser, Nmuser, PasswordHash, Role, IsActive) VALUES (?, ?, ?, ?, ?)',
      [KdUser, Nmuser, PasswordHash, Role, 'Y']);
    res.json({ success: true, message: 'User berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah user.' });
  }
});

app.put('/api/users/:kdUser', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const KdUser = String(req.params.kdUser || '').trim();
  const Nmuser = String(req.body.Nmuser || '').trim();
  const Role = String(req.body.Role || 'kasir');
  const IsActive = req.body.IsActive === 'N' ? 'N' : 'Y';
  const password = String(req.body.password || '');
  if (!Nmuser || Nmuser.length > 20 || !['admin', 'bos', 'kasir', 'gudang'].includes(Role) || (password && password.length < 3)) {
    return res.status(400).json({ success: false, message: 'Nama maks. 20 karakter, role harus valid, dan password baru minimal 3 karakter.' });
  }
  try {
    const rows = await query('SELECT Role, IsActive FROM pos_auth WHERE KdUser = ? LIMIT 1', [KdUser]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    const changingLastAdmin = ['admin', 'bos'].includes(rows[0].Role) && rows[0].IsActive === 'Y' && (!['admin', 'bos'].includes(Role) || IsActive !== 'Y');
    if (changingLastAdmin) {
      const admins = await query("SELECT KdUser FROM pos_auth WHERE Role IN ('admin', 'bos') AND IsActive = 'Y'");
      if (admins.length <= 1) return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan atau menurunkan satu-satunya admin.' });
    }

    await query('UPDATE pos_auth SET Nmuser = ?, Role = ?, IsActive = ? WHERE KdUser = ?', [Nmuser, Role, IsActive, KdUser]);
    await query('UPDATE kunci SET Nmuser = ? WHERE KdUser = ?', [Nmuser, KdUser]);
    if (password) {
      const PasswordHash = await hashPassword(password);
      await query('UPDATE pos_auth SET PasswordHash = ? WHERE KdUser = ?', [PasswordHash, KdUser]);
      const token = readSessionToken(req);
      const currentHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
      await query('DELETE FROM pos_sessions WHERE KdUser = ? AND TokenHash <> ?', [KdUser, currentHash]);
    }
    if (IsActive === 'N') await query('DELETE FROM pos_sessions WHERE KdUser = ?', [KdUser]);
    res.json({ success: true, message: 'User berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui user.' });
  }
});

app.delete('/api/users/:kdUser', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const KdUser = String(req.params.kdUser || '').trim();
  try {
    if (KdUser === req.user.KdUser) return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun yang sedang dipakai.' });
    const rows = await query('SELECT Role, IsActive FROM pos_auth WHERE KdUser = ? LIMIT 1', [KdUser]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    if (['admin', 'bos'].includes(rows[0].Role) && rows[0].IsActive === 'Y') {
      const admins = await query("SELECT KdUser FROM pos_auth WHERE Role IN ('admin', 'bos') AND IsActive = 'Y'");
      if (admins.length <= 1) return res.status(400).json({ success: false, message: 'Tidak dapat menghapus satu-satunya admin.' });
    }
    await query('DELETE FROM pos_sessions WHERE KdUser = ?', [KdUser]);
    await query('DELETE FROM pos_auth WHERE KdUser = ?', [KdUser]);
    res.json({ success: true, message: 'User berhasil dihapus. Riwayat transaksinya tetap tersimpan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus user.' });
  }
});

// Rekonsiliasi kas kasir: uang sistem vs uang real yang disetor, selisih diakumulasi per kasir.
async function cashierSettlementRows(dateFrom, dateTo, cashier) {
  const kWhere = cashier ? ' AND KdUser = ?' : '';
  const jWhere = cashier ? ' AND kdkasir = ?' : '';
  const kp = cashier ? [dateFrom, dateTo, cashier] : [dateFrom, dateTo];
  const [sales, cash, saved] = await Promise.all([
    query(`SELECT DATE_FORMAT(tglfak, '%Y-%m-%d') AS Tgl, kdkasir AS KdUser, COUNT(*) AS Trx, SUM(GTotal) AS Penjualan
      FROM jual WHERE tglfak BETWEEN ? AND ? AND KOND = '1'${jWhere} GROUP BY tglfak, kdkasir`, kp),
    query(`SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, KdUser, (Awal + Masuk - Keluar - Batal) AS Saldo
      FROM kasjual WHERE Tgl BETWEEN ? AND ?${kWhere}`, kp),
    query(`SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, KdUser, Sistem, Uang, Selisih, Ket FROM pos_setoran
      WHERE Tgl BETWEEN ? AND ?${kWhere}`, kp)
  ]);
  const map = new Map();
  const row = (Tgl, KdUser) => {
    const key = Tgl + '|' + KdUser;
    if (!map.has(key)) map.set(key, { Tgl, KdUser, Trx: 0, Penjualan: 0, Sistem: 0, Uang: null, Selisih: null, Ket: null, Tercatat: false });
    return map.get(key);
  };
  sales.forEach(x => { const r = row(x.Tgl, x.KdUser); r.Trx = Number(x.Trx); r.Penjualan = Number(x.Penjualan); r.Sistem = Number(x.Penjualan); });
  cash.forEach(x => { row(x.Tgl, x.KdUser).Sistem = Number(x.Saldo); });
  saved.forEach(x => { const r = row(x.Tgl, x.KdUser); r.Uang = Number(x.Uang); r.Selisih = Number(x.Selisih); r.Ket = x.Ket; r.Tercatat = true; });
  return [...map.values()].sort((a, b) => b.Tgl.localeCompare(a.Tgl) || a.KdUser.localeCompare(b.KdUser));
}

// Kasir melapor sendiri uang real yang diterima (hanya untuk akunnya sendiri).
app.get('/api/setoran/saya', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = String(req.query.from || today), to = String(req.query.to || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }
    const data = await cashierSettlementRows(from, to, req.user.KdUser);
    const [total] = await query(`SELECT COUNT(*) AS Hari, IFNULL(SUM(Selisih), 0) AS Total,
      IFNULL(SUM(CASE WHEN Selisih < 0 THEN Selisih ELSE 0 END), 0) AS Minus,
      IFNULL(SUM(CASE WHEN Selisih > 0 THEN Selisih ELSE 0 END), 0) AS Plus FROM pos_setoran WHERE KdUser = ?`, [req.user.KdUser]);
    res.json({ success: true, from, to, data, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil setoran: ' + err.message });
  }
});

app.put('/api/setoran/saya', async (req, res) => {
  const Tgl = String(req.body.Tgl || '');
  const Uang = Number(req.body.Uang);
  const Ket = String(req.body.Ket || '').trim().slice(0, 100) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(Tgl) || !Number.isFinite(Uang) || Uang < 0) {
    return res.status(400).json({ success: false, message: 'Tanggal dan uang real (>= 0) wajib valid.' });
  }
  const age = (Date.now() - new Date(Tgl + 'T00:00:00Z').getTime()) / 86400000;
  if (age > 2 || age < -1) return res.status(400).json({ success: false, message: 'Kasir hanya dapat melapor untuk hari ini atau kemarin.' });
  try {
    const KdUser = req.user.KdUser;
    const existing = await query('SELECT DicatatOleh FROM pos_setoran WHERE Tgl = ? AND KdUser = ? LIMIT 1', [Tgl, KdUser]);
    if (existing.length && existing[0].DicatatOleh !== KdUser) {
      return res.status(403).json({ success: false, message: 'Setoran ini sudah dikonfirmasi admin dan tidak dapat diubah kasir.' });
    }
    const [row] = (await cashierSettlementRows(Tgl, Tgl, KdUser)).filter(r => r.Tgl === Tgl && r.KdUser === KdUser);
    const Sistem = row ? row.Sistem : 0;
    const Selisih = Math.round((Uang - Sistem) * 100) / 100;
    await query('DELETE FROM pos_setoran WHERE Tgl = ? AND KdUser = ?', [Tgl, KdUser]);
    await query(`INSERT INTO pos_setoran (Tgl, KdUser, Sistem, Uang, Selisih, Ket, DicatatOleh, DicatatPada)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [Tgl, KdUser, Sistem, Uang, Selisih, Ket, KdUser]);
    res.json({ success: true, message: 'Laporan uang tersimpan.', Sistem, Selisih });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan laporan: ' + err.message });
  }
});

app.get('/api/setoran', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = String(req.query.from || today);
    const dateTo = String(req.query.to || today);
    const cashier = String(req.query.kasir || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }
    const [data, totals, users] = await Promise.all([
      cashierSettlementRows(dateFrom, dateTo, cashier),
      query(`SELECT p.KdUser, COALESCE(a.Nmuser, p.KdUser) AS Nmuser, COUNT(*) AS Hari, SUM(p.Selisih) AS Total,
          SUM(CASE WHEN p.Selisih < 0 THEN p.Selisih ELSE 0 END) AS Minus, SUM(CASE WHEN p.Selisih > 0 THEN p.Selisih ELSE 0 END) AS Plus
        FROM pos_setoran p LEFT JOIN pos_auth a ON a.KdUser = p.KdUser GROUP BY p.KdUser, Nmuser ORDER BY Total ASC`),
      query('SELECT KdUser, Nmuser FROM pos_auth ORDER BY Nmuser')
    ]);
    const names = Object.fromEntries(users.map(u => [u.KdUser, u.Nmuser]));
    data.forEach(r => { r.Nmuser = names[r.KdUser] || r.KdUser; });
    res.json({ success: true, from: dateFrom, to: dateTo, data, totals, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil setoran kasir: ' + err.message });
  }
});

app.put('/api/setoran', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const Tgl = String(req.body.Tgl || '');
  const KdUser = String(req.body.KdUser || '').trim();
  const Uang = Number(req.body.Uang);
  const Ket = String(req.body.Ket || '').trim().slice(0, 100) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(Tgl) || !KdUser || !Number.isFinite(Uang) || Uang < 0) {
    return res.status(400).json({ success: false, message: 'Tanggal, kasir, dan uang real (>= 0) wajib valid.' });
  }
  try {
    const [row] = (await cashierSettlementRows(Tgl, Tgl, KdUser)).filter(r => r.Tgl === Tgl && r.KdUser === KdUser);
    const Sistem = row ? row.Sistem : 0;
    const Selisih = Math.round((Uang - Sistem) * 100) / 100;
    await query('DELETE FROM pos_setoran WHERE Tgl = ? AND KdUser = ?', [Tgl, KdUser]);
    await query(`INSERT INTO pos_setoran (Tgl, KdUser, Sistem, Uang, Selisih, Ket, DicatatOleh, DicatatPada)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [Tgl, KdUser, Sistem, Uang, Selisih, Ket, req.user.KdUser]);
    res.json({ success: true, message: 'Setoran dicatat.', Sistem, Selisih });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan setoran: ' + err.message });
  }
});

app.delete('/api/setoran', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const Tgl = String(req.query.Tgl || ''), KdUser = String(req.query.KdUser || '').trim();
  try {
    await query('DELETE FROM pos_setoran WHERE Tgl = ? AND KdUser = ?', [Tgl, KdUser]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus setoran.' });
  }
});

async function findBarcodeDuplicate(barcode, excludeKdBar) {
  if (!barcode) return null;

  const excludeSql = excludeKdBar ? ' AND KdBar <> ?' : '';
  const params = excludeKdBar ? [barcode, excludeKdBar] : [barcode];
  const rows = await query(`
    SELECT KdBar, Barcode, KdKel, Nmbar, SatKecil, HBeli, HJual, StAwal, RAK, KDSUPP, WARNA, UKURAN
    FROM stock
    WHERE Barcode = ?${excludeSql}
    LIMIT 1
  `, params);

  return rows[0] || null;
}

async function generateNextKdBar(kdKel) {
  const rows = await query('SELECT KdBar FROM stock WHERE KdKel = ?', [kdKel]);
  let maxNumber = 0;
  let numberWidth = 3;

  rows.forEach(row => {
    const code = String(row.KdBar || '');
    if (!code.startsWith(kdKel)) return;

    const suffix = code.slice(kdKel.length);
    if (!/^\d+$/.test(suffix)) return;

    const number = Number(suffix);
    if (number > maxNumber) {
      maxNumber = number;
      numberWidth = Math.max(3, suffix.length);
    } else if (number === maxNumber) {
      numberWidth = Math.max(numberWidth, suffix.length);
    }
  });

  return `${kdKel}${String(maxNumber + 1).padStart(numberWidth, '0')}`;
}

// 1. GET /api/options - Ambil opsi unik KdKel dan RAK untuk dropdown filter
app.get('/api/options', async (req, res) => {
  try {
    const kelRows = await query('SELECT KDKEL, NMKEL FROM kelompok ORDER BY NMKEL ASC');
    const stockKelRows = await query("SELECT DISTINCT KdKel FROM stock WHERE KdKel IS NOT NULL AND KdKel != '' ORDER BY KdKel ASC");
    const rakRows = await query('SELECT DISTINCT RAK FROM stock WHERE RAK IS NOT NULL AND RAK != "" ORDER BY RAK ASC');

    const kelompokNama = Object.fromEntries(kelRows.map(r => [r.KDKEL, r.NMKEL]));
    // Gabungkan kode dari master kelompok dan kode yang sudah dipakai barang, agar tidak ada kode yang hilang dari filter
    const kelompokCodes = new Set([...kelRows.map(r => r.KDKEL), ...stockKelRows.map(r => r.KdKel)]);
    const kelompok = [...kelompokCodes].sort((a, b) => (kelompokNama[a] || a).localeCompare(kelompokNama[b] || b));

    res.json({
      success: true,
      kelompok,
      kelompokNama,
      rak: rakRows.map(r => r.RAK)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil opsi filter: ' + err.message });
  }
});

app.get('/api/cari-barang', async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    if (!search) return res.json({ success: true, data: [] });

    const pattern = `%${search}%`;
    const data = await query(`
            SELECT s.KdBar, s.Barcode, s.Nmbar, s.Satkecil AS SatKecil, s.HBeli, s.HPokok, s.HJual,
              s.StAwal, s.StMasuk, s.StKeluar, s.KdKel,
              (s.StAwal + IFNULL(s.StMasuk, 0) - s.StKeluar) AS Stok,
             k.NMKEL AS NmKel
      FROM stock s LEFT JOIN kelompok k ON k.KDKEL = s.KdKel
      WHERE s.KdBar LIKE ? OR s.Barcode LIKE ? OR s.Nmbar LIKE ?
      ORDER BY s.Nmbar ASC LIMIT 30
    `, [pattern, pattern, pattern]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mencari barang: ' + err.message });
  }
});

app.get('/api/kode-barang-berikutnya', async (req, res) => {
  try {
    const kdKel = String(req.query.kdKel || '').trim();
    if (!kdKel) {
      return res.status(400).json({ success: false, message: 'Kelompok barang wajib dipilih.' });
    }

    const KdBar = await generateNextKdBar(kdKel);
    res.json({ success: true, KdBar });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat kode barang: ' + err.message });
  }
});

// 2. GET /api/barang - Ambil daftar barang dengan Search, Filter, & Pagination
app.get('/api/barang', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { searchName, searchBarcode, searchKdBar, filterKdKel, filterRak } = req.query;

    let whereClauses = [];
    let params = [];

    if (searchName) {
      whereClauses.push('Nmbar LIKE ?');
      params.push(`%${searchName}%`);
    }
    if (searchBarcode) {
      whereClauses.push('Barcode LIKE ?');
      params.push(`%${searchBarcode}%`);
    }
    if (searchKdBar) {
      whereClauses.push('KdBar LIKE ?');
      params.push(`%${searchKdBar}%`);
    }
    if (filterKdKel) {
      whereClauses.push('KdKel = ?');
      params.push(filterKdKel);
    }
    if (filterRak) {
      whereClauses.push('RAK = ?');
      params.push(filterRak);
    }

    // Filter per kolom: teks (LIKE) dan rentang angka (min/max)
    const textColumns = { filterSatuan: 'SatKecil', filterSupplier: 'KDSUPP' };
    Object.entries(textColumns).forEach(([key, column]) => {
      const value = String(req.query[key] || '').trim();
      if (value) {
        whereClauses.push(`${column} LIKE ?`);
        params.push(`%${value}%`);
      }
    });
    const numericColumns = {
      HBeli: 'HBeli',
      HJual: 'HJual',
      Markup: '(CASE WHEN HBeli > 0 THEN ((HJual - HBeli) / HBeli * 100) ELSE 0 END)',
      Stok: '(StAwal + IFNULL(StMasuk, 0) - StKeluar)'
    };
    Object.entries(numericColumns).forEach(([name, expression]) => {
      [['Min', '>='], ['Max', '<=']].forEach(([bound, operator]) => {
        const raw = req.query[`filter${name}${bound}`];
        if (raw === undefined || String(raw).trim() === '') return;
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        whereClauses.push(`${expression} ${operator} ?`);
        params.push(value);
      });
    });

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Urutan kolom: hanya kolom dalam daftar putih yang boleh dipakai
    const sortColumns = {
      KdBar: 'KdBar', Barcode: 'Barcode', Nmbar: 'Nmbar', KdKel: 'KdKel', SatKecil: 'SatKecil',
      HBeli: 'HBeli', HJual: 'HJual', Markup: 'markup', Stok: 'Stok', RAK: 'RAK', KDSUPP: 'KDSUPP'
    };
    const sortColumn = sortColumns[req.query.sortBy] || 'KdBar';
    const sortDirection = String(req.query.sortDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const orderSql = `ORDER BY ${sortColumn} ${sortDirection}` + (sortColumn === 'KdBar' ? '' : ', KdBar ASC');

    // Hitung Total Data
    const countSql = `SELECT COUNT(*) as total FROM stock ${whereSql}`;
    const totalResult = await query(countSql, params);
    const totalItems = totalResult[0].total;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Fetch Data
    const dataSql = `
            SELECT KdBar, Barcode, KdKel, Nmbar, SatKecil, HBeli, HJual, StAwal, StMasuk, StKeluar,
              (StAwal + IFNULL(StMasuk, 0) - StKeluar) AS Stok, RAK, KDSUPP, WARNA, UKURAN,
              CASE WHEN HBeli > 0 THEN ((HJual - HBeli) / HBeli * 100) ELSE 0 END AS markup
      FROM stock
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const data = await query(dataSql, dataParams);

    res.json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal fetching data barang: ' + err.message });
  }
});

// 3. POST /api/barang - Tambah barang baru
app.post('/api/barang', async (req, res) => {
  try {
    let { KdBar, Barcode, KdKel, Nmbar, SatKecil, HBeli, HJual, StAwal, RAK, KDSUPP, WARNA, UKURAN } = req.body;

    if (!Nmbar) {
      return res.status(400).json({ success: false, message: 'Nama Barang (Nmbar) wajib diisi!' });
    }

    KdKel = (KdKel || 'UM').trim();

    if (!KdBar) {
      KdBar = await generateNextKdBar(KdKel);
    }

    const duplicate = await findBarcodeDuplicate(Barcode, KdBar);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Barcode sudah digunakan oleh ${duplicate.KdBar} (${duplicate.Nmbar}).`,
        duplicate
      });
    }

    const sql = `
      INSERT INTO stock (KdBar, Barcode, KdKel, Nmbar, SatKecil, HBeli, HPokok, HJual, StAwal, RAK, KDSUPP, WARNA, UKURAN)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(sql, [
      KdBar, Barcode || null, KdKel || 'UM', Nmbar, SatKecil || 'PCS',
      HBeli || 0, HBeli || 0, HJual || 0, StAwal || 0, RAK || '', KDSUPP || '',
      WARNA || '', UKURAN || ''
    ]);

    res.json({ success: true, message: `Barang berhasil ditambahkan dengan kode ${KdBar}.`, KdBar });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah barang: ' + err.message });
  }
});

app.post('/api/penjualan', async (req, res) => {
  const { items, KdCust = null, Disc = 0, Ppn = 0, paymentMethod = 'cash', cashReceived } = req.body;
  const date = String(req.body.TglFak || new Date().toISOString().slice(0, 10));
  const cashier = hasManagerRole(req.user) ? String(req.body.KdKasir || req.user.KdUser).trim() : req.user.KdUser;
  let memberDetails = null;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Keranjang masih kosong.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !cashier || cashier.length > 5) {
    return res.status(400).json({ success: false, message: 'Tanggal atau kode kasir tidak valid.' });
  }

  try {
    const cashierRows = await query('SELECT KdUser FROM kunci WHERE KdUser = ? LIMIT 1', [cashier]);
    if (!cashierRows.length) return res.status(400).json({ success: false, message: 'Kode kasir tidak ditemukan.' });
    if (KdCust) {
      const memberRows = await query('SELECT KdAng, MASAAKTIF, GGantung, Plafon, Disc FROM anggota WHERE KdAng = ? LIMIT 1', [String(KdCust).trim()]);
      if (!memberRows.length || memberRows[0].MASAAKTIF === 'N') return res.status(400).json({ success: false, message: 'Anggota tidak ditemukan atau nonaktif.' });
      memberDetails = memberRows[0];
    }
    if (paymentMethod === 'credit' && !memberDetails) {
      return res.status(400).json({ success: false, message: 'Penjualan kredit wajib memilih anggota.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memvalidasi kasir: ' + err.message });
  }

  const discountPercent = Number(req.body.Disc === undefined ? (memberDetails?.Disc || 0) : Disc);
  const taxPercent = 0;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100 ||
      !['cash', 'edc', 'qris', 'credit'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Diskon, PPN, atau metode pembayaran tidak valid.' });
  }

  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const modifiedStock = [];
  let invoice = null;
  let cardWritten = false;
  let cashWritten = false;
  let receivableWritten = false;
  let memberTotalsWritten = false;
  let cashAmount = 0;
  let creditBalance = 0;

  try {
    const requestedByCode = new Map();
    const priceOverrideByCode = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const qty = Number(item.Qty);
      if (!kdBar || !Number.isFinite(qty) || qty <= 0 || Math.round(qty * 1000) / 1000 !== qty) {
        return res.status(400).json({ success: false, message: 'Kode barang dan jumlah harus valid (maksimal 3 angka desimal).' });
      }
      requestedByCode.set(kdBar, (requestedByCode.get(kdBar) || 0) + qty);
      // Kasir boleh menimpa harga jual per baris karena harga sayur sering berubah harian
      if (item.HJual !== undefined && item.HJual !== null && item.HJual !== '') {
        const price = Number(item.HJual);
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ success: false, message: `Harga jual ${kdBar} tidak valid.` });
        }
        priceOverrideByCode.set(kdBar, price);
      }
    }

    const products = [];
    let subtotal = 0;
    for (const [kdBar, qty] of requestedByCode) {
      const rows = await query(`
        SELECT KdBar, Barcode, Nmbar, Satkecil, HBeli, HPokok, HJual, StAwal, StMasuk, StKeluar
        FROM stock WHERE KdBar = ? LIMIT 1
      `, [kdBar]);
      const product = rows[0];
      if (!product) return res.status(404).json({ success: false, message: `Barang ${kdBar} tidak ditemukan.` });

      // Stok kosong tetap boleh dijual; stok akan menjadi minus.

      if (priceOverrideByCode.has(kdBar)) product.HJual = priceOverrideByCode.get(kdBar);
      const lineTotal = roundMoney(qty * Number(product.HJual || 0));
      subtotal = roundMoney(subtotal + lineTotal);
      products.push({ ...product, qty, lineTotal });
    }

    const discountAmount = roundMoney(subtotal * discountPercent / 100);
    let taxAmount = 0;
    let discountAllocated = 0;
    const details = products.map((product, index) => {
      const lineDiscount = index === products.length - 1
        ? roundMoney(discountAmount - discountAllocated)
        : roundMoney(product.lineTotal * discountPercent / 100);
      discountAllocated = roundMoney(discountAllocated + lineDiscount);
      const taxableAmount = roundMoney(product.lineTotal - lineDiscount);
      const lineTax = roundMoney(taxableAmount * taxPercent / 100);
      taxAmount = roundMoney(taxAmount + lineTax);
      return { ...product, amount: roundMoney(taxableAmount + lineTax) };
    });
    const grandTotal = roundMoney(subtotal - discountAmount + taxAmount);
    let received = grandTotal;
    if (paymentMethod === 'cash') {
      received = Number(cashReceived ?? grandTotal);
      if (!Number.isFinite(received) || received < grandTotal) {
        return res.status(400).json({ success: false, message: 'Uang tunai kurang dari total belanja.' });
      }
      cashAmount = grandTotal;
    } else if (paymentMethod === 'credit') {
      received = Number(cashReceived ?? 0);
      if (!Number.isFinite(received) || received < 0 || received > grandTotal) {
        return res.status(400).json({ success: false, message: 'Pembayaran awal kredit harus antara Rp0 dan total belanja.' });
      }
      creditBalance = roundMoney(grandTotal - received);
      cashAmount = received;
      const currentBalance = Number(memberDetails.GGantung || 0);
      const creditLimit = Number(memberDetails.Plafon || 0);
      if (creditBalance > 0 && currentBalance + creditBalance > creditLimit + 0.000001) {
        return res.status(409).json({ success: false, message: `Kredit melewati plafon anggota. Sisa plafon: ${roundMoney(creditLimit - currentBalance)}.` });
      }
    }

    const invoiceRows = await query('SELECT nofak FROM jual WHERE tglfak = ? AND kdkasir = ?', [date, cashier]);
    let highestInvoice = 0;
    invoiceRows.forEach(row => {
      const value = Number(row.nofak);
      if (Number.isInteger(value) && value > highestInvoice) highestInvoice = value;
    });
    invoice = String(highestInvoice + 1);

    await query(`
      INSERT INTO jual (nofak, tglfak, kdkasir, jam, total, ppn, Disc, DiscRp, GTotal, KdCust, KOND, KDANG)
      VALUES (?, ?, ?, CURTIME(), ?, ?, ?, ?, ?, ?, '1', ?)
    `, [invoice, date, cashier, subtotal, taxAmount, discountPercent, discountAmount, grandTotal, KdCust || null, KdCust || '.']);
    for (const item of details) {
      await query(`
        INSERT INTO djual (nofak, TglFak, KdKasir, KdBar, Barcode, NmBar, Satuan, Qty, Qtyz, Hbeli, HPokok, HJual, HJualz, Disc, Ppn, Jumlah, KOND, KDANG, Disc2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?, '1', ?, 0)
      `, [invoice, date, cashier, item.KdBar, item.Barcode, item.Nmbar, item.Satkecil, item.qty, item.HBeli || 0, item.HPokok || 0, item.HJual || 0, discountPercent, taxPercent, item.amount, KdCust || '.']);

      await query('UPDATE stock SET StKeluar = StKeluar + ? WHERE KdBar = ?', [item.qty, item.KdBar]);
      modifiedStock.push(item);
      await query(`INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang)
        VALUES (?, ?, ?, ?, 'O', 'JUAL', '0')`, [item.KdBar, date, invoice, item.qty]);
    }

    if (memberDetails) {
      await query('UPDATE anggota SET Jual = IFNULL(Jual, 0) + ?, Lunas = IFNULL(Lunas, 0) + ?, GGantung = IFNULL(GGantung, 0) + ? WHERE KdAng = ?',
        [grandTotal, received, creditBalance, memberDetails.KdAng]);
      memberTotalsWritten = true;
      if (creditBalance > 0) {
        const ledgerId = `C-${date.replace(/-/g, '')}-${cashier}-${invoice}`;
        await query(`INSERT INTO pos_piutang (NoBukti, KdAng, Tgl, NoFak, KdUser, Debit, Kredit, Ket)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'PENJUALAN KREDIT')`,
        [ledgerId, memberDetails.KdAng, date, invoice, cashier, creditBalance]);
        receivableWritten = true;
      }
    }

    if (paymentMethod === 'edc' || paymentMethod === 'qris') {
      const jenis = paymentMethod === 'qris' ? 'QRIS' : String(req.body.cardType || 'EDC').slice(0, 15);
      await query(`INSERT INTO kakredit (nofak, tglfak, kdkasir, GTotal, BCARD, Jenis, NAMA, NOMOR)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)`, [invoice, date, cashier, grandTotal, jenis, String(req.body.cardName || '').slice(0, 20), String(req.body.cardNumber || '').slice(0, 20)]);
      cardWritten = true;
    } else if (cashAmount > 0) {
      const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
      if (cashRows.length) {
        await query('UPDATE kasjual SET Masuk = Masuk + ? WHERE Tgl = ? AND KdUser = ?', [cashAmount, date, cashier]);
      } else {
        await query(`INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal)
          VALUES (?, ?, 0, ?, 0, 0, 0)`, [date, cashier, cashAmount]);
      }
      cashWritten = true;
    }

    res.json({ success: true, message: `Transaksi ${invoice} berhasil disimpan.`, invoice, subtotal, discountAmount, taxAmount, grandTotal,
      change: paymentMethod === 'cash' ? roundMoney(received - grandTotal) : 0, creditBalance });
  } catch (err) {
    if (invoice) {
      const cleanup = [
        query('DELETE FROM djual WHERE tglfak = ? AND kdkasir = ? AND nofak = ?', [date, cashier, invoice]),
        query('DELETE FROM jual WHERE tglfak = ? AND kdkasir = ? AND nofak = ?', [date, cashier, invoice]),
        query('DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = ?', [date, invoice, 'JUAL'])
      ];
      if (cardWritten) cleanup.push(query('DELETE FROM kakredit WHERE tglfak = ? AND kdkasir = ? AND nofak = ?', [date, cashier, invoice]));
      if (receivableWritten) cleanup.push(query('DELETE FROM pos_piutang WHERE NoBukti = ?', [`C-${date.replace(/-/g, '')}-${cashier}-${invoice}`]));
      if (memberTotalsWritten) cleanup.push(query('UPDATE anggota SET Jual = Jual - ?, Lunas = Lunas - ?, GGantung = GGantung - ? WHERE KdAng = ?', [grandTotal, received, creditBalance, memberDetails.KdAng]));
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Masuk = Masuk - ? WHERE Tgl = ? AND KdUser = ?', [cashAmount, date, cashier]));
      modifiedStock.forEach(item => cleanup.push(query('UPDATE stock SET StKeluar = StKeluar - ? WHERE KdBar = ?', [item.qty, item.KdBar])));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan transaksi parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal menyimpan penjualan: ' + err.message });
  }
});

app.post('/api/penjualan/pending', async (req, res) => {
  const cashier = hasManagerRole(req.user) ? String(req.body.KdKasir || req.user.KdUser).trim() : req.user.KdUser;
  const date = String(req.body.TglFak || new Date().toISOString().slice(0, 10));
  const items = req.body.items;
  const discount = Number(req.body.Disc || 0);
  const taxRate = 0;
  if (!cashier || cashier.length > 5 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(items) || !items.length ||
      !Number.isFinite(discount) || discount < 0 || discount > 100 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return res.status(400).json({ success: false, message: 'Data transaksi tertunda tidak valid.' });
  }

  let invoice = null;
  try {
    const cashierRows = await query('SELECT KdUser FROM kunci WHERE KdUser = ? LIMIT 1', [cashier]);
    if (!cashierRows.length) return res.status(400).json({ success: false, message: 'Kode kasir tidak ditemukan.' });

    const requested = new Map();
    const priceOverride = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const qty = Number(item.Qty);
      if (!kdBar || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ success: false, message: 'Barang atau jumlah tidak valid.' });
      requested.set(kdBar, (requested.get(kdBar) || 0) + qty);
      if (item.HJual !== undefined && item.HJual !== null && item.HJual !== '') {
        const price = Number(item.HJual);
        if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: `Harga jual ${kdBar} tidak valid.` });
        priceOverride.set(kdBar, price);
      }
    }

    const products = [];
    let subtotal = 0;
    for (const [kdBar, qty] of requested) {
      const rows = await query('SELECT KdBar, Barcode, Nmbar, Satkecil, HBeli, HPokok, HJual, StAwal, StMasuk, StKeluar FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
      if (!rows.length) return res.status(404).json({ success: false, message: `Barang ${kdBar} tidak ditemukan.` });
      const item = rows[0];
      if (priceOverride.has(kdBar)) item.HJual = priceOverride.get(kdBar);
      subtotal += qty * Number(item.HJual || 0);
      products.push({ ...item, qty });
    }

    const discountAmount = Math.round(subtotal * discount) / 100;
    const taxAmount = Math.round((subtotal - discountAmount) * taxRate) / 100;
    const grandTotal = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;
    const prefix = `S${date.replace(/-/g, '').slice(2)}${cashier}`;
    const existing = await query('SELECT nofak FROM pending WHERE tglfak = ? AND kdkasir = ?', [date, cashier]);
    let sequence = 0;
    existing.forEach(row => {
      const suffix = Number(String(row.nofak).slice(prefix.length));
      if (String(row.nofak).startsWith(prefix) && Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    invoice = `${prefix}${String(sequence + 1).padStart(3, '0')}`;

    await query(`INSERT INTO pending (nofak, tglfak, kdkasir, jam, total, ppn, Disc, DiscRp, GTotal, KDANG)
      VALUES (?, ?, ?, CURTIME(), ?, ?, ?, ?, ?, '.')`, [invoice, date, cashier, subtotal, taxAmount, discount, discountAmount, grandTotal]);
    for (const item of products) {
      const lineDiscount = item.qty * Number(item.HJual || 0) * discount / 100;
      const amount = item.qty * Number(item.HJual || 0) - lineDiscount;
      await query(`INSERT INTO dpending (nofak, TglFak, KdKasir, KdBar, Barcode, NmBar, Satuan, Qty, Qtyz, Hbeli, HPokok, HJual, HJualz, Disc, Ppn, Jumlah, KdGudang)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?, '0')`,
      [invoice, date, cashier, item.KdBar, item.Barcode, item.Nmbar, item.Satkecil || 'PCS', item.qty, item.HBeli || 0, item.HPokok || 0, item.HJual || 0, discount, taxRate, amount]);
    }
    res.json({ success: true, message: `Transaksi ${invoice} ditunda.`, invoice, grandTotal });
  } catch (err) {
    if (invoice) {
      await Promise.all([
        query('DELETE FROM dpending WHERE nofak = ?', [invoice]).catch(() => {}),
        query('DELETE FROM pending WHERE nofak = ?', [invoice]).catch(() => {})
      ]);
    }
    res.status(500).json({ success: false, message: 'Gagal menunda transaksi: ' + err.message });
  }
});

app.get('/api/penjualan/pending', async (req, res) => {
  try {
    const cashier = hasManagerRole(req.user) ? String(req.query.KdKasir || '').trim() : req.user.KdUser;
    const whereSql = cashier ? 'WHERE kdkasir = ?' : '';
    const data = await query(`SELECT nofak, tglfak, kdkasir, jam, GTotal FROM pending ${whereSql} ORDER BY tglfak DESC, jam DESC`, cashier ? [cashier] : []);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil transaksi tertunda: ' + err.message });
  }
});

app.get('/api/penjualan/pending/:nofak', async (req, res) => {
  try {
    const ownerClause = hasManagerRole(req.user) ? '' : ' AND kdkasir = ?';
    const headerParams = hasManagerRole(req.user) ? [req.params.nofak] : [req.params.nofak, req.user.KdUser];
    const headers = await query(`SELECT nofak, tglfak, kdkasir, Disc, ppn FROM pending WHERE nofak = ?${ownerClause} LIMIT 1`, headerParams);
    if (!headers.length) return res.status(404).json({ success: false, message: 'Transaksi tertunda tidak ditemukan.' });
    const header = headers[0];
    const items = await query(`SELECT d.KdBar, d.Qty, d.Disc, d.Ppn, d.HJual, s.Nmbar, s.Barcode, s.Satkecil AS SatKecil,
      (s.StAwal + IFNULL(s.StMasuk, 0) - s.StKeluar) AS Stok
      FROM dpending d LEFT JOIN stock s ON s.KdBar = d.KdBar WHERE d.nofak = ? AND d.TglFak = ? AND d.KdKasir = ?`,
    [header.nofak, header.tglfak, header.kdkasir]);
    res.json({ success: true, data: { ...header, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat transaksi tertunda: ' + err.message });
  }
});

app.delete('/api/penjualan/pending/:nofak', async (req, res) => {
  try {
    const owner = hasManagerRole(req.user) ? null : req.user.KdUser;
    if (owner) {
      await query('DELETE FROM dpending WHERE nofak = ? AND KdKasir = ?', [req.params.nofak, owner]);
      await query('DELETE FROM pending WHERE nofak = ? AND kdkasir = ?', [req.params.nofak, owner]);
    } else {
      await query('DELETE FROM dpending WHERE nofak = ?', [req.params.nofak]);
      await query('DELETE FROM pending WHERE nofak = ?', [req.params.nofak]);
    }
    res.json({ success: true, message: 'Transaksi tertunda dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus transaksi tertunda: ' + err.message });
  }
});

app.get('/api/kasir', async (req, res) => {
  try {
    const data = hasManagerRole(req.user)
      ? await query("SELECT a.KdUser, a.Nmuser FROM pos_auth a WHERE a.IsActive = 'Y' ORDER BY a.Nmuser ASC")
      : await query("SELECT a.KdUser, a.Nmuser FROM pos_auth a WHERE a.IsActive = 'Y' AND a.KdUser = ? ORDER BY a.Nmuser ASC", [req.user.KdUser]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar kasir: ' + err.message });
  }
});

app.get('/api/anggota', async (req, res) => {
  try {
    const data = req.user.Role === 'kasir'
      ? await query('SELECT KdAng, NmAng, Disc, JTempo, Plafon, GGantung, MASAAKTIF FROM anggota WHERE MASAAKTIF IS NULL OR MASAAKTIF <> ? ORDER BY NmAng ASC', ['N'])
      : await query('SELECT KdAng, NmAng, AlAng, kota, Telp, CPerson, Email, Disc, JTempo, Plafon, GGantung, MASAAKTIF FROM anggota ORDER BY NmAng ASC');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil anggota: ' + err.message });
  }
});

app.get('/api/penjualan/recent', async (req, res) => {
  try {
    const ownerSql = hasManagerRole(req.user) ? '' : ' AND j.kdkasir = ?';
    const params = hasManagerRole(req.user) ? [] : [req.user.KdUser];
    const data = await query(`SELECT j.nofak, DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS tglfak, j.kdkasir, j.jam, j.GTotal FROM jual j
      WHERE j.KOND = '1'${ownerSql} ORDER BY j.tglfak DESC, j.jam DESC LIMIT 150`, params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar penjualan.' });
  }
});

app.get('/api/nota/penjualan', async (req, res) => {
  const invoice = String(req.query.nofak || '').trim();
  const date = String(req.query.tglfak || '').trim();
  const cashier = hasManagerRole(req.user) ? String(req.query.kdkasir || '').trim() : req.user.KdUser;
  if (!invoice || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !cashier) return res.status(400).json({ success: false, message: 'Faktur tidak valid.' });
  try {
    const headers = await query(`SELECT j.nofak, DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS tglfak, j.jam, j.kdkasir, COALESCE(a.Nmuser, j.kdkasir) AS NmKasir,
      j.total, j.Disc, j.DiscRp, j.ppn, j.GTotal, j.KOND FROM jual j LEFT JOIN pos_auth a ON a.KdUser = j.kdkasir
      WHERE j.nofak = ? AND j.tglfak = ? AND j.kdkasir = ? LIMIT 1`, [invoice, date, cashier]);
    if (!headers.length) return res.status(404).json({ success: false, message: 'Faktur tidak ditemukan.' });
    const items = await query(`SELECT NmBar, Satuan, Qty, HJual, Jumlah FROM djual WHERE nofak = ? AND TglFak = ? AND KdKasir = ?`, [invoice, date, cashier]);
    res.json({ success: true, data: { ...headers[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat nota penjualan.' });
  }
});

app.get('/api/retur-penjualan/recent', async (req, res) => {
  try {
    const ownerSql = hasManagerRole(req.user) ? '' : ' WHERE KdKasir = ?';
    const params = hasManagerRole(req.user) ? [] : [req.user.KdUser];
    const data = await query(`SELECT NoFak, SourceNoFak, DATE_FORMAT(SourceTgl, '%Y-%m-%d') AS SourceTgl, KdKasir,
      DATE_FORMAT(TglFak, '%Y-%m-%d') AS TglFak, GTotal, Bayar FROM pos_rjual${ownerSql} ORDER BY TglFak DESC, NoFak DESC LIMIT 100`, params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar retur.' });
  }
});

app.get('/api/nota/retur', async (req, res) => {
  const invoice = String(req.query.nofak || '').trim();
  if (!invoice) return res.status(400).json({ success: false, message: 'No. retur tidak valid.' });
  try {
    const ownerSql = hasManagerRole(req.user) ? '' : ' AND r.KdKasir = ?';
    const params = hasManagerRole(req.user) ? [invoice] : [invoice, req.user.KdUser];
    const headers = await query(`SELECT r.NoFak, r.SourceNoFak, DATE_FORMAT(r.SourceTgl, '%Y-%m-%d') AS SourceTgl, r.KdKasir,
      COALESCE(a.Nmuser, r.KdKasir) AS NmKasir, DATE_FORMAT(r.TglFak, '%Y-%m-%d') AS TglFak, r.GTotal, r.Bayar
      FROM pos_rjual r LEFT JOIN pos_auth a ON a.KdUser = r.KdKasir WHERE r.NoFak = ?${ownerSql} LIMIT 1`, params);
    if (!headers.length) return res.status(404).json({ success: false, message: 'Retur tidak ditemukan.' });
    const items = await query(`SELECT d.KdBar, COALESCE(s.Nmbar, d.KdBar) AS NmBar, d.Qty, d.HJual, d.Jumlah
      FROM pos_rdjual d LEFT JOIN stock s ON s.KdBar = d.KdBar WHERE d.NoFak = ?`, [invoice]);
    res.json({ success: true, data: { ...headers[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat nota retur.' });
  }
});

app.get('/api/retur-penjualan/faktur', async (req, res) => {
  const invoice = String(req.query.nofak || '').trim();
  const date = String(req.query.tglfak || '').trim();
  const cashier = hasManagerRole(req.user) ? String(req.query.kdkasir || '').trim() : req.user.KdUser;
  if (!invoice || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !cashier) return res.status(400).json({ success: false, message: 'Faktur penjualan tidak valid.' });
  try {
    const headers = await query("SELECT nofak, DATE_FORMAT(tglfak, '%Y-%m-%d') AS tglfak, kdkasir, GTotal FROM jual WHERE nofak = ? AND tglfak = ? AND kdkasir = ? AND KOND = '1' LIMIT 1", [invoice, date, cashier]);
    if (!headers.length) return res.status(404).json({ success: false, message: 'Faktur penjualan tidak ditemukan.' });
    const items = await query(`SELECT KdBar, MAX(NmBar) AS NmBar, MAX(Barcode) AS Barcode, MAX(Satuan) AS Satuan,
      SUM(Qty) AS Qty, SUM(Jumlah) AS Jumlah FROM djual
      WHERE nofak = ? AND TglFak = ? AND KdKasir = ? AND KOND = '1' GROUP BY KdBar`, [invoice, date, cashier]);
    const returned = await query(`SELECT d.KdBar, SUM(d.Qty) AS Qty FROM pos_rdjual d JOIN pos_rjual r ON r.NoFak = d.NoFak
      WHERE r.SourceNoFak = ? AND r.SourceTgl = ? AND r.KdKasir = ? GROUP BY d.KdBar`, [invoice, date, cashier]);
    const returnedByCode = new Map(returned.map(row => [String(row.KdBar), Number(row.Qty || 0)]));
    res.json({ success: true, data: { ...headers[0], items: items.map(item => ({
      ...item, Qty: Number(item.Qty || 0), QtyReturned: returnedByCode.get(String(item.KdBar)) || 0,
      UnitPrice: Number(item.Qty) ? Number(item.Jumlah) / Number(item.Qty) : 0
    })) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat detail penjualan.' });
  }
});

app.post('/api/retur-penjualan', async (req, res) => {
  const sourceInvoice = String(req.body.SourceNoFak || '').trim();
  const sourceDate = String(req.body.SourceTgl || '').trim();
  const date = String(req.body.TglFak || new Date().toISOString().slice(0, 10));
  const cashier = hasManagerRole(req.user) ? String(req.body.KdKasir || '').trim() : req.user.KdUser;
  const refund = Number(req.body.Bayar || 0);
  const items = req.body.items;
  if (!sourceInvoice || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !cashier || !Array.isArray(items) || !items.length || !Number.isFinite(refund) || refund < 0) {
    return res.status(400).json({ success: false, message: 'Faktur asal, tanggal, barang, atau refund tidak valid.' });
  }

  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  let returnInvoice = null;
  let headerWritten = false;
  let cashWritten = false;
  const changedStocks = [];
  try {
    const sourceHeaders = await query("SELECT nofak FROM jual WHERE nofak = ? AND tglfak = ? AND kdkasir = ? AND KOND = '1' LIMIT 1", [sourceInvoice, sourceDate, cashier]);
    if (!sourceHeaders.length) return res.status(404).json({ success: false, message: 'Faktur penjualan asal tidak ditemukan.' });
    const sourceLines = await query(`SELECT KdBar, MAX(NmBar) AS NmBar, MAX(Barcode) AS Barcode, MAX(Satuan) AS Satuan,
      SUM(Qty) AS Qty, SUM(Jumlah) AS Jumlah FROM djual
      WHERE nofak = ? AND TglFak = ? AND KdKasir = ? AND KOND = '1' GROUP BY KdBar`, [sourceInvoice, sourceDate, cashier]);
    const sourceByCode = new Map(sourceLines.map(row => [String(row.KdBar), row]));
    const returned = await query(`SELECT d.KdBar, SUM(d.Qty) AS Qty FROM pos_rdjual d JOIN pos_rjual r ON r.NoFak = d.NoFak
      WHERE r.SourceNoFak = ? AND r.SourceTgl = ? AND r.KdKasir = ? GROUP BY d.KdBar`, [sourceInvoice, sourceDate, cashier]);
    const returnedByCode = new Map(returned.map(row => [String(row.KdBar), Number(row.Qty || 0)]));
    const requested = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const qty = Number(item.Qty);
      if (!kdBar || !Number.isFinite(qty) || qty <= 0 || qty > 9999.999 || Math.round(qty * 1000) / 1000 !== qty || requested.has(kdBar)) {
        return res.status(400).json({ success: false, message: 'Kode barang harus unik dan qty retur maksimal 3 desimal.' });
      }
      const source = sourceByCode.get(kdBar);
      const remaining = source ? Number(source.Qty) - (returnedByCode.get(kdBar) || 0) : 0;
      if (!source || qty > remaining + 0.000001) return res.status(409).json({ success: false, message: `Qty retur ${kdBar} melebihi sisa dari faktur.` });
      requested.set(kdBar, { qty, source });
    }

    let subtotal = 0;
    const returnItems = [];
    for (const [kdBar, item] of requested) {
      const stockRows = await query('SELECT StKeluar FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
      if (!stockRows.length) return res.status(404).json({ success: false, message: `Barang ${kdBar} tidak ditemukan.` });
      const unitPrice = Number(item.source.Qty) ? Number(item.source.Jumlah) / Number(item.source.Qty) : 0;
      const amount = roundMoney(unitPrice * item.qty);
      subtotal = roundMoney(subtotal + amount);
      returnItems.push({ kdBar, qty: item.qty, source: item.source, stock: stockRows[0], unitPrice, amount });
    }
    if (refund > subtotal) return res.status(400).json({ success: false, message: 'Refund melebihi nilai barang yang diretur.' });

    const prefix = `J${date.replace(/-/g, '').slice(2)}`;
    const previous = await query('SELECT NoFak FROM pos_rjual WHERE NoFak LIKE ?', [`${prefix}%`]);
    let sequence = 0;
    previous.forEach(row => {
      const suffix = Number(String(row.NoFak).slice(prefix.length));
      if (Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    returnInvoice = `${prefix}${String(sequence + 1).padStart(3, '0')}`;
    await query(`INSERT INTO pos_rjual (NoFak, SourceNoFak, SourceTgl, KdKasir, TglFak, Total, PPN, GTotal, Bayar)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`, [returnInvoice, sourceInvoice, sourceDate, cashier, date, subtotal, subtotal, refund]);
    headerWritten = true;

    for (const item of returnItems) {
      await query('INSERT INTO pos_rdjual (NoFak, KdBar, Qty, HJual, Jumlah) VALUES (?, ?, ?, ?, ?)',
        [returnInvoice, item.kdBar, item.qty, item.unitPrice, item.amount]);
      await query('UPDATE stock SET StKeluar = StKeluar - ? WHERE KdBar = ?', [item.qty, item.kdBar]);
      changedStocks.push(item);
      await query("INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang) VALUES (?, ?, ?, ?, 'I', 'RJUAL', '0')",
        [item.kdBar, date, returnInvoice, item.qty]);
    }

    if (refund > 0) {
      const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
      if (cashRows.length) await query('UPDATE kasjual SET Keluar = Keluar + ? WHERE Tgl = ? AND KdUser = ?', [refund, date, cashier]);
      else await query('INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal) VALUES (?, ?, 0, 0, ?, 0, 0)', [date, cashier, refund]);
      cashWritten = true;
    }
    res.json({ success: true, message: `Retur penjualan ${returnInvoice} berhasil.`, NoFak: returnInvoice, GTotal: subtotal, refund });
  } catch (err) {
    if (returnInvoice && headerWritten) {
      const cleanup = [
        query('DELETE FROM pos_rdjual WHERE NoFak = ?', [returnInvoice]),
        query('DELETE FROM pos_rjual WHERE NoFak = ?', [returnInvoice]),
        query("DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = 'RJUAL'", [date, returnInvoice])
      ];
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Keluar = Keluar - ? WHERE Tgl = ? AND KdUser = ?', [refund, date, cashier]));
      changedStocks.forEach(item => cleanup.push(query('UPDATE stock SET StKeluar = StKeluar + ? WHERE KdBar = ?', [item.qty, item.kdBar])));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan retur penjualan parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal menyimpan retur penjualan: ' + err.message });
  }
});

app.post('/api/penjualan/batal', async (req, res) => {
  const invoice = String(req.body.nofak || '').trim();
  const date = String(req.body.tglfak || '').trim();
  const cashier = hasManagerRole(req.user) ? String(req.body.kdkasir || '').trim() : req.user.KdUser;
  if (!invoice || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !cashier) {
    return res.status(400).json({ success: false, message: 'Faktur penjualan tidak valid.' });
  }

  let header = null;
  let headerCancelled = false;
  let cashWritten = false;
  const restoredStocks = [];
  try {
    const headers = await query('SELECT GTotal, KOND FROM jual WHERE nofak = ? AND tglfak = ? AND kdkasir = ? LIMIT 1', [invoice, date, cashier]);
    header = headers[0];
    if (!header) return res.status(404).json({ success: false, message: 'Transaksi penjualan tidak ditemukan.' });
    if (header.KOND !== '1') return res.status(409).json({ success: false, message: 'Transaksi sudah dibatalkan.' });
    const detail = await query(`SELECT KdBar, SUM(Qty) AS Qty FROM djual
      WHERE nofak = ? AND TglFak = ? AND KdKasir = ? AND KOND = '1' GROUP BY KdBar`, [invoice, date, cashier]);
    if (!detail.length) return res.status(409).json({ success: false, message: 'Detail transaksi tidak tersedia.' });

    const cardRows = await query('SELECT nofak FROM kakredit WHERE tglfak = ? AND kdkasir = ? AND nofak = ? LIMIT 1', [date, cashier, Number(invoice)]);
    await query("UPDATE jual SET KOND = '0' WHERE nofak = ? AND tglfak = ? AND kdkasir = ?", [invoice, date, cashier]);
    headerCancelled = true;
    await query("UPDATE djual SET KOND = '0' WHERE nofak = ? AND TglFak = ? AND KdKasir = ?", [invoice, date, cashier]);

    for (const item of detail) {
      const qty = Number(item.Qty);
      await query('UPDATE stock SET StKeluar = StKeluar - ? WHERE KdBar = ?', [qty, item.KdBar]);
      restoredStocks.push({ KdBar: item.KdBar, Qty: qty });
      await query("INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang) VALUES (?, ?, ?, ?, 'I', 'BATAL', '0')",
        [item.KdBar, date, invoice, qty]);
    }

    if (!cardRows.length) {
      const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
      if (cashRows.length) await query('UPDATE kasjual SET Batal = Batal + ? WHERE Tgl = ? AND KdUser = ?', [header.GTotal, date, cashier]);
      else await query('INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal) VALUES (?, ?, 0, 0, 0, 0, ?)', [date, cashier, header.GTotal]);
      cashWritten = true;
    }
    res.json({ success: true, message: cardRows.length
      ? 'Transaksi dibatalkan. Lakukan reversal kartu secara manual di terminal EDC.'
      : 'Transaksi dibatalkan dan stok dipulihkan.', invoice });
  } catch (err) {
    if (headerCancelled) {
      const cleanup = [
        query("UPDATE jual SET KOND = '1' WHERE nofak = ? AND tglfak = ? AND kdkasir = ?", [invoice, date, cashier]),
        query("UPDATE djual SET KOND = '1' WHERE nofak = ? AND TglFak = ? AND KdKasir = ?", [invoice, date, cashier]),
        query("DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = 'BATAL'", [date, invoice])
      ];
      restoredStocks.forEach(item => cleanup.push(query('UPDATE stock SET StKeluar = StKeluar + ? WHERE KdBar = ?', [item.Qty, item.KdBar])));
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Batal = Batal - ? WHERE Tgl = ? AND KdUser = ?', [header.GTotal, date, cashier]));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan pembatalan parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal membatalkan penjualan: ' + err.message });
  }
});

app.get('/api/piutang', async (req, res) => {
  try {
    const ownerSql = req.user.Role === 'kasir' ? 'WHERE p.KdUser = ?' : '';
    const params = req.user.Role === 'kasir' ? [req.user.KdUser] : [];
    const data = await query(`SELECT p.KdAng, a.NmAng, p.NoFak, MIN(p.Tgl) AS Tgl, SUM(p.Debit) AS Total,
      SUM(p.Kredit) AS Paid, SUM(p.Debit) - SUM(p.Kredit) AS Balance
      FROM pos_piutang p LEFT JOIN anggota a ON a.KdAng = p.KdAng ${ownerSql}
      GROUP BY p.KdAng, a.NmAng, p.NoFak
      HAVING Balance > 0
      ORDER BY Tgl ASC, p.KdAng ASC, p.NoFak ASC`, params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar piutang.' });
  }
});

app.post('/api/piutang/bayar', async (req, res) => {
  const KdAng = String(req.body.KdAng || '').trim();
  const NoFak = String(req.body.NoFak || '').trim();
  const date = String(req.body.Tgl || new Date().toISOString().slice(0, 10));
  const amount = Number(req.body.Bayar);
  const cashier = req.user.KdUser;
  if (!KdAng || !NoFak || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Anggota, faktur, tanggal, atau jumlah pelunasan tidak valid.' });
  }

  let paymentNo = null;
  let ledgerWritten = false;
  let memberUpdated = false;
  let cashWritten = false;
  try {
    const balanceRows = await query(`SELECT SUM(Debit) - SUM(Kredit) AS Balance FROM pos_piutang
      WHERE KdAng = ? AND NoFak = ?`, [KdAng, NoFak]);
    const balance = Number(balanceRows[0]?.Balance || 0);
    if (balance <= 0) return res.status(404).json({ success: false, message: 'Piutang tidak ditemukan atau sudah lunas.' });
    if (amount > balance + 0.000001) return res.status(400).json({ success: false, message: `Pembayaran melebihi sisa piutang ${balance}.` });

    const prefix = `L${date.replace(/-/g, '').slice(2)}${cashier}`;
    const existing = await query('SELECT NoBukti FROM pos_piutang WHERE NoBukti LIKE ?', [`${prefix}%`]);
    let sequence = 0;
    existing.forEach(row => {
      const suffix = Number(String(row.NoBukti).slice(prefix.length));
      if (String(row.NoBukti).startsWith(prefix) && Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    paymentNo = `${prefix}${String(sequence + 1).padStart(3, '0')}`;
    await query(`INSERT INTO pos_piutang (NoBukti, KdAng, Tgl, NoFak, KdUser, Debit, Kredit, Ket)
      VALUES (?, ?, ?, ?, ?, 0, ?, 'PELUNASAN PIUTANG')`, [paymentNo, KdAng, date, NoFak, cashier, amount]);
    ledgerWritten = true;
    await query('UPDATE anggota SET GGantung = IFNULL(GGantung, 0) - ?, Lunas = IFNULL(Lunas, 0) + ? WHERE KdAng = ?', [amount, amount, KdAng]);
    memberUpdated = true;

    const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
    if (cashRows.length) await query('UPDATE kasjual SET Masuk = Masuk + ? WHERE Tgl = ? AND KdUser = ?', [amount, date, cashier]);
    else await query('INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal) VALUES (?, ?, 0, ?, 0, 0, 0)', [date, cashier, amount]);
    cashWritten = true;

    res.json({ success: true, message: `Pelunasan ${paymentNo} berhasil dicatat.`, NoBukti: paymentNo, remaining: Math.round((balance - amount) * 100) / 100 });
  } catch (err) {
    if (paymentNo && ledgerWritten) {
      const cleanup = [query('DELETE FROM pos_piutang WHERE NoBukti = ?', [paymentNo])];
      if (memberUpdated) cleanup.push(query('UPDATE anggota SET GGantung = IFNULL(GGantung, 0) + ?, Lunas = Lunas - ? WHERE KdAng = ?', [amount, amount, KdAng]));
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Masuk = Masuk - ? WHERE Tgl = ? AND KdUser = ?', [amount, date, cashier]));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan pelunasan parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal mencatat pelunasan piutang.' });
  }
});

app.post('/api/anggota', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const member = {
    KdAng: String(req.body.KdAng || '').trim(), NmAng: String(req.body.NmAng || '').trim(),
    AlAng: String(req.body.AlAng || '').trim(), kota: String(req.body.kota || '').trim(),
    Telp: String(req.body.Telp || '').trim(), CPerson: String(req.body.CPerson || '').trim(),
    Email: String(req.body.Email || '').trim(), Disc: Number(req.body.Disc || 0),
    JTempo: Number(req.body.JTempo || 0), Plafon: Number(req.body.Plafon || 0)
  };
  if (!member.KdAng || member.KdAng.length > 15 || !member.NmAng || member.NmAng.length > 30 ||
      !Number.isFinite(member.Disc) || member.Disc < 0 || member.Disc > 100 ||
      !Number.isInteger(member.JTempo) || member.JTempo < 0 || !Number.isFinite(member.Plafon) || member.Plafon < 0) {
    return res.status(400).json({ success: false, message: 'Data anggota tidak valid.' });
  }
  try {
    const existing = await query('SELECT KdAng FROM anggota WHERE KdAng = ? LIMIT 1', [member.KdAng]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Kode anggota sudah digunakan.' });
    await query(`INSERT INTO anggota (KdAng, NmAng, AlAng, kota, Telp, CPerson, Email, Disc, JTempo, Plafon, BAWAL, MASAAKTIF)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Y')`,
    [member.KdAng, member.NmAng, member.AlAng || null, member.kota || null, member.Telp || null,
      member.CPerson || null, member.Email || null, member.Disc, member.JTempo, member.Plafon]);
    res.json({ success: true, message: 'Anggota berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah anggota.' });
  }
});

app.put('/api/anggota/:kdAng', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const member = {
    NmAng: String(req.body.NmAng || '').trim(), AlAng: String(req.body.AlAng || '').trim(),
    kota: String(req.body.kota || '').trim(), Telp: String(req.body.Telp || '').trim(),
    CPerson: String(req.body.CPerson || '').trim(), Email: String(req.body.Email || '').trim(),
    Disc: Number(req.body.Disc || 0), JTempo: Number(req.body.JTempo || 0),
    Plafon: Number(req.body.Plafon || 0), MASAAKTIF: req.body.MASAAKTIF === 'N' ? 'N' : 'Y'
  };
  if (!member.NmAng || member.NmAng.length > 30 || !Number.isFinite(member.Disc) || member.Disc < 0 || member.Disc > 100 ||
      !Number.isInteger(member.JTempo) || member.JTempo < 0 || !Number.isFinite(member.Plafon) || member.Plafon < 0) {
    return res.status(400).json({ success: false, message: 'Data anggota tidak valid.' });
  }
  try {
    const existing = await query('SELECT KdAng FROM anggota WHERE KdAng = ? LIMIT 1', [req.params.kdAng]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
    await query(`UPDATE anggota SET NmAng = ?, AlAng = ?, kota = ?, Telp = ?, CPerson = ?, Email = ?,
      Disc = ?, JTempo = ?, Plafon = ?, MASAAKTIF = ? WHERE KdAng = ?`,
    [member.NmAng, member.AlAng || null, member.kota || null, member.Telp || null, member.CPerson || null,
      member.Email || null, member.Disc, member.JTempo, member.Plafon, member.MASAAKTIF, req.params.kdAng]);
    res.json({ success: true, message: 'Data anggota diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui anggota.' });
  }
});

app.get('/api/kelompok', async (req, res) => {
  try {
    const data = await query('SELECT KDKEL, NMKEL FROM kelompok ORDER BY NMKEL ASC');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil kelompok.' });
  }
});

app.post('/api/kelompok', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const KDKEL = String(req.body.KDKEL || '').trim();
  const NMKEL = String(req.body.NMKEL || '').trim();
  if (!KDKEL || KDKEL.length > 4 || !NMKEL || NMKEL.length > 25) return res.status(400).json({ success: false, message: 'Kode kelompok maks. 4 dan nama maks. 25 karakter.' });
  try {
    const existing = await query('SELECT KDKEL FROM kelompok WHERE KDKEL = ? LIMIT 1', [KDKEL]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Kode kelompok sudah digunakan.' });
    await query('INSERT INTO kelompok (KDKEL, NMKEL) VALUES (?, ?)', [KDKEL, NMKEL]);
    res.json({ success: true, message: 'Kelompok berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah kelompok.' });
  }
});

app.put('/api/kelompok/:kdKel', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const NMKEL = String(req.body.NMKEL || '').trim();
  if (!NMKEL || NMKEL.length > 25) return res.status(400).json({ success: false, message: 'Nama kelompok maks. 25 karakter.' });
  try {
    const existing = await query('SELECT KDKEL FROM kelompok WHERE KDKEL = ? LIMIT 1', [req.params.kdKel]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Kelompok tidak ditemukan.' });
    await query('UPDATE kelompok SET NMKEL = ? WHERE KDKEL = ?', [NMKEL, req.params.kdKel]);
    res.json({ success: true, message: 'Kelompok diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui kelompok.' });
  }
});

app.delete('/api/kelompok/:kdKel', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const products = await query('SELECT KdBar FROM stock WHERE KdKel = ? LIMIT 1', [req.params.kdKel]);
    if (products.length) return res.status(409).json({ success: false, message: 'Kelompok masih dipakai barang; ubah kelompok barang terlebih dahulu.' });
    const result = await query('DELETE FROM kelompok WHERE KDKEL = ?', [req.params.kdKel]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Kelompok tidak ditemukan.' });
    res.json({ success: true, message: 'Kelompok dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus kelompok.' });
  }
});

app.get('/api/supplier', async (req, res) => {
  if (!requireRoles(req, res, ['admin', 'bos', 'gudang'])) return;
  try {
    const data = await query('SELECT KdSupp, NmSupp, AlSupp, kota, Telp, CPerson, NPWP, Email, WPage FROM supp ORDER BY NmSupp ASC');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil supplier: ' + err.message });
  }
});

app.post('/api/supplier', async (req, res) => {
  if (!requireRoles(req, res, ['admin', 'bos', 'gudang'])) return;
  try {
    const supplier = {
      KdSupp: String(req.body.KdSupp || '').trim(),
      NmSupp: String(req.body.NmSupp || '').trim(),
      AlSupp: String(req.body.AlSupp || '').trim(),
      kota: String(req.body.kota || '').trim(),
      Telp: String(req.body.Telp || '').trim(),
      CPerson: String(req.body.CPerson || '').trim(),
      NPWP: String(req.body.NPWP || '').trim(),
      Email: String(req.body.Email || '').trim(),
      WPage: String(req.body.WPage || '').trim()
    };
    if (!supplier.KdSupp || !supplier.NmSupp || supplier.KdSupp.length > 15 || supplier.NmSupp.length > 30) {
      return res.status(400).json({ success: false, message: 'Kode supplier dan nama (maks. 30 karakter) wajib diisi.' });
    }
    const existing = await query('SELECT KdSupp FROM supp WHERE KdSupp = ? LIMIT 1', [supplier.KdSupp]);
    if (existing.length) return res.status(409).json({ success: false, message: 'Kode supplier sudah digunakan.' });

    await query(`INSERT INTO supp (KdSupp, NmSupp, AlSupp, kota, Telp, CPerson, NPWP, Email, WPage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplier.KdSupp, supplier.NmSupp, supplier.AlSupp || null, supplier.kota || null, supplier.Telp || null,
      supplier.CPerson || null, supplier.NPWP || null, supplier.Email || null, supplier.WPage || null]);
    res.json({ success: true, message: 'Supplier berhasil ditambahkan.', data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah supplier: ' + err.message });
  }
});

app.put('/api/supplier/:kdSupp', async (req, res) => {
  if (!requireRoles(req, res, ['admin', 'bos', 'gudang'])) return;
  const supplier = {
    NmSupp: String(req.body.NmSupp || '').trim(), AlSupp: String(req.body.AlSupp || '').trim(),
    kota: String(req.body.kota || '').trim(), Telp: String(req.body.Telp || '').trim(),
    CPerson: String(req.body.CPerson || '').trim(), NPWP: String(req.body.NPWP || '').trim(),
    Email: String(req.body.Email || '').trim(), WPage: String(req.body.WPage || '').trim()
  };
  if (!supplier.NmSupp || supplier.NmSupp.length > 30) return res.status(400).json({ success: false, message: 'Nama supplier wajib diisi (maks. 30 karakter).' });
  try {
    const existing = await query('SELECT KdSupp FROM supp WHERE KdSupp = ? LIMIT 1', [req.params.kdSupp]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
    await query(`UPDATE supp SET NmSupp = ?, AlSupp = ?, kota = ?, Telp = ?, CPerson = ?, NPWP = ?, Email = ?, WPage = ? WHERE KdSupp = ?`,
      [supplier.NmSupp, supplier.AlSupp || null, supplier.kota || null, supplier.Telp || null, supplier.CPerson || null,
        supplier.NPWP || null, supplier.Email || null, supplier.WPage || null, req.params.kdSupp]);
    res.json({ success: true, message: 'Supplier diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui supplier.' });
  }
});

app.delete('/api/supplier/:kdSupp', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const referenced = await query('SELECT NoFak FROM beli WHERE KDSUPP = ? LIMIT 1', [req.params.kdSupp]);
    if (referenced.length) return res.status(409).json({ success: false, message: 'Supplier memiliki riwayat pembelian; jangan dihapus agar histori tetap utuh.' });
    const result = await query('DELETE FROM supp WHERE KdSupp = ?', [req.params.kdSupp]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
    res.json({ success: true, message: 'Supplier dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus supplier.' });
  }
});

app.get('/api/pengaturan', async (req, res) => {
  try {
    const isManager = hasManagerRole(req.user);
    const fields = isManager
      ? `NmUsaha, ALUsaha, Kota, Propinsi, Negara, KodePos, NoTelp, Nofax, NPWP, Email, Hpage,
      CetJual, CetBataljual, Cetbeli, Headjual, FootJual, FootJual2, FootJual3, Barcode, FakturAut, QTYJUAL, DISC, PPN
      `
      : `NmUsaha, ALUsaha, Kota, NoTelp, CetJual, Headjual, FootJual, FootJual2, FootJual3, QTYJUAL, DISC, PPN`;
    const rows = await query(`SELECT ${fields} FROM usaha LIMIT 1`);
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan usaha.' });
  }
});

app.put('/api/pengaturan', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const stringLengths = { NmUsaha: 50, ALUsaha: 50, Kota: 50, Propinsi: 50, Negara: 50, KodePos: 20,
    NoTelp: 20, Nofax: 20, NPWP: 20, Email: 50, Hpage: 50, Headjual: 50, FootJual: 50, FootJual2: 50, FootJual3: 50 };
  const values = {};
  let invalidStringLength = false;
  Object.entries(stringLengths).forEach(([field, maxLength]) => {
    const value = String(req.body[field] || '').trim();
    if (value.length > maxLength) invalidStringLength = true;
    values[field] = value || null;
  });
  const tax = Number(req.body.PPN || 0);
  const discount = Number(req.body.DISC || 0);
  const qty = Number(req.body.QTYJUAL || 0);
  if (invalidStringLength ||
      !Number.isFinite(tax) || tax < 0 || tax > 100 || !Number.isFinite(discount) || discount < 0 || discount > 100 ||
      !Number.isInteger(qty) || qty < 0 || qty > 99999) {
    return res.status(400).json({ success: false, message: 'Periksa batas panjang data usaha, diskon, PPN, atau jumlah barang pada struk.' });
  }
  const fields = Object.keys(stringLengths).concat(['CetJual', 'Barcode', 'QTYJUAL', 'DISC', 'PPN']);
  values.CetJual = req.body.CetJual === '1' ? '1' : '0';
  values.Barcode = req.body.Barcode === '1' ? '1' : '0';
  values.QTYJUAL = qty;
  values.DISC = discount;
  values.PPN = tax;
  ['CetBataljual', 'Cetbeli', 'FakturAut'].forEach(field => {
    if (req.body[field] === '0' || req.body[field] === '1') {
      values[field] = req.body[field];
      fields.push(field);
    }
  });
  try {
    const existing = await query('SELECT NmUsaha FROM usaha LIMIT 1');
    const params = fields.map(field => values[field]);
    if (existing.length) {
      await query(`UPDATE usaha SET ${fields.map(field => `${field} = ?`).join(', ')}`, params);
    } else {
      await query(`INSERT INTO usaha (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, params);
    }
    res.json({ success: true, message: 'Pengaturan usaha disimpan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan usaha.' });
  }
});

app.post('/api/pembelian', async (req, res) => {
  const date = String(req.body.TglFak || new Date().toISOString().slice(0, 10));
  const supplier = String(req.body.KDSUPP || '').trim();
  const description = String(req.body.Ket || '').trim();
  const extraCost = Number(req.body.Lain || 0);
  const payment = Number(req.body.Bayar || 0);
  const items = req.body.items;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(items) || items.length === 0 ||
      !Number.isFinite(extraCost) || extraCost < 0 || !Number.isFinite(payment) || payment < 0) {
    return res.status(400).json({ success: false, message: 'Tanggal, barang, biaya tambahan, atau pembayaran tidak valid.' });
  }

  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const modifiedStock = [];
  let invoice = null;
  let headerWritten = false;
  let cashWritten = false;
  try {
    if (supplier) {
      const supplierRows = await query('SELECT KdSupp FROM supp WHERE KdSupp = ? LIMIT 1', [supplier]);
      if (!supplierRows.length) return res.status(404).json({ success: false, message: 'Supplier tidak ditemukan.' });
    }

    const requested = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const qty = Number(item.Qty);
      const unitCost = Number(item.Hbeli);
      const discount = Number(item.Disc || 0);
      if (!kdBar || !Number.isFinite(qty) || qty <= 0 || qty > 9999.999 ||
          !Number.isFinite(unitCost) || unitCost < 0 ||
          !Number.isFinite(discount) || discount < 0 || discount > 100) {
        return res.status(400).json({ success: false, message: 'Kode barang, jumlah, harga beli, atau diskon item tidak valid.' });
      }
      if (requested.has(kdBar)) return res.status(400).json({ success: false, message: `Barang ${kdBar} muncul lebih dari sekali.` });
      requested.set(kdBar, { qty, unitCost, discount });
    }

    const products = [];
    let subtotal = 0;
    for (const [kdBar, item] of requested) {
      const rows = await query('SELECT KdBar, Barcode, Nmbar, Satkecil, HJual, HBeli, HPokok, StMasuk FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
      if (!rows.length) return res.status(404).json({ success: false, message: `Barang ${kdBar} tidak ditemukan.` });
      const product = rows[0];
      const amount = roundMoney(item.qty * item.unitCost * (1 - item.discount / 100));
      subtotal = roundMoney(subtotal + amount);
      products.push({ ...product, ...item, amount });
    }

    const taxRate = Number(req.body.PPNPersen || 0);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return res.status(400).json({ success: false, message: 'Persentase PPN tidak valid.' });
    }
    const taxAmount = roundMoney(subtotal * taxRate / 100);
    const grandTotal = roundMoney(subtotal + taxAmount + extraCost);
    if (payment > grandTotal) return res.status(400).json({ success: false, message: 'Pembayaran melebihi total pembelian.' });

    const prefix = `P${date.replace(/-/g, '').slice(2)}`;
    const invoices = await query('SELECT NoFak FROM beli WHERE NoFak LIKE ?', [`${prefix}%`]);
    let sequence = 0;
    invoices.forEach(row => {
      const suffix = Number(String(row.NoFak).slice(prefix.length));
      if (Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    invoice = `${prefix}${String(sequence + 1).padStart(3, '0')}`;

    await query(`INSERT INTO beli (NoFak, TglFak, Ket, Total, Pot1, PotRp1, Pot2, PotRp2, PPNPersen, PPNRp, GTotal, Bayar, Pos, Lain, KDSUPP)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?, 'N', ?, ?)`,
    [invoice, date, description || null, subtotal, taxRate, taxAmount, grandTotal, payment, extraCost, supplier || null]);
    headerWritten = true;

    for (const item of products) {
      await query(`INSERT INTO dbeli (NoFak, TglFak, KdBar, barcode, NmBar, Satuan, Qty, Qtyz, Hbeli, Disc, Jumlah)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [invoice, date, item.KdBar, item.Barcode || '', item.Nmbar, item.Satkecil || 'PCS', item.qty, item.unitCost, item.discount, item.amount]);
      await query('UPDATE stock SET StMasuk = IFNULL(StMasuk, 0) + ?, HBeli = ?, HPokok = ? WHERE KdBar = ?',
        [item.qty, item.unitCost * (1 - item.discount / 100), item.unitCost * (1 - item.discount / 100), item.KdBar]);
      modifiedStock.push(item);
      await query("INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang) VALUES (?, ?, ?, ?, 'I', 'BELI', '0')",
        [item.KdBar, date, invoice, item.qty]);
    }

    if (payment > 0) {
      const cashier = req.user.KdUser;
      const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
      if (cashRows.length) await query('UPDATE kasjual SET Keluar = Keluar + ? WHERE Tgl = ? AND KdUser = ?', [payment, date, cashier]);
      else await query('INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal) VALUES (?, ?, 0, 0, ?, 0, 0)', [date, cashier, payment]);
      cashWritten = true;
    }

    res.json({ success: true, message: `Pembelian ${invoice} berhasil dicatat.`, invoice, subtotal, taxAmount, grandTotal, remaining: roundMoney(grandTotal - payment) });
  } catch (err) {
    if (invoice && headerWritten) {
      const cleanup = [
        query('DELETE FROM dbeli WHERE NoFak = ?', [invoice]),
        query('DELETE FROM beli WHERE NoFak = ?', [invoice]),
        query('DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = ?', [date, invoice, 'BELI'])
      ];
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Keluar = Keluar - ? WHERE Tgl = ? AND KdUser = ?', [payment, date, req.user.KdUser]));
      modifiedStock.forEach(item => cleanup.push(query('UPDATE stock SET StMasuk = StMasuk - ?, HBeli = ?, HPokok = ? WHERE KdBar = ?', [item.qty, item.HBeli || 0, item.HPokok || 0, item.KdBar])));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan pembelian parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal menyimpan pembelian: ' + err.message });
  }
});

app.get('/api/pembelian/recent', async (req, res) => {
  try {
    const data = await query(`SELECT b.NoFak, b.TglFak, b.Ket, b.GTotal, b.KDSUPP, s.NmSupp
      FROM beli b LEFT JOIN supp s ON s.KdSupp = b.KDSUPP
      ORDER BY b.TglFak DESC, b.NoFak DESC LIMIT 100`);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil faktur pembelian.' });
  }
});

app.get('/api/pembelian/:noFak', async (req, res) => {
  try {
    const headers = await query('SELECT NoFak, TglFak, Ket, KDSUPP, GTotal, PPNPersen FROM beli WHERE NoFak = ? LIMIT 1', [req.params.noFak]);
    if (!headers.length) return res.status(404).json({ success: false, message: 'Faktur pembelian tidak ditemukan.' });
    const lines = await query(`SELECT KdBar, MAX(barcode) AS barcode, MAX(NmBar) AS NmBar, MAX(Satuan) AS Satuan,
      SUM(Qty) AS Qty, SUM(Jumlah) AS Jumlah FROM dbeli WHERE NoFak = ? GROUP BY KdBar`, [req.params.noFak]);
    const returned = await query(`SELECT d.KdBar, SUM(d.Qty) AS Qty FROM rdbeli d
      JOIN rbeli r ON r.NoFak = d.NoFak WHERE r.Ket = ? GROUP BY d.KdBar`, [`RETUR DARI ${req.params.noFak}`]);
    const returnedByCode = new Map(returned.map(item => [String(item.KdBar), Number(item.Qty || 0)]));
    res.json({ success: true, data: { ...headers[0], items: lines.map(item => ({
      ...item,
      Qty: Number(item.Qty || 0),
      QtyReturned: returnedByCode.get(String(item.KdBar)) || 0,
      UnitCost: Number(item.Qty) ? Number(item.Jumlah) / Number(item.Qty) : 0
    })) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat detail faktur pembelian.' });
  }
});

app.post('/api/retur-pembelian', async (req, res) => {
  const sourceNoFak = String(req.body.SourceNoFak || '').trim();
  const date = String(req.body.TglFak || new Date().toISOString().slice(0, 10));
  const refund = Number(req.body.Bayar || 0);
  const items = req.body.items;
  if (!sourceNoFak || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(items) || !items.length || !Number.isFinite(refund) || refund < 0) {
    return res.status(400).json({ success: false, message: 'Faktur asal, tanggal, barang, atau nilai pengembalian tidak valid.' });
  }

  const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const sourceMarker = `RETUR DARI ${sourceNoFak}`;
  const changedStocks = [];
  let returnNoFak = null;
  let headerWritten = false;
  let cashWritten = false;
  try {
    const sourceHeaders = await query('SELECT NoFak, TglFak, KDSUPP, PPNPersen FROM beli WHERE NoFak = ? LIMIT 1', [sourceNoFak]);
    if (!sourceHeaders.length) return res.status(404).json({ success: false, message: 'Faktur pembelian asal tidak ditemukan.' });
    const sourceLines = await query(`SELECT KdBar, MAX(barcode) AS barcode, MAX(NmBar) AS NmBar, MAX(Satuan) AS Satuan,
      SUM(Qty) AS Qty, SUM(Jumlah) AS Jumlah FROM dbeli WHERE NoFak = ? GROUP BY KdBar`, [sourceNoFak]);
    const sourceByCode = new Map(sourceLines.map(item => [String(item.KdBar), item]));
    const returned = await query(`SELECT d.KdBar, SUM(d.Qty) AS Qty FROM rdbeli d
      JOIN rbeli r ON r.NoFak = d.NoFak WHERE r.Ket = ? GROUP BY d.KdBar`, [sourceMarker]);
    const returnedByCode = new Map(returned.map(item => [String(item.KdBar), Number(item.Qty || 0)]));
    const requested = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const qty = Number(item.Qty);
      if (!kdBar || !Number.isFinite(qty) || qty <= 0 || qty > 9999.99 || requested.has(kdBar)) {
        return res.status(400).json({ success: false, message: 'Kode barang harus unik dan jumlah retur harus valid.' });
      }
      const sourceItem = sourceByCode.get(kdBar);
      if (!sourceItem || qty > Number(sourceItem.Qty) - (returnedByCode.get(kdBar) || 0) + 0.000001) {
        return res.status(409).json({ success: false, message: `Jumlah retur ${kdBar} melebihi sisa pembelian yang dapat diretur.` });
      }
      requested.set(kdBar, { qty, sourceItem });
    }

    let subtotal = 0;
    const returnItems = [];
    for (const [kdBar, item] of requested) {
      const stockRows = await query('SELECT StAwal, StMasuk, StKeluar FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
      const stock = stockRows[0];
      if (!stock) return res.status(404).json({ success: false, message: `Stok ${kdBar} tidak ditemukan.` });
      const available = Number(stock.StAwal || 0) + Number(stock.StMasuk || 0) - Number(stock.StKeluar || 0);
      if (item.qty > available + 0.000001) return res.status(409).json({ success: false, message: `Stok fisik ${kdBar} tidak cukup untuk retur.` });
      const unitCost = Number(item.sourceItem.Qty) ? Number(item.sourceItem.Jumlah) / Number(item.sourceItem.Qty) : 0;
      const amount = roundMoney(unitCost * item.qty);
      subtotal = roundMoney(subtotal + amount);
      returnItems.push({ ...item, kdBar, stock, unitCost, amount });
    }

    const taxRate = Number(sourceHeaders[0].PPNPersen || 0);
    const taxAmount = roundMoney(subtotal * taxRate / 100);
    const grandTotal = roundMoney(subtotal + taxAmount);
    if (refund > grandTotal) return res.status(400).json({ success: false, message: 'Nilai pengembalian tunai melebihi total retur.' });

    const prefix = `R${date.replace(/-/g, '').slice(2)}`;
    const previous = await query('SELECT NoFak FROM rbeli WHERE NoFak LIKE ?', [`${prefix}%`]);
    let sequence = 0;
    previous.forEach(row => {
      const suffix = Number(String(row.NoFak).slice(prefix.length));
      if (Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    returnNoFak = `${prefix}${String(sequence + 1).padStart(3, '0')}`;
    await query(`INSERT INTO rbeli (NoFak, TglFak, Ket, Total, Pot1, PotRp1, Pot2, PotRp2, PPNPersen, PPNRp, GTotal, Bayar, Pos, Lain, KDSUPP)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?, 'Y', 0, ?)`,
    [returnNoFak, date, sourceMarker, subtotal, taxRate, taxAmount, grandTotal, refund, sourceHeaders[0].KDSUPP || null]);
    headerWritten = true;

    for (const item of returnItems) {
      const source = item.sourceItem;
      await query(`INSERT INTO rdbeli (NoFak, TglFak, KdBar, barcode, NmBar, Satuan, Qty, Qtyz, Hbeli, Disc, Jumlah)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`,
      [returnNoFak, date, item.kdBar, source.barcode || '', source.NmBar || '', source.Satuan || '', item.qty, item.unitCost, item.amount]);
      await query('UPDATE stock SET StMasuk = IFNULL(StMasuk, 0) - ? WHERE KdBar = ?', [item.qty, item.kdBar]);
      changedStocks.push(item);
      await query("INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang) VALUES (?, ?, ?, ?, 'O', 'RBELI', '0')",
        [item.kdBar, date, returnNoFak, item.qty]);
    }

    if (refund > 0) {
      const cashier = req.user.KdUser;
      const cashRows = await query('SELECT Tgl FROM kasjual WHERE Tgl = ? AND KdUser = ? LIMIT 1', [date, cashier]);
      if (cashRows.length) await query('UPDATE kasjual SET Masuk = Masuk + ? WHERE Tgl = ? AND KdUser = ?', [refund, date, cashier]);
      else await query('INSERT INTO kasjual (Tgl, KdUser, Awal, Masuk, Keluar, Laci, Batal) VALUES (?, ?, 0, ?, 0, 0, 0)', [date, cashier, refund]);
      cashWritten = true;
    }

    const factorRows = await query("SELECT Tipu FROM fakturis WHERE Tipu = 'Y' LIMIT 1");
    if (factorRows.length) await query("UPDATE fakturis SET RetBeli = ? WHERE Tipu = 'Y'", [returnNoFak]);
    else await query("INSERT INTO fakturis (Tipu, RetBeli) VALUES ('Y', ?)", [returnNoFak]);
    res.json({ success: true, message: `Retur pembelian ${returnNoFak} berhasil.`, NoFak: returnNoFak, GTotal: grandTotal, refund });
  } catch (err) {
    if (returnNoFak && headerWritten) {
      const cleanup = [
        query('DELETE FROM rdbeli WHERE NoFak = ?', [returnNoFak]),
        query('DELETE FROM rbeli WHERE NoFak = ?', [returnNoFak]),
        query("DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = 'RBELI'", [date, returnNoFak])
      ];
      if (cashWritten) cleanup.push(query('UPDATE kasjual SET Masuk = Masuk - ? WHERE Tgl = ? AND KdUser = ?', [refund, date, req.user.KdUser]));
      changedStocks.forEach(item => cleanup.push(query('UPDATE stock SET StMasuk = IFNULL(StMasuk, 0) + ? WHERE KdBar = ?', [item.qty, item.kdBar])));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan retur pembelian parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal menyimpan retur pembelian: ' + err.message });
  }
});

app.get('/api/laporan', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = String(req.query.from || today);
    const dateTo = String(req.query.to || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }

    const [salesSummary, purchaseSummary, sales, purchases, cashLedger, stockMovements, purchaseReturns, salesReturns, salesByCashier] = await Promise.all([
      query('SELECT COUNT(*) AS transactions, COALESCE(SUM(GTotal), 0) AS total FROM jual WHERE tglfak BETWEEN ? AND ? AND KOND = ?', [dateFrom, dateTo, '1']),
      query('SELECT COUNT(*) AS transactions, COALESCE(SUM(GTotal), 0) AS total FROM beli WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]),
      query("SELECT nofak, DATE_FORMAT(tglfak, '%Y-%m-%d') AS tglfak, kdkasir, jam, total, DiscRp, ppn, GTotal, KdCust, KOND FROM jual WHERE tglfak BETWEEN ? AND ? ORDER BY tglfak DESC, jam DESC LIMIT 200", [dateFrom, dateTo]),
      query("SELECT NoFak, DATE_FORMAT(TglFak, '%Y-%m-%d') AS TglFak, Ket, GTotal, Bayar, KDSUPP FROM beli WHERE TglFak BETWEEN ? AND ? ORDER BY TglFak DESC, NoFak DESC LIMIT 200", [dateFrom, dateTo]),
      query("SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, KdUser, Awal, Masuk, Keluar, Batal, (Awal + Masuk - Keluar - Batal) AS Saldo FROM kasjual WHERE Tgl BETWEEN ? AND ? ORDER BY Tgl DESC, KdUser ASC", [dateFrom, dateTo]),
      query(`SELECT m.KdBar, s.Nmbar, DATE_FORMAT(m.Tgl, '%Y-%m-%d') AS Tgl, m.NoBukti, m.Qty, m.Status, m.Ket
        FROM kstock m LEFT JOIN stock s ON s.KdBar = m.KdBar
        WHERE m.Tgl BETWEEN ? AND ? ORDER BY m.Tgl DESC LIMIT 300`, [dateFrom, dateTo]),
      query('SELECT COUNT(*) AS transactions, COALESCE(SUM(GTotal), 0) AS total FROM rbeli WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]),
      query('SELECT COUNT(*) AS transactions, COALESCE(SUM(GTotal), 0) AS total FROM pos_rjual WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]),
      query(`SELECT DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS Tgl, j.kdkasir AS KdKasir, COALESCE(a.Nmuser, j.kdkasir) AS Nmuser,
          COUNT(*) AS Transactions, COALESCE(SUM(j.GTotal), 0) AS Total
        FROM jual j LEFT JOIN pos_auth a ON a.KdUser = j.kdkasir
        WHERE j.tglfak BETWEEN ? AND ? AND j.KOND = '1'
        GROUP BY Tgl, j.kdkasir, Nmuser
        ORDER BY Tgl ASC, Nmuser ASC`, [dateFrom, dateTo])
    ]);
    res.json({ success: true, from: dateFrom, to: dateTo, salesSummary: salesSummary[0], purchaseSummary: purchaseSummary[0], purchaseReturnSummary: purchaseReturns[0], salesReturnSummary: salesReturns[0], sales, purchases, cashLedger, stockMovements, salesByCashier });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil laporan: ' + err.message });
  }
});

// Laporan lengkap satu halaman (khusus admin/bos)
app.get('/api/laporan-lengkap', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = String(req.query.from || today);
    const dateTo = String(req.query.to || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }
    const cashier = String(req.query.kasir || '').trim();
    const group = String(req.query.kdKel || '').trim();
    const jualWhere = "j.tglfak BETWEEN ? AND ? AND j.KOND = '1'" + (cashier ? ' AND j.kdkasir = ?' : '');
    const jualParams = cashier ? [dateFrom, dateTo, cashier] : [dateFrom, dateTo];
    const itemWhere = jualWhere + (group ? ' AND s.KdKel = ?' : '');
    const itemParams = group ? [...jualParams, group] : jualParams;
    const itemFrom = `djual d INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
      LEFT JOIN stock s ON s.KdBar = d.KdBar LEFT JOIN kelompok k ON k.KDKEL = s.KdKel`;

    const [salesSummary, canceled, daily, purchaseDaily, hourly, byCashier, byGroup, topItems, sales, purchases, bySupplier,
      purchaseReturns, salesReturns, cashLedger, stockMovements, stockStatus, lowStock, groups, cashiers] = await Promise.all([
      query(`SELECT COUNT(*) AS trx, IFNULL(SUM(j.GTotal), 0) AS total, IFNULL(SUM(j.DiscRp), 0) AS discount, IFNULL(SUM(j.ppn), 0) AS tax
        FROM jual j WHERE ${jualWhere}`, jualParams),
      query(`SELECT COUNT(*) AS trx, IFNULL(SUM(j.GTotal), 0) AS total FROM jual j
        WHERE j.tglfak BETWEEN ? AND ? AND j.KOND <> '1'${cashier ? ' AND j.kdkasir = ?' : ''}`, jualParams),
      query(`SELECT DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS tgl, COUNT(*) AS trx, SUM(j.GTotal) AS total FROM jual j
        WHERE ${jualWhere} GROUP BY j.tglfak ORDER BY j.tglfak`, jualParams),
      query(`SELECT DATE_FORMAT(TglFak, '%Y-%m-%d') AS tgl, COUNT(*) AS trx, SUM(GTotal) AS total FROM beli
        WHERE TglFak BETWEEN ? AND ? GROUP BY TglFak ORDER BY TglFak`, [dateFrom, dateTo]),
      query(`SELECT HOUR(j.jam) AS jam, COUNT(*) AS trx, SUM(j.GTotal) AS total FROM jual j
        WHERE ${jualWhere} GROUP BY HOUR(j.jam) ORDER BY jam`, jualParams),
      query(`SELECT j.kdkasir AS kode, COALESCE(a.Nmuser, j.kdkasir) AS nama, COUNT(*) AS trx, SUM(j.GTotal) AS total
        FROM jual j LEFT JOIN pos_auth a ON a.KdUser = j.kdkasir WHERE ${jualWhere}
        GROUP BY j.kdkasir, nama ORDER BY total DESC`, jualParams),
      query(`SELECT COALESCE(k.NMKEL, NULLIF(s.KdKel, ''), 'Tanpa kelompok') AS nama, SUM(d.Qty) AS qty, SUM(d.Jumlah) AS total
        FROM ${itemFrom} WHERE ${itemWhere} GROUP BY nama ORDER BY total DESC`, itemParams),
      query(`SELECT d.KdBar AS kode, d.NmBar AS nama, d.Satuan AS satuan, COALESCE(k.NMKEL, '-') AS kelompok, SUM(d.Qty) AS qty, SUM(d.Jumlah) AS total
        FROM ${itemFrom} WHERE ${itemWhere} GROUP BY d.KdBar, d.NmBar, d.Satuan, kelompok ORDER BY total DESC LIMIT 50`, itemParams),
      query(`SELECT j.nofak, DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS tglfak, j.kdkasir, j.jam, j.total, j.DiscRp, j.ppn, j.GTotal, j.KdCust, j.KOND
        FROM jual j WHERE j.tglfak BETWEEN ? AND ?${cashier ? ' AND j.kdkasir = ?' : ''} ORDER BY j.tglfak DESC, j.jam DESC LIMIT 500`, jualParams),
      query(`SELECT NoFak, DATE_FORMAT(TglFak, '%Y-%m-%d') AS TglFak, Ket, GTotal, Bayar, KDSUPP FROM beli
        WHERE TglFak BETWEEN ? AND ? ORDER BY TglFak DESC, NoFak DESC LIMIT 500`, [dateFrom, dateTo]),
      query(`SELECT COALESCE(NULLIF(KDSUPP, ''), 'Tanpa supplier') AS nama, COUNT(*) AS trx, SUM(GTotal) AS total FROM beli
        WHERE TglFak BETWEEN ? AND ? GROUP BY nama ORDER BY total DESC LIMIT 10`, [dateFrom, dateTo]),
      query('SELECT COUNT(*) AS trx, IFNULL(SUM(GTotal), 0) AS total FROM rbeli WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]),
      query(`SELECT NoFak, DATE_FORMAT(TglFak, '%Y-%m-%d') AS TglFak, SourceNoFak, KdKasir, GTotal FROM pos_rjual
        WHERE TglFak BETWEEN ? AND ? ORDER BY TglFak DESC, NoFak DESC LIMIT 300`, [dateFrom, dateTo]),
      query("SELECT DATE_FORMAT(Tgl, '%Y-%m-%d') AS Tgl, KdUser, Awal, Masuk, Keluar, Batal, (Awal + Masuk - Keluar - Batal) AS Saldo FROM kasjual WHERE Tgl BETWEEN ? AND ? ORDER BY Tgl DESC, KdUser", [dateFrom, dateTo]),
      query(`SELECT m.KdBar, s.Nmbar, DATE_FORMAT(m.Tgl, '%Y-%m-%d') AS Tgl, m.NoBukti, m.Qty, m.Status, m.Ket
        FROM kstock m LEFT JOIN stock s ON s.KdBar = m.KdBar WHERE m.Tgl BETWEEN ? AND ? ORDER BY m.Tgl DESC LIMIT 500`, [dateFrom, dateTo]),
      query(`SELECT COUNT(*) AS items,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) = 0 THEN 1 ELSE 0 END), 0) AS empty,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) < 0 THEN 1 ELSE 0 END), 0) AS minus,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) > 0 THEN 1 ELSE 0 END), 0) AS ok,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) > 0 THEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) * HBeli ELSE 0 END), 0) AS value
        FROM stock`),
      query(`SELECT KdBar, Nmbar, SatKecil, (StAwal + IFNULL(StMasuk, 0) - StKeluar) AS Stok FROM stock ORDER BY Stok ASC, KdBar ASC LIMIT 30`),
      query('SELECT KDKEL, NMKEL FROM kelompok ORDER BY NMKEL'),
      query('SELECT KdUser, Nmuser FROM pos_auth ORDER BY Nmuser')
    ]);
    const [purchaseSummary] = await query('SELECT COUNT(*) AS trx, IFNULL(SUM(GTotal), 0) AS total, IFNULL(SUM(Bayar), 0) AS paid FROM beli WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]);
    const [salesReturnSummary] = await query('SELECT COUNT(*) AS trx, IFNULL(SUM(GTotal), 0) AS total FROM pos_rjual WHERE TglFak BETWEEN ? AND ?', [dateFrom, dateTo]);
    res.json({
      success: true, from: dateFrom, to: dateTo,
      summary: { sales: salesSummary[0], canceled: canceled[0], purchase: purchaseSummary, purchaseReturn: purchaseReturns[0], salesReturn: salesReturnSummary },
      daily, purchaseDaily, hourly, byCashier, byGroup, topItems, sales, purchases, bySupplier,
      purchaseReturns: undefined, salesReturns, cashLedger, stockMovements, stockStatus: stockStatus[0], lowStock, groups, cashiers
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil laporan lengkap: ' + err.message });
  }
});
// Laporan penjualan untuk kasir: kasir hanya melihat transaksi miliknya sendiri, manager melihat semua.
app.get('/api/laporan-kasir', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = String(req.query.from || today);
    const dateTo = String(req.query.to || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }

    const manager = hasManagerRole(req.user);
    const owner = manager ? String(req.query.kasir || '').trim() : req.user.KdUser;
    const ownerClause = owner ? ' AND j.kdkasir = ?' : '';
    const base = owner ? [dateFrom, dateTo, owner] : [dateFrom, dateTo];
    const valid = "j.tglfak BETWEEN ? AND ? AND j.KOND = '1'" + ownerClause;

    const [summary, canceled, hourly, daily, byCashier, items, sales, users] = await Promise.all([
      query(`SELECT COUNT(*) AS transactions, COALESCE(SUM(j.GTotal), 0) AS total, COALESCE(SUM(j.DiscRp), 0) AS discount FROM jual j WHERE ${valid}`, base),
      query(`SELECT COUNT(*) AS transactions, COALESCE(SUM(j.GTotal), 0) AS total FROM jual j WHERE j.tglfak BETWEEN ? AND ? AND j.KOND <> '1'${ownerClause}`, base),
      query(`SELECT HOUR(j.jam) AS Jam, COUNT(*) AS Transactions, COALESCE(SUM(j.GTotal), 0) AS Total FROM jual j WHERE ${valid} GROUP BY HOUR(j.jam) ORDER BY Jam ASC`, base),
      query(`SELECT DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS Tgl, COUNT(*) AS Transactions, COALESCE(SUM(j.GTotal), 0) AS Total FROM jual j WHERE ${valid} GROUP BY j.tglfak ORDER BY j.tglfak ASC`, base),
      query(`SELECT j.kdkasir AS Kode, COALESCE(a.Nmuser, j.kdkasir) AS Nama, COUNT(*) AS Transactions, COALESCE(SUM(j.GTotal), 0) AS Total
        FROM jual j LEFT JOIN pos_auth a ON a.KdUser = j.kdkasir WHERE ${valid} GROUP BY j.kdkasir, Nama ORDER BY Total DESC`, base),
      query(`SELECT d.KdBar AS Kode, d.NmBar AS Nama, d.Satuan AS Satuan, SUM(d.Qty) AS Qty, SUM(d.Jumlah) AS Total
        FROM djual d INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
        WHERE ${valid} GROUP BY d.KdBar, d.NmBar, d.Satuan ORDER BY Total DESC LIMIT 100`, base),
      query(`SELECT j.nofak, DATE_FORMAT(j.tglfak, '%Y-%m-%d') AS tglfak, j.jam, j.kdkasir, j.total, j.DiscRp, j.GTotal, j.KOND FROM jual j
        WHERE j.tglfak BETWEEN ? AND ?${ownerClause} ORDER BY j.tglfak DESC, j.jam DESC LIMIT 500`, base),
      manager ? query('SELECT KdUser, Nmuser FROM pos_auth ORDER BY Nmuser') : Promise.resolve([])
    ]);
    res.json({ success: true, from: dateFrom, to: dateTo, manager, summary: summary[0], canceled: canceled[0], hourly, daily, byCashier, items, sales, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil laporan penjualan: ' + err.message });
  }
});

// Ringkasan dashboard (khusus admin/bos)
app.get('/api/dashboard', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const valid = "KOND = '1'";
    const [today] = await query(`SELECT IFNULL(SUM(GTotal), 0) AS total, COUNT(*) AS trx FROM jual WHERE tglfak = CURDATE() AND ${valid}`);
    const [yesterday] = await query(`SELECT IFNULL(SUM(GTotal), 0) AS total, COUNT(*) AS trx FROM jual WHERE tglfak = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${valid}`);
    const [month] = await query(`SELECT IFNULL(SUM(GTotal), 0) AS total, COUNT(*) AS trx FROM jual WHERE tglfak >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND ${valid}`);
    const [profit] = await query(`SELECT IFNULL(SUM(d.Qty), 0) AS qty
      FROM djual d INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
      WHERE j.tglfak >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND j.KOND = '1'`);
    const daily = await query(`SELECT DATE_FORMAT(tglfak, '%Y-%m-%d') AS tgl, SUM(GTotal) AS total, COUNT(*) AS trx
      FROM jual WHERE tglfak >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND ${valid} GROUP BY tglfak ORDER BY tglfak`);
    const byGroup = await query(`SELECT COALESCE(k.NMKEL, NULLIF(s.KdKel, ''), 'Tanpa kelompok') AS nama, SUM(d.Jumlah) AS total
      FROM djual d INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
      LEFT JOIN stock s ON s.KdBar = d.KdBar LEFT JOIN kelompok k ON k.KDKEL = s.KdKel
      WHERE j.tglfak >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND j.KOND = '1'
      GROUP BY nama ORDER BY total DESC LIMIT 6`);
    const topItems = await query(`SELECT d.NmBar AS nama, SUM(d.Qty) AS qty, SUM(d.Jumlah) AS total
      FROM djual d INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
      WHERE j.tglfak >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND j.KOND = '1'
      GROUP BY d.KdBar, d.NmBar ORDER BY total DESC LIMIT 5`);
    const [stock] = await query(`SELECT COUNT(*) AS items,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) = 0 THEN 1 ELSE 0 END), 0) AS empty,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) < 0 THEN 1 ELSE 0 END), 0) AS minus,
        IFNULL(SUM(CASE WHEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) > 0 THEN (StAwal + IFNULL(StMasuk, 0) - StKeluar) * HBeli ELSE 0 END), 0) AS value
      FROM stock`);
    const lowStock = await query(`SELECT KdBar, Nmbar, SatKecil, (StAwal + IFNULL(StMasuk, 0) - StKeluar) AS Stok
      FROM stock ORDER BY Stok ASC, KdBar ASC LIMIT 8`);
    const [receivable] = await query('SELECT IFNULL(SUM(GGantung), 0) AS total FROM anggota');
    const recent = await query(`SELECT nofak, kdkasir, jam, GTotal FROM jual WHERE ${valid} ORDER BY tglfak DESC, jam DESC LIMIT 8`);

    res.json({ success: true, today, yesterday, month, profit, daily, byGroup, topItems, stock, lowStock, receivable: receivable.total, recent });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat dashboard: ' + err.message });
  }
});
app.get('/api/laporan-barang-terlaris', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = String(req.query.from || today);
    const dateTo = String(req.query.to || today);
    const kdKel = String(req.query.kdKel || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Rentang tanggal tidak valid.' });
    }
    if (kdKel.length > 4) return res.status(400).json({ success: false, message: 'Kelompok barang tidak valid.' });

    const groupFilter = kdKel ? ' AND s.KdKel = ?' : '';
    const items = await query(`SELECT
        COALESCE(NULLIF(s.KdKel, ''), 'LAIN') AS KdKel,
        COALESCE(k.NMKEL, NULLIF(s.KdKel, ''), 'Tanpa kelompok') AS NmKel,
        d.KdBar,
        d.NmBar AS Nmbar,
        d.Satuan AS SatKecil,
        COALESCE(SUM(d.Qty), 0) AS Qty,
        COALESCE(SUM(d.Jumlah), 0) AS Total
      FROM djual d
      INNER JOIN jual j ON j.nofak = d.nofak AND j.tglfak = d.TglFak AND j.kdkasir = d.KdKasir
      LEFT JOIN stock s ON s.KdBar = d.KdBar
      LEFT JOIN kelompok k ON k.KDKEL = s.KdKel
      WHERE j.tglfak BETWEEN ? AND ? AND j.KOND = '1'${groupFilter}
      GROUP BY s.KdKel, k.NMKEL, d.KdBar, d.NmBar, d.Satuan
      ORDER BY NmKel ASC, Qty DESC, Nmbar ASC`, kdKel ? [dateFrom, dateTo, kdKel] : [dateFrom, dateTo]);

    res.json({ success: true, from: dateFrom, to: dateTo, kdKel, items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil laporan barang terlaris: ' + err.message });
  }
});

app.post('/api/opname', async (req, res) => {
  const date = String(req.body.Tgl || new Date().toISOString().slice(0, 10));
  const items = req.body.items;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Tanggal atau daftar opname tidak valid.' });
  }

  const roundQuantity = value => Math.round((value + Number.EPSILON) * 1000) / 1000;
  let documentNumber = null;
  const updatedItems = [];
  try {
    const requested = new Map();
    for (const item of items) {
      const kdBar = String(item.KdBar || '').trim();
      const counted = Number(item.StOpname);
      if (!kdBar || !Number.isFinite(counted) || counted < 0 || counted > 999999.999 || roundQuantity(counted) !== counted) {
        return res.status(400).json({ success: false, message: 'Kode barang dan stok fisik harus valid (maksimal 3 desimal).'});
      }
      if (requested.has(kdBar)) return res.status(400).json({ success: false, message: `Barang ${kdBar} tercantum lebih dari sekali.` });
      requested.set(kdBar, counted);
    }

    const prefix = `A${date.replace(/-/g, '').slice(2)}`;
    const existingNumbers = await query('SELECT Ket FROM opname WHERE Tgl = ?', [date]);
    let sequence = 0;
    existingNumbers.forEach(row => {
      const document = String(row.Ket || '');
      const suffix = Number(document.slice(prefix.length));
      if (document.startsWith(prefix) && Number.isInteger(suffix) && suffix > sequence) sequence = suffix;
    });
    documentNumber = `${prefix}${String(sequence + 1).padStart(3, '0')}`;

    for (const [kdBar, counted] of requested) {
      const rows = await query('SELECT KdBar, StAwal, StMasuk, StKeluar, HBeli, HPokok, HJual FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
      if (!rows.length) throw new Error(`Barang ${kdBar} tidak ditemukan.`);
      const product = rows[0];
      const systemStock = roundQuantity(Number(product.StAwal || 0) + Number(product.StMasuk || 0) - Number(product.StKeluar || 0));
      const difference = roundQuantity(systemStock - counted);

      if (difference > 0) {
        await query('UPDATE stock SET StKeluar = StKeluar + ? WHERE KdBar = ?', [difference, kdBar]);
      } else if (difference < 0) {
        await query('UPDATE stock SET StMasuk = IFNULL(StMasuk, 0) - ? WHERE KdBar = ?', [difference, kdBar]);
      }
      updatedItems.push({ ...product, KdBar: kdBar, systemStock, counted, difference });

      await query(`INSERT INTO opname (Tgl, Kdbar, StKomp, StOpname, Selisih, Ket, HJUAL, HBELI, HPOKOK)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [date, kdBar, systemStock, counted, difference, documentNumber, product.HJual || 0, product.HBeli || 0, product.HPokok || 0]);
      if (difference !== 0) {
        await query("INSERT INTO kstock (KdBar, Tgl, NoBukti, Qty, Status, Ket, kdGudang) VALUES (?, ?, ?, ?, 'A', 'ADJUS', '0')",
          [kdBar, date, documentNumber, difference]);
      }
    }

    res.json({ success: true, message: `Opname ${documentNumber} berhasil disimpan.`, documentNumber, adjusted: updatedItems.filter(item => item.difference !== 0).length });
  } catch (err) {
    if (documentNumber) {
      const cleanup = [
        query('DELETE FROM opname WHERE Tgl = ? AND Ket = ?', [date, documentNumber]),
        query('DELETE FROM kstock WHERE Tgl = ? AND NoBukti = ? AND Ket = ?', [date, documentNumber, 'ADJUS'])
      ];
      updatedItems.forEach(item => cleanup.push(query('UPDATE stock SET StMasuk = ?, StKeluar = ? WHERE KdBar = ?', [item.StMasuk, item.StKeluar, item.KdBar])));
      await Promise.all(cleanup.map(operation => operation.catch(cleanupError => console.error('Gagal membersihkan opname parsial:', cleanupError.message))));
    }
    res.status(500).json({ success: false, message: 'Gagal menyimpan opname: ' + err.message });
  }
});

// 4. PUT /api/barang/:kdBar - Update data barang
app.put('/api/barang/:kdBar', async (req, res) => {
  const { kdBar } = req.params;
  let newKdBar = kdBar;
  const migratedTables = [];
  try {
    const { Barcode, KdKel, Nmbar, SatKecil, HBeli, HJual, StAwal, RAK, KDSUPP, WARNA, UKURAN } = req.body;
    const nextKdKel = String(KdKel || 'UM').trim();

    if (!Nmbar) {
      return res.status(400).json({ success: false, message: 'Nama Barang (Nmbar) wajib diisi!' });
    }
    if (!nextKdKel || nextKdKel.length > 4) {
      return res.status(400).json({ success: false, message: 'Kode kelompok maksimal 4 karakter.' });
    }

    const duplicate = await findBarcodeDuplicate(Barcode, kdBar);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Barcode sudah digunakan oleh ${duplicate.KdBar} (${duplicate.Nmbar}).`,
        duplicate
      });
    }

    const existingProducts = await query('SELECT KdBar, KdKel FROM stock WHERE KdBar = ? LIMIT 1', [kdBar]);
    if (!existingProducts.length) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });

    if (String(existingProducts[0].KdKel || '') !== nextKdKel) {
      newKdBar = await generateNextKdBar(nextKdKel);
      const codeConflict = await query('SELECT KdBar FROM stock WHERE KdBar = ? LIMIT 1', [newKdBar]);
      if (codeConflict.length) {
        return res.status(409).json({ success: false, message: `Kode barang ${newKdBar} sudah digunakan. Muat ulang data lalu coba lagi.` });
      }

      const itemTables = ['dbeli', 'djual', 'dpending', 'kstock', 'opname', 'rdbeli', 'pos_rdjual', 'tempdbeli', 'tempdjual'];
      for (const table of itemTables) {
        if (table === 'tempdbeli' || table === 'tempdjual') {
          const existingTable = await query('SHOW TABLES LIKE ?', [table]);
          if (!existingTable.length) continue;
        }
        migratedTables.push(table);
        await query(`UPDATE ${table} SET KdBar = ? WHERE KdBar = ?`, [newKdBar, kdBar]);
      }
    }

    await query(`UPDATE stock
      SET KdBar = ?, Barcode = ?, KdKel = ?, Nmbar = ?, SatKecil = ?, HBeli = ?, HPokok = ?, HJual = ?, StAwal = ?, RAK = ?, KDSUPP = ?, WARNA = ?, UKURAN = ?
      WHERE KdBar = ?`,
    [
      newKdBar, Barcode || null, nextKdKel, Nmbar, SatKecil || 'PCS',
      HBeli || 0, HBeli || 0, HJual || 0, StAwal || 0, RAK || '', KDSUPP || '',
      WARNA || '', UKURAN || '', kdBar
    ]);

    res.json({ success: true, message: 'Data barang berhasil diubah!', newKdBar });
  } catch (err) {
    const rollbackErrors = [];
    for (const table of migratedTables.reverse()) {
      try {
        await query(`UPDATE ${table} SET KdBar = ? WHERE KdBar = ?`, [kdBar, newKdBar]);
      } catch (rollbackError) {
        rollbackErrors.push(`${table}: ${rollbackError.message}`);
      }
    }
    if (rollbackErrors.length) console.error('Gagal memulihkan referensi kode barang:', rollbackErrors.join('; '));
    const recoveryMessage = rollbackErrors.length ? ' Referensi sebagian gagal dipulihkan; periksa database.' : '';
    res.status(500).json({ success: false, message: 'Gagal mengubah barang: ' + err.message + recoveryMessage });
  }
});

// 5. DELETE /api/barang/:kdBar - Hapus barang
app.delete('/api/barang/:kdBar', async (req, res) => {
  try {
    const result = await query('DELETE FROM stock WHERE KdBar = ?', [req.params.kdBar]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Barang berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus barang: ' + err.message });
  }
});

async function startServer() {
  try {
    await ensureAuthTables();
    app.listen(PORT, () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Gagal menyiapkan autentikasi database:', err.message);
    process.exitCode = 1;
  }
}

startServer();