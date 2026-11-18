const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const QRCode = require('qrcode');

const db = require('./lib/db');
const { DEFAULT_THEME, PRESETS, FONTS, SOCIALS, ANIMATIONS, normalizeUrl } = require('./lib/meta');
const { renderProfile, renderNotFound } = require('./lib/render');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || db.state.meta.secret;
const REG_CODE = process.env.REGISTRATION_CODE || '';   // kosong = pendaftaran bebas
// Kosongkan agar alamat selalu mengikuti domain yang sedang diakses (disarankan di Railway).
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const RESERVED = new Set(['admin', 'api', 'login', 'register', 'go', 'uploads', 'static', 'qr', 'logout', 'dashboard', 'settings', 'favicon.ico', 'robots.txt']);

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/vendor/sortable', express.static(path.join(__dirname, 'node_modules/sortablejs'), { maxAge: '7d' }));
app.use('/vendor/chartjs', express.static(path.join(__dirname, 'node_modules/chart.js/dist'), { maxAge: '7d' }));
app.use('/vendor/fa', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free'), { maxAge: '7d' }));
app.use('/uploads', express.static(db.UPLOAD_DIR, { maxAge: '7d' }));

// ---------- util ----------
const uid = () => crypto.randomBytes(6).toString('hex');
const now = () => Date.now();
// Domain diambil dari permintaan yang masuk (lewat proxy Railway), jadi selalu sesuai domain aktif.
const origin = (req) => {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return `${req.protocol}://${host}`;
};
const str = (v, max = 200) => String(v ?? '').slice(0, max).trim();
const isColor = (c) => /^#[0-9a-fA-F]{3,8}$/.test(String(c || ''));
const validUsername = (u) => /^[a-z0-9._-]{3,30}$/.test(u) && !RESERVED.has(u);
const findUser = (fn) => db.state.users.find(fn);

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

function newUser({ username, email, passwordHash, displayName }) {
  return {
    id: uid(),
    username,
    email,
    passwordHash,
    createdAt: now(),
    profile: { displayName: displayName || username, bio: '', avatar: '' },
    theme: { ...DEFAULT_THEME },
    socials: [],
    settings: { socialPosition: 'top', seoTitle: '', seoDesc: '', hideFromSearch: true },
    links: [
      { id: uid(), type: 'header', title: 'Tautan Penting', url: '', visible: true, createdAt: now() },
      { id: uid(), type: 'link', title: 'Website BPS', url: 'https://www.bps.go.id/', visible: true, thumbEmoji: '📊', animation: 'none', clicks: 0, createdAt: now() }
    ]
  };
}

function setAuthCookie(req, res, user) {
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: !!process.env.COOKIE_SECURE || req.secure, maxAge: 30 * 864e5 });
}

function auth(req, res, next) {
  try {
    const { sub } = jwt.verify(req.cookies.token || '', JWT_SECRET);
    const user = findUser((u) => u.id === sub);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  }
}

// rate limit sederhana untuk login/daftar
const hits = new Map();
function limiter(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const t = now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
    arr.push(t);
    hits.set(key, arr);
    next();
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: db.UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '.img';
      cb(null, `${req.user.id}-${uid()}${ext}`);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpeg|webp|gif)$/.test(file.mimetype))
});

function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const f = path.join(db.UPLOAD_DIR, path.basename(url));
  fs.promises.unlink(f).catch(() => {});
}

function deviceOf(ua = '') {
  if (/ipad|tablet/i.test(ua)) return 'Tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'Ponsel';
  return 'Desktop';
}
function refOf(req) {
  try {
    const r = req.get('referer');
    if (!r) return 'Langsung';
    const h = new URL(r).hostname.replace(/^www\./, '');
    return h === req.hostname ? 'Langsung' : h;
  } catch { return 'Langsung'; }
}
function visitorHash(req) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(req.ip + (req.get('user-agent') || '') + day + JWT_SECRET).digest('hex').slice(0, 16);
}
const isBot = (ua = '') => /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram/i.test(ua);

// ---------- meta ----------
app.get('/api/meta', (req, res) => {
  res.json({ presets: PRESETS, defaultTheme: DEFAULT_THEME, fonts: FONTS, socials: SOCIALS, animations: ANIMATIONS, needCode: !!REG_CODE, origin: origin(req) });
});

// ---------- auth ----------
app.post('/api/auth/register', limiter(10, 15 * 60e3), async (req, res) => {
  const username = str(req.body.username, 30).toLowerCase();
  const email = str(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (REG_CODE && req.body.code !== REG_CODE) return res.status(400).json({ error: 'Kode undangan salah.' });
  if (!validUsername(username)) return res.status(400).json({ error: 'Username 3–30 karakter: huruf kecil, angka, titik, minus, garis bawah.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email tidak valid.' });
  if (password.length < 6) return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  if (findUser((u) => u.username === username)) return res.status(409).json({ error: 'Username sudah dipakai.' });
  if (findUser((u) => u.email === email)) return res.status(409).json({ error: 'Email sudah terdaftar.' });
  const user = newUser({ username, email, passwordHash: await bcrypt.hash(password, 10), displayName: str(req.body.displayName, 60) });
  db.state.users.push(user);
  db.save();
  setAuthCookie(req, res, user);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', limiter(20, 15 * 60e3), async (req, res) => {
  const id = str(req.body.username, 120).toLowerCase();
  const user = findUser((u) => u.username === id || u.email === id);
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Username/email atau kata sandi salah.' });
  }
  setAuthCookie(req, res, user);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/username-available', (req, res) => {
  const u = str(req.query.u, 30).toLowerCase();
  res.json({ valid: validUsername(u), available: validUsername(u) && !findUser((x) => x.username === u) });
});

// ---------- akun saya ----------
app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));

app.put('/api/me/profile', auth, (req, res) => {
  const p = req.user.profile;
  if ('displayName' in req.body) p.displayName = str(req.body.displayName, 60);
  if ('bio' in req.body) p.bio = str(req.body.bio, 160);
  db.save();
  res.json(p);
});

app.post('/api/me/avatar', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File gambar tidak valid (PNG/JPG/WEBP/GIF, maks 4 MB).' });
  removeUpload(req.user.profile.avatar);
  req.user.profile.avatar = '/uploads/' + req.file.filename;
  db.save();
  res.json({ avatar: req.user.profile.avatar });
});

app.delete('/api/me/avatar', auth, (req, res) => {
  removeUpload(req.user.profile.avatar);
  req.user.profile.avatar = '';
  db.save();
  res.json({ ok: true });
});

app.put('/api/me/theme', auth, (req, res) => {
  const b = req.body || {};
  const t = req.user.theme = { ...DEFAULT_THEME, ...req.user.theme };
  if (b.preset && PRESETS[b.preset]) {
    const { name, ...vals } = PRESETS[b.preset];
    Object.assign(t, DEFAULT_THEME, vals, { preset: b.preset, bgImage: t.bgImage });
    if (t.bgType === 'image') t.bgType = 'solid';
  }
  for (const k of ['bgColor', 'bgColor2', 'btnColor', 'btnTextColor', 'shadowColor', 'textColor']) if (isColor(b[k])) t[k] = b[k];
  if (['solid', 'gradient', 'image'].includes(b.bgType)) t.bgType = b.bgType;
  if (['to bottom', 'to top', 'to right', 'to bottom right', 'to bottom left'].includes(b.gradientDir)) t.gradientDir = b.gradientDir;
  if (['fill', 'outline', 'hard', 'soft'].includes(b.btnFill)) t.btnFill = b.btnFill;
  if (['square', 'rounded', 'pill'].includes(b.btnShape)) t.btnShape = b.btnShape;
  if (FONTS.includes(b.font)) t.font = b.font;
  if (b.custom) t.preset = 'custom';
  db.save();
  res.json(t);
});

app.post('/api/me/bg-image', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File gambar tidak valid.' });
  removeUpload(req.user.theme.bgImage);
  req.user.theme.bgImage = '/uploads/' + req.file.filename;
  req.user.theme.bgType = 'image';
  req.user.theme.preset = 'custom';
  db.save();
  res.json(req.user.theme);
});

app.put('/api/me/socials', auth, (req, res) => {
  const list = Array.isArray(req.body.socials) ? req.body.socials : [];
  req.user.socials = list
    .filter((s) => SOCIALS[s.type])
    .slice(0, 20)
    .map((s) => ({ type: s.type, value: str(s.value, 300) }));
  db.save();
  res.json(req.user.socials);
});

app.put('/api/me/settings', auth, (req, res) => {
  const s = req.user.settings ||= {};
  const b = req.body || {};
  if (['top', 'bottom'].includes(b.socialPosition)) s.socialPosition = b.socialPosition;
  if ('seoTitle' in b) s.seoTitle = str(b.seoTitle, 70);
  if ('seoDesc' in b) s.seoDesc = str(b.seoDesc, 160);
  if ('hideFromSearch' in b) s.hideFromSearch = !!b.hideFromSearch;
  db.save();
  res.json(s);
});

app.put('/api/me/account', auth, async (req, res) => {
  const b = req.body || {};
  if (b.username !== undefined) {
    const u = str(b.username, 30).toLowerCase();
    if (!validUsername(u)) return res.status(400).json({ error: 'Username tidak valid.' });
    if (u !== req.user.username && findUser((x) => x.username === u)) return res.status(409).json({ error: 'Username sudah dipakai.' });
    req.user.username = u;
  }
  if (b.email !== undefined) {
    const e = str(b.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return res.status(400).json({ error: 'Email tidak valid.' });
    if (e !== req.user.email && findUser((x) => x.email === e)) return res.status(409).json({ error: 'Email sudah terdaftar.' });
    req.user.email = e;
  }
  db.save();
  res.json(publicUser(req.user));
});

app.put('/api/me/password', auth, async (req, res) => {
  const { current, next } = req.body || {};
  if (!(await bcrypt.compare(String(current || ''), req.user.passwordHash))) return res.status(400).json({ error: 'Kata sandi saat ini salah.' });
  if (String(next || '').length < 6) return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
  req.user.passwordHash = await bcrypt.hash(String(next), 10);
  db.save();
  res.json({ ok: true });
});

app.delete('/api/me', auth, async (req, res) => {
  if (!(await bcrypt.compare(String(req.body?.password || ''), req.user.passwordHash))) return res.status(400).json({ error: 'Kata sandi salah.' });
  const u = req.user;
  removeUpload(u.profile.avatar);
  removeUpload(u.theme.bgImage);
  u.links.forEach((l) => removeUpload(l.thumbImage));
  db.state.users = db.state.users.filter((x) => x.id !== u.id);
  db.state.events = db.state.events.filter((e) => e.u !== u.id);
  db.save();
  res.clearCookie('token');
  res.json({ ok: true });
});

// ---------- tautan ----------
function sanitizeLinkPatch(link, b) {
  if ('title' in b) link.title = str(b.title, 120);
  if ('url' in b && link.type !== 'header') link.url = normalizeUrl(b.url);
  if ('visible' in b) link.visible = !!b.visible;
  if ('thumbEmoji' in b) link.thumbEmoji = str(b.thumbEmoji, 8);
  if ('animation' in b && ANIMATIONS.includes(b.animation)) link.animation = b.animation;
  if ('newTab' in b) link.newTab = !!b.newTab;
  for (const k of ['scheduleStart', 'scheduleEnd']) {
    if (k in b) link[k] = b[k] && !isNaN(Date.parse(b[k])) ? new Date(b[k]).toISOString() : '';
  }
}

app.post('/api/me/links', auth, (req, res) => {
  if (req.user.links.length >= 200) return res.status(400).json({ error: 'Maksimal 200 tautan.' });
  const type = req.body.type === 'header' ? 'header' : 'link';
  const link = { id: uid(), type, title: '', url: '', visible: true, animation: 'none', thumbEmoji: '', thumbImage: '', clicks: 0, createdAt: now() };
  sanitizeLinkPatch(link, req.body);
  if (type === 'link' && !link.title && link.url) {
    try { link.title = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
  }
  if (type === 'header' && !link.title) link.title = 'Judul Bagian';
  if (req.body.position === 'bottom') req.user.links.push(link); else req.user.links.unshift(link);
  db.save();
  res.json(link);
});

app.put('/api/me/links/reorder', auth, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const map = new Map(req.user.links.map((l) => [l.id, l]));
  const ordered = ids.map((id) => map.get(id)).filter(Boolean);
  const rest = req.user.links.filter((l) => !ids.includes(l.id));
  req.user.links = [...ordered, ...rest];
  db.save();
  res.json({ ok: true });
});

app.put('/api/me/links/:id', auth, (req, res) => {
  const link = req.user.links.find((l) => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
  sanitizeLinkPatch(link, req.body || {});
  db.save();
  res.json(link);
});

app.post('/api/me/links/:id/duplicate', auth, (req, res) => {
  const i = req.user.links.findIndex((l) => l.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
  const copy = { ...req.user.links[i], id: uid(), title: req.user.links[i].title + ' (salinan)', thumbImage: '', clicks: 0, createdAt: now() };
  req.user.links.splice(i + 1, 0, copy);
  db.save();
  res.json(copy);
});

app.post('/api/me/links/:id/thumb', auth, upload.single('file'), (req, res) => {
  const link = req.user.links.find((l) => l.id === req.params.id);
  if (!link || !req.file) return res.status(400).json({ error: 'Gagal mengunggah thumbnail.' });
  removeUpload(link.thumbImage);
  link.thumbImage = '/uploads/' + req.file.filename;
  link.thumbEmoji = '';
  db.save();
  res.json(link);
});

app.delete('/api/me/links/:id/thumb', auth, (req, res) => {
  const link = req.user.links.find((l) => l.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
  removeUpload(link.thumbImage);
  link.thumbImage = '';
  link.thumbEmoji = '';
  db.save();
  res.json(link);
});

app.delete('/api/me/links/:id', auth, (req, res) => {
  const link = req.user.links.find((l) => l.id === req.params.id);
  if (link) removeUpload(link.thumbImage);
  req.user.links = req.user.links.filter((l) => l.id !== req.params.id);
  db.save();
  res.json({ ok: true });
});

// ---------- analitik ----------
app.get('/api/me/analytics', auth, (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 365);
  const since = now() - days * 864e5;
  const evs = db.state.events.filter((e) => e.u === req.user.id && e.t >= since);
  const daily = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now() - i * 864e5).toISOString().slice(0, 10);
    daily[d] = { views: 0, clicks: 0 };
  }
  const uniq = new Set();
  const perLink = {};
  const devices = {};
  const refs = {};
  let views = 0, clicks = 0;
  for (const e of evs) {
    const d = new Date(e.t).toISOString().slice(0, 10);
    if (e.k === 'v') {
      views++;
      uniq.add(e.h);
      if (daily[d]) daily[d].views++;
      devices[e.dv] = (devices[e.dv] || 0) + 1;
      refs[e.r] = (refs[e.r] || 0) + 1;
    } else if (e.k === 'c') {
      clicks++;
      if (daily[d]) daily[d].clicks++;
      perLink[e.l] = (perLink[e.l] || 0) + 1;
    }
  }
  const linkStats = req.user.links
    .filter((l) => l.type !== 'header')
    .map((l) => ({ id: l.id, title: l.title || l.url, url: l.url, clicks: perLink[l.id] || 0, total: l.clicks || 0 }))
    .sort((a, b) => b.clicks - a.clicks);
  res.json({
    days,
    totals: { views, clicks, unique: uniq.size, ctr: views ? +(clicks / views * 100).toFixed(1) : 0 },
    daily: Object.entries(daily).map(([date, v]) => ({ date, ...v })),
    links: linkStats,
    devices,
    referrers: Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 8)
  });
});

// ---------- halaman & redirect ----------
app.get('/qr/:username.png', async (req, res) => {
  const user = findUser((u) => u.username === req.params.username.toLowerCase());
  if (!user) return res.status(404).end();
  const buf = await QRCode.toBuffer(`${origin(req)}/${user.username}`, { width: 640, margin: 2, color: { dark: '#111111', light: '#ffffff' } });
  res.type('png');
  if (req.query.dl) res.attachment(`qr-${user.username}.png`);
  res.send(buf);
});

app.get('/go/:uid/:lid', (req, res) => {
  const user = findUser((u) => u.id === req.params.uid);
  const link = user?.links.find((l) => l.id === req.params.lid);
  if (!link || !link.url) return res.redirect('/');
  if (!req.query.preview && !isBot(req.get('user-agent'))) {
    link.clicks = (link.clicks || 0) + 1;
    db.addEvent({ u: user.id, k: 'c', l: link.id, t: now() });
  }
  res.redirect(302, link.url);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/healthz', (req, res) => res.json({ ok: true, users: db.state.users.length }));
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/:username', (req, res) => {
  const name = String(req.params.username).toLowerCase().replace(/^@/, '');
  const user = findUser((u) => u.username === name);
  if (!user) return res.status(404).send(renderNotFound(name));
  const preview = !!req.query.preview;
  const ua = req.get('user-agent') || '';
  if (!preview && !isBot(ua)) {
    db.addEvent({ u: user.id, k: 'v', t: now(), h: visitorHash(req), dv: deviceOf(ua), r: refOf(req) });
  }
  res.set('Cache-Control', 'no-store');
  res.send(renderProfile(user, { preview, origin: origin(req) }));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 4 MB.' : 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Linkku berjalan di port ${PORT}${PUBLIC_URL ? ` — ${PUBLIC_URL}` : ''}`);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) console.log(`Domain Railway: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  console.log(`Folder data: ${db.DATA_DIR}`);
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
    console.warn('⚠️  PERINGATAN: Volume Railway belum dipasang — data akan HILANG setiap deploy ulang. Pasang Volume dengan mount path /data.');
  }
  if (!REG_CODE) console.warn('⚠️  REGISTRATION_CODE kosong — siapa pun bisa mendaftar.');
});
