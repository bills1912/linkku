// Render halaman publik /username (server-side, supaya cepat & punya meta OG).
const { DEFAULT_THEME, SOCIALS, socialHref } = require('./meta');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isColor = (c) => /^#[0-9a-fA-F]{3,8}$/.test(String(c || ''));
const col = (c, fb) => (isColor(c) ? c : fb);

function isLive(link, now = Date.now()) {
  if (!link.visible) return false;
  if (link.type !== 'header' && !link.url) return false;
  if (link.scheduleStart && now < Date.parse(link.scheduleStart)) return false;
  if (link.scheduleEnd && now > Date.parse(link.scheduleEnd)) return false;
  return true;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function themeCss(t) {
  t = { ...DEFAULT_THEME, ...t };
  const bg1 = col(t.bgColor, '#f3f3f1');
  const bg2 = col(t.bgColor2, '#c7d2fe');
  const dir = ['to bottom', 'to top', 'to right', 'to bottom right', 'to bottom left'].includes(t.gradientDir) ? t.gradientDir : 'to bottom';
  let background = bg1;
  if (t.bgType === 'gradient') background = `linear-gradient(${dir}, ${bg1}, ${bg2})`;
  if (t.bgType === 'image' && t.bgImage && t.bgImage.startsWith('/uploads/')) background = `${bg1} url("${t.bgImage}") center/cover no-repeat`;

  const btn = col(t.btnColor, '#ffffff');
  const btnText = col(t.btnTextColor, '#111111');
  const shadow = col(t.shadowColor, '#000000');
  const radius = { square: '0px', rounded: '12px', pill: '999px' }[t.btnShape] || '999px';
  let btnCss = `background:${btn};color:${btnText};border:2px solid ${btn};`;
  if (t.btnFill === 'outline') btnCss = `background:transparent;color:${btnText};border:2px solid ${btn};`;
  if (t.btnFill === 'hard') btnCss = `background:${btn};color:${btnText};border:2px solid ${shadow};box-shadow:4px 4px 0 ${shadow};`;
  if (t.btnFill === 'soft') btnCss = `background:${btn};color:${btnText};border:2px solid transparent;box-shadow:0 4px 14px rgba(0,0,0,.12);`;

  return `
  :root{--text:${col(t.textColor, '#111')};--btn:${btn};--btn-text:${btnText};--radius:${radius};--font:'${esc(t.font)}',system-ui,sans-serif}
  .bg{background:${background}}
  .lk{${btnCss}border-radius:var(--radius)}
  .lk:hover{transform:${t.btnFill === 'hard' ? 'translate(-2px,-2px)' : 'scale(1.02)'};${t.btnFill === 'outline' ? `background:${btn};color:${bg1};` : ''}}
  .share-btn,.modal-card .btn{border-radius:${radius === '0px' ? '0' : '999px'}}`;
}

function renderProfile(user, { preview = false, origin = '' } = {}) {
  const p = user.profile || {};
  const t = { ...DEFAULT_THEME, ...(user.theme || {}) };
  const s = user.settings || {};
  const name = p.displayName || '@' + user.username;
  const title = s.seoTitle || name;
  const desc = s.seoDesc || p.bio || `Tautan dari ${name}`;
  const pageUrl = `${origin}/${user.username}`;

  const socials = (user.socials || [])
    .filter((x) => SOCIALS[x.type] && x.value)
    .map((x) => {
      const href = socialHref(x.type, x.value);
      if (!href) return '';
      return `<a class="soc" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(SOCIALS[x.type].label)}"><i class="${SOCIALS[x.type].icon}"></i></a>`;
    })
    .join('');
  const socialBlock = socials ? `<div class="socials">${socials}</div>` : '';
  const socPos = s.socialPosition === 'bottom' ? 'bottom' : 'top';

  const links = (user.links || [])
    .filter((l) => isLive(l))
    .map((l) => {
      if (l.type === 'header') return `<h2 class="hdr">${esc(l.title)}</h2>`;
      let thumb = '';
      if (l.thumbImage) thumb = `<img class="th" src="${esc(l.thumbImage)}" alt="">`;
      else if (l.thumbEmoji) thumb = `<span class="th em">${esc(l.thumbEmoji)}</span>`;
      const anim = l.animation && l.animation !== 'none' ? ` an-${esc(l.animation)}` : '';
      const href = `/go/${user.id}/${l.id}${preview ? '?preview=1' : ''}`;
      return `<a class="lk${anim}${thumb ? ' has-th' : ''}" href="${href}" ${preview || l.newTab !== false ? 'target="_blank" rel="noopener"' : ''}>${thumb}<span class="lt">${esc(l.title || l.url)}</span><span class="dots" data-url="${esc(l.url)}" data-title="${esc(l.title)}" title="Bagikan tautan ini">⋯</span></a>`;
    })
    .join('');

  const avatar = p.avatar
    ? `<img class="avatar" src="${esc(p.avatar)}" alt="${esc(name)}">`
    : `<div class="avatar ini">${esc(initials(p.displayName || user.username))}</div>`;

  const fontParam = encodeURIComponent(t.font) + ':wght@400;500;600;700';

  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}">${p.avatar ? `<meta property="og:image" content="${esc(origin + p.avatar)}">` : ''}
<meta name="twitter:card" content="summary">
${s.hideFromSearch ? '<meta name="robots" content="noindex">' : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${fontParam}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/vendor/fa/css/all.min.css">
<link rel="stylesheet" href="/static/profile.css">
<style>${themeCss(t)}</style>
</head><body>
<div class="bg"></div>
<button class="share-btn" id="shareBtn" aria-label="Bagikan"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
<main class="wrap">
  ${avatar}
  <h1 class="name">${esc(name)}</h1>
  ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
  ${socPos === 'top' ? socialBlock : ''}
  <div class="links">${links || '<p class="empty">Belum ada tautan.</p>'}</div>
  ${socPos === 'bottom' ? socialBlock : ''}
  <footer><a href="/" target="_blank" rel="noopener">⚡ Linkku</a></footer>
</main>

<div class="modal" id="shareModal" hidden>
  <div class="modal-card">
    <button class="x" data-close aria-label="Tutup">✕</button>
    <h3 id="shTitle">Bagikan halaman ini</h3>
    <div class="sh-head">
      ${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<div class="ini sm">${esc(initials(p.displayName || user.username))}</div>`}
      <div><b>${esc(name)}</b><small id="shUrl">${esc(pageUrl.replace(/^https?:\/\//, ''))}</small></div>
    </div>
    <img class="qr" id="shQr" src="/qr/${esc(user.username)}.png" alt="QR code">
    <div class="sh-grid">
      <button class="btn" id="shCopy"><i class="fa-regular fa-copy"></i> Salin tautan</button>
      <a class="btn" id="shWa" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
      <a class="btn" id="shTg" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> Telegram</a>
      <a class="btn" id="shMail"><i class="fa-solid fa-envelope"></i> Email</a>
      <a class="btn" id="shQrDl" download="qr-${esc(user.username)}.png" href="/qr/${esc(user.username)}.png?dl=1"><i class="fa-solid fa-qrcode"></i> Unduh QR</a>
      <button class="btn" id="shNative"><i class="fa-solid fa-share-nodes"></i> Lainnya</button>
    </div>
  </div>
</div>
<script>window.__PAGE__=${JSON.stringify({ url: pageUrl, title: name, username: user.username }).replace(/</g, '\\u003c')};</script>
<script src="/static/profile.js"></script>
</body></html>`;
}

function renderNotFound(username) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tidak ditemukan</title>
<style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f3f3f1;color:#111;text-align:center}a{color:#7c3aed;font-weight:600}</style></head>
<body><div><div style="font-size:64px">🔗</div><h1>Halaman @${esc(username)} belum ada</h1><p>Mungkin nama penggunanya salah ketik.</p><p><a href="/">Buat halaman Linkku-mu sendiri →</a></p></div></body></html>`;
}

module.exports = { renderProfile, renderNotFound, isLive, esc };
