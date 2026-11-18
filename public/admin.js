/* Linkku — editor */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms = 500) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

let me, meta, chart;
let hideInactive = false;
const openPanel = {}; // linkId -> nama panel yang sedang terbuka

// ---------- util ----------
async function api(path, opts = {}) {
  const o = { method: 'GET', ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && !(o.body instanceof FormData)) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const r = await fetch(path, o);
  if (r.status === 401) { location.href = '/'; throw new Error('401'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast(j.error || 'Terjadi kesalahan', true); throw new Error(j.error); }
  return j;
}
let toastT;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 2000);
}
const saved = debounce(() => toast('✓ Tersimpan'), 400);
const pageUrl = () => `${meta.origin}/${me.username}`;
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const refreshPreview = debounce(() => {
  $('#preview').src = `/${me.username}?preview=1&t=${Date.now()}`;
}, 350);

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('✓ Tautan disalin');
}

function confirmBox({ title, text, yes = 'Hapus', password = false }) {
  return new Promise((resolve) => {
    $('#cfTitle').textContent = title; $('#cfText').textContent = text || ''; $('#cfYes').textContent = yes;
    const inp = $('#cfInput'); inp.hidden = !password; inp.value = '';
    $('#confirmModal').hidden = false;
    if (password) setTimeout(() => inp.focus(), 50);
    const done = (v) => { $('#confirmModal').hidden = true; $('#cfYes').onclick = $('#cfNo').onclick = null; resolve(v); };
    $('#cfYes').onclick = () => done(password ? inp.value || false : true);
    $('#cfNo').onclick = () => done(false);
  });
}

// ---------- header / umum ----------
function renderHeader() {
  const av = $('#btnMenu');
  av.innerHTML = me.profile.avatar ? `<img class="avatar-sm" src="${esc(me.profile.avatar)}" alt="">` : esc(initials(me.profile.displayName || me.username));
  $('#who').innerHTML = `<b style="color:#111">@${esc(me.username)}</b><br>${esc(me.email)}`;
  $('#mView').href = `/${me.username}`;
  const u = $('#myUrl'); u.href = `/${me.username}`; u.textContent = pageUrl().replace(/^https?:\/\//, '');
}

function setupChrome() {
  $$('#tabs button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  $('#btnMenu').onclick = (e) => { e.stopPropagation(); $('#menuPop').classList.toggle('open'); };
  document.addEventListener('click', () => $('#menuPop').classList.remove('open'));
  $$('[data-goto]').forEach((b) => (b.onclick = () => showTab(b.dataset.goto)));
  $('#btnLogout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };
  $('#copyUrl').onclick = () => copy(pageUrl());
  $('#prevToggle').onclick = () => $('#previewCol').classList.toggle('open');
  $('#previewCol').onclick = (e) => { if (e.target.id === 'previewCol') $('#previewCol').classList.remove('open'); };

  // bagikan
  $('#btnShare').onclick = () => {
    const url = pageUrl();
    $('#qrImg').src = `/qr/${me.username}.png?t=${Date.now()}`;
    $('#qrDl').href = `/qr/${me.username}.png?dl=1`;
    $('#shUrl').textContent = url.replace(/^https?:\/\//, '');
    $('#shWa').href = `https://wa.me/?text=${encodeURIComponent((me.profile.displayName || me.username) + ' — ' + url)}`;
    $('#shMail').href = `mailto:?subject=${encodeURIComponent(me.profile.displayName || me.username)}&body=${encodeURIComponent(url)}`;
    $('#shOpen').href = `/${me.username}`;
    $('#shareModal').hidden = false;
  };
  $('#shCopy').onclick = () => copy(pageUrl());
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.modal').forEach((m) => (m.hidden = true)); });
}

function showTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== name));
  history.replaceState(null, '', '#' + name);
  if (name === 'analytics') loadAnalytics();
  window.scrollTo({ top: 0 });
}

// ================= TAUTAN =================
const EMOJIS = ['📊', '📁', '📝', '📅', '📌', '📢', '💬', '📞', '📍', '🎯', '🚀', '⭐', '🔥', '✅', '📚', '🏢', '🗂️', '🧾', '💼', '🎓', '🗺️', '📷', '🎥', '🔗'];
const ANIM_LABEL = { none: 'Tanpa animasi', shake: 'Goyang', pulse: 'Denyut', wobble: 'Bergoyang', glow: 'Berpendar' };

function renderLinks() {
  const list = $('#linkList');
  const links = me.links.filter((l) => !hideInactive || l.visible);
  $('#linkEmpty').hidden = me.links.length > 0;
  list.innerHTML = links.map(linkCard).join('');
  links.forEach((l) => bindCard(l));
}

function linkCard(l) {
  const isH = l.type === 'header';
  const p = openPanel[l.id];
  const scheduled = l.scheduleStart || l.scheduleEnd;
  return `
  <div class="lcard ${l.visible ? '' : 'off'}" data-id="${l.id}">
    <div class="drag" title="Seret untuk mengurutkan"><i class="fa-solid fa-grip-vertical"></i></div>
    <div class="lbody">
      <div class="lhead ${isH ? 'header' : ''}">
        <div class="lfields">
          <input class="ed title" value="${esc(l.title)}" placeholder="${isH ? 'Judul header' : 'Judul'}" maxlength="120">
          ${isH ? '' : `<input class="ed url" value="${esc(l.url)}" placeholder="URL" >`}
        </div>
        <div class="lright">
          <label class="switch" title="Tampilkan/sembunyikan"><input type="checkbox" class="vis" ${l.visible ? 'checked' : ''}><span></span></label>
        </div>
      </div>
      <div class="tools">
        ${isH ? '' : `
        <button class="tool ${p === 'thumb' ? 'on' : ''} ${l.thumbEmoji || l.thumbImage ? 'on' : ''}" data-p="thumb" title="Thumbnail"><i class="fa-regular fa-image"></i></button>
        <button class="tool ${p === 'anim' || (l.animation && l.animation !== 'none') ? 'on' : ''}" data-p="anim" title="Prioritaskan / animasi"><i class="fa-solid fa-star"></i></button>
        <button class="tool ${p === 'sched' || scheduled ? 'on' : ''}" data-p="sched" title="Jadwalkan"><i class="fa-regular fa-calendar"></i></button>
        <button class="tool" data-act="dup" title="Duplikat"><i class="fa-regular fa-clone"></i></button>
        <button class="tool" data-act="copy" title="Salin URL"><i class="fa-regular fa-copy"></i></button>`}
        <button class="tool" data-act="del" title="Hapus"><i class="fa-regular fa-trash-can"></i></button>
        ${isH ? '' : `<span class="clicks"><i class="fa-solid fa-chart-simple"></i> ${l.clicks || 0} klik</span>`}
      </div>
      ${p ? panelHtml(l, p) : ''}
    </div>
  </div>`;
}

function panelHtml(l, p) {
  if (p === 'thumb') {
    const prev = l.thumbImage ? `<img src="${esc(l.thumbImage)}">` : l.thumbEmoji ? esc(l.thumbEmoji) : '<i class="fa-regular fa-image" style="color:#bbb;font-size:20px"></i>';
    return `<div class="panel"><button class="close" data-close-panel>✕</button><h5>Thumbnail</h5>
      <div class="row"><div class="thumbprev">${prev}</div>
        <div class="row wrap" style="flex:1">
          <label class="btn primary"><i class="fa-solid fa-upload"></i> Unggah gambar<input type="file" accept="image/*" class="thumbFile" hidden></label>
          <button class="btn" data-act="rmthumb">Hapus</button>
        </div></div>
      <div class="muted" style="margin-top:12px">atau pilih emoji:</div>
      <div class="emojis">${EMOJIS.map((e) => `<button data-emoji="${e}">${e}</button>`).join('')}</div></div>`;
  }
  if (p === 'anim') {
    return `<div class="panel"><button class="close" data-close-panel>✕</button><h5>Prioritaskan tautan</h5>
      <div class="muted" style="text-align:center;margin:-6px 0 12px">Beri animasi agar tautan penting lebih menonjol.</div>
      <div class="opts">${meta.animations.map((a) => `<div class="opt ${(l.animation || 'none') === a ? 'on' : ''}" data-anim="${a}">${ANIM_LABEL[a] || a}</div>`).join('')}</div></div>`;
  }
  if (p === 'sched') {
    const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
    return `<div class="panel"><button class="close" data-close-panel>✕</button><h5>Jadwalkan tautan</h5>
      <div class="muted" style="text-align:center;margin:-6px 0 12px">Tautan hanya tampil di antara waktu ini (kosongkan bila tidak perlu).</div>
      <div class="grid2">
        <div><label class="lbl">Mulai tampil</label><input type="datetime-local" class="inp sStart" value="${toLocal(l.scheduleStart)}"></div>
        <div><label class="lbl">Berhenti tampil</label><input type="datetime-local" class="inp sEnd" value="${toLocal(l.scheduleEnd)}"></div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="clrsched">Hapus jadwal</button></div></div>`;
  }
  return '';
}

async function updateLink(id, patch, rerender = false) {
  const res = await api(`/api/me/links/${id}`, { method: 'PUT', body: patch });
  const i = me.links.findIndex((l) => l.id === id);
  me.links[i] = res;
  saved(); refreshPreview();
  if (rerender) renderLinks();
  return res;
}

function bindCard(l) {
  const el = $(`.lcard[data-id="${l.id}"]`);
  if (!el) return;
  const saveText = debounce(() => {
    const patch = { title: $('.title', el).value };
    const u = $('.url', el); if (u) patch.url = u.value;
    updateLink(l.id, patch);
  }, 600);
  $('.title', el).addEventListener('input', saveText);
  const u = $('.url', el);
  if (u) {
    u.addEventListener('input', saveText);
    u.addEventListener('blur', () => setTimeout(() => { const cur = me.links.find((x) => x.id === l.id); if (cur && document.activeElement !== u) u.value = cur.url; }, 900));
  }
  $('.vis', el).addEventListener('change', (e) => { el.classList.toggle('off', !e.target.checked); updateLink(l.id, { visible: e.target.checked }); });

  $$('[data-p]', el).forEach((b) => (b.onclick = () => { openPanel[l.id] = openPanel[l.id] === b.dataset.p ? null : b.dataset.p; renderLinks(); }));
  $$('[data-close-panel]', el).forEach((b) => (b.onclick = () => { openPanel[l.id] = null; renderLinks(); }));
  $$('[data-act]', el).forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    if (act === 'del') {
      if (!(await confirmBox({ title: 'Hapus tautan ini?', text: `"${l.title || l.url}" akan dihapus permanen beserta jumlah kliknya.` }))) return;
      await api(`/api/me/links/${l.id}`, { method: 'DELETE' });
      me.links = me.links.filter((x) => x.id !== l.id); renderLinks(); refreshPreview(); toast('Tautan dihapus');
    }
    if (act === 'dup') {
      const c = await api(`/api/me/links/${l.id}/duplicate`, { method: 'POST' });
      me.links.splice(me.links.findIndex((x) => x.id === l.id) + 1, 0, c); renderLinks(); refreshPreview(); toast('Tautan diduplikat');
    }
    if (act === 'copy') copy(l.url);
    if (act === 'rmthumb') { const r = await api(`/api/me/links/${l.id}/thumb`, { method: 'DELETE' }); Object.assign(l, r); me.links[me.links.findIndex((x) => x.id === l.id)] = r; renderLinks(); refreshPreview(); }
    if (act === 'clrsched') updateLink(l.id, { scheduleStart: '', scheduleEnd: '' }, true);
  }));
  $$('[data-emoji]', el).forEach((b) => (b.onclick = () => updateLink(l.id, { thumbEmoji: b.dataset.emoji }, true)));
  $$('[data-anim]', el).forEach((b) => (b.onclick = () => updateLink(l.id, { animation: b.dataset.anim }, true)));
  const tf = $('.thumbFile', el);
  if (tf) tf.onchange = async () => {
    if (!tf.files[0]) return;
    const fd = new FormData(); fd.append('file', tf.files[0]);
    const r = await api(`/api/me/links/${l.id}/thumb`, { method: 'POST', body: fd });
    me.links[me.links.findIndex((x) => x.id === l.id)] = r; renderLinks(); refreshPreview(); saved();
  };
  const ss = $('.sStart', el), se = $('.sEnd', el);
  if (ss) [ss, se].forEach((inp) => inp.addEventListener('change', () => updateLink(l.id, {
    scheduleStart: ss.value ? new Date(ss.value).toISOString() : '',
    scheduleEnd: se.value ? new Date(se.value).toISOString() : ''
  })));
}

function setupLinks() {
  $('#btnAdd').onclick = () => { $('#addBox').hidden = false; $('#btnAdd').hidden = true; $('#addForm').url.focus(); };
  $('#addClose').onclick = () => { $('#addBox').hidden = true; $('#btnAdd').hidden = false; };
  $('#addForm').onsubmit = async (e) => {
    e.preventDefault();
    const url = e.target.url.value.trim(); if (!url) return;
    const l = await api('/api/me/links', { method: 'POST', body: { url } });
    if (!l.url) toast('URL tidak valid — periksa kembali', true);
    me.links.unshift(l); e.target.reset();
    $('#addBox').hidden = true; $('#btnAdd').hidden = false;
    renderLinks(); refreshPreview(); toast('✓ Tautan ditambahkan');
    setTimeout(() => $(`.lcard[data-id="${l.id}"] .title`)?.select(), 50);
  };
  $('#btnHeader').onclick = async () => {
    const l = await api('/api/me/links', { method: 'POST', body: { type: 'header', title: 'Judul Bagian' } });
    me.links.unshift(l); renderLinks(); refreshPreview();
    setTimeout(() => $(`.lcard[data-id="${l.id}"] .title`)?.select(), 50);
  };
  $('#btnArchiveToggle').onclick = () => {
    hideInactive = !hideInactive;
    $('#btnArchiveToggle span').textContent = hideInactive ? 'Tampilkan semua' : 'Sembunyikan nonaktif';
    renderLinks();
  };
  Sortable.create($('#linkList'), {
    handle: '.drag', animation: 160,
    onEnd: async () => {
      const ids = $$('#linkList .lcard').map((c) => c.dataset.id);
      const hidden = me.links.filter((l) => !ids.includes(l.id));
      const map = new Map(me.links.map((l) => [l.id, l]));
      me.links = [...ids.map((id) => map.get(id)), ...hidden];
      await api('/api/me/links/reorder', { method: 'PUT', body: { ids: me.links.map((l) => l.id) } });
      saved(); refreshPreview();
    }
  });
}

// ================= TAMPILAN =================
function renderProfile() {
  const p = me.profile;
  $('#avPrev').innerHTML = p.avatar ? `<img src="${esc(p.avatar)}" style="width:96px;height:96px;border-radius:50%;object-fit:cover">` : esc(initials(p.displayName || me.username));
  $('#avRemove').hidden = !p.avatar;
  $('#pName').value = p.displayName || '';
  $('#pBio').value = p.bio || '';
  $('#bioCount').textContent = (p.bio || '').length;
}

function setupProfile() {
  const saveP = debounce(async () => {
    me.profile = await api('/api/me/profile', { method: 'PUT', body: { displayName: $('#pName').value, bio: $('#pBio').value } });
    renderHeader(); saved(); refreshPreview();
  }, 600);
  $('#pName').addEventListener('input', saveP);
  $('#pBio').addEventListener('input', () => { $('#bioCount').textContent = $('#pBio').value.length; saveP(); });
  $('#avFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    const r = await api('/api/me/avatar', { method: 'POST', body: fd });
    me.profile.avatar = r.avatar; renderProfile(); renderHeader(); refreshPreview(); toast('✓ Foto profil diperbarui');
    e.target.value = '';
  };
  $('#avRemove').onclick = async () => {
    await api('/api/me/avatar', { method: 'DELETE' });
    me.profile.avatar = ''; renderProfile(); renderHeader(); refreshPreview();
  };
}

// --- ikon sosial
function renderSocials() {
  $('#socType').innerHTML = Object.entries(meta.socials).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('#socList').innerHTML = me.socials.length ? me.socials.map((s, i) => {
    const m = meta.socials[s.type];
    return `<div class="soc-item" data-i="${i}"><span class="drag2"><i class="fa-solid fa-grip-vertical"></i></span><i class="ic ${m.icon}"></i>
      <input class="inp sv" value="${esc(s.value)}" placeholder="${esc(m.ph)}"><button class="tool" data-rm="${i}" title="Hapus"><i class="fa-regular fa-trash-can"></i></button></div>`;
  }).join('') : '<div class="muted" style="padding:6px 0">Belum ada ikon sosial.</div>';
  const save = debounce(saveSocials, 600);
  $$('#socList .sv').forEach((inp, i) => inp.addEventListener('input', () => { me.socials[i].value = inp.value; save(); }));
  $$('#socList [data-rm]').forEach((b) => (b.onclick = () => { me.socials.splice(+b.dataset.rm, 1); renderSocials(); saveSocials(); }));
  $$('[data-socpos]').forEach((o) => o.classList.toggle('on', (me.settings.socialPosition || 'top') === o.dataset.socpos));
}
async function saveSocials() {
  me.socials = await api('/api/me/socials', { method: 'PUT', body: { socials: me.socials } });
  saved(); refreshPreview();
}
function setupSocials() {
  $('#socAdd').onclick = () => {
    me.socials.push({ type: $('#socType').value, value: '' });
    renderSocials();
    const inputs = $$('#socList .sv'); inputs[inputs.length - 1]?.focus();
  };
  $$('[data-socpos]').forEach((o) => (o.onclick = async () => {
    me.settings = await api('/api/me/settings', { method: 'PUT', body: { socialPosition: o.dataset.socpos } });
    renderSocials(); saved(); refreshPreview();
  }));
  Sortable.create($('#socList'), {
    handle: '.drag2', animation: 150,
    onEnd: () => {
      const order = $$('#socList .soc-item').map((x) => +x.dataset.i);
      me.socials = order.map((i) => me.socials[i]);
      renderSocials(); saveSocials();
    }
  });
}

// --- tema
function btnPreviewStyle(t) {
  const radius = { square: '0', rounded: '8px', pill: '999px' }[t.btnShape] || '999px';
  if (t.btnFill === 'outline') return `background:transparent;border:2px solid ${t.btnColor};border-radius:${radius}`;
  if (t.btnFill === 'hard') return `background:${t.btnColor};border:2px solid ${t.shadowColor || '#000'};box-shadow:3px 3px 0 ${t.shadowColor || '#000'};border-radius:${radius}`;
  if (t.btnFill === 'soft') return `background:${t.btnColor};box-shadow:0 2px 8px rgba(0,0,0,.15);border-radius:${radius}`;
  return `background:${t.btnColor};border-radius:${radius}`;
}
function bgCss(t) {
  if (t.bgType === 'gradient') return `linear-gradient(${t.gradientDir || 'to bottom'},${t.bgColor},${t.bgColor2})`;
  if (t.bgType === 'image' && t.bgImage) return `${t.bgColor} url("${t.bgImage}") center/cover`;
  return t.bgColor;
}

function renderThemes() {
  const t = me.theme;
  const custom = { name: 'Kustom', ...t };
  const entries = [['custom', custom], ...Object.entries(meta.presets)];
  $('#themes').innerHTML = entries.map(([k, p]) => {
    const pt = { ...meta.defaultTheme, ...p };
    return `<div class="theme ${t.preset === k ? 'on' : ''}" data-preset="${k}">
      <div class="sw" style="background:${bgCss(pt)}">
        <i style="background:${pt.textColor};opacity:.25"></i>
        <b style="${btnPreviewStyle(pt)}"></b><b style="${btnPreviewStyle(pt)}"></b><b style="${btnPreviewStyle(pt)}"></b>
        ${k === 'custom' ? '<span style="font-size:11px;color:' + pt.textColor + ';margin-top:auto">✎ Kustom</span>' : ''}
      </div><p>${esc(p.name)}</p></div>`;
  }).join('');
  $$('#themes .theme').forEach((el) => (el.onclick = async () => {
    if (el.dataset.preset === 'custom') { $('#bgTypes').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    me.theme = await api('/api/me/theme', { method: 'PUT', body: { preset: el.dataset.preset } });
    renderAppearance(); saved(); refreshPreview();
  }));

  // latar
  $$('#bgTypes .opt').forEach((o) => o.classList.toggle('on', t.bgType === o.dataset.bg));
  $('#bgGrad').hidden = t.bgType !== 'gradient';
  $('#bgImg').hidden = t.bgType !== 'image';
  $('#gradDir').value = t.gradientDir || 'to bottom';
  // warna
  $$('[data-color]').forEach((c) => (c.value = toHex6(t[c.dataset.color])));
  $$('[data-hex]').forEach((c) => (c.value = t[c.dataset.hex] || ''));
  $('#shadowWrap').hidden = t.btnFill !== 'hard';
  // tombol
  const groups = [['fill', 'Isi'], ['outline', 'Garis tepi'], ['hard', 'Bayangan tegas'], ['soft', 'Bayangan lembut']];
  $('#btnStyles').innerHTML = groups.map(([fill, label]) => `
    <div class="bstyle-group"><div class="lbl">${label}</div><div class="bstyles">
      ${['square', 'rounded', 'pill'].map((shape) => `<div class="bs ${t.btnFill === fill && t.btnShape === shape ? 'on' : ''}" data-fill="${fill}" data-shape="${shape}"
        style="${btnPreviewStyle({ btnFill: fill, btnShape: shape, btnColor: fill === 'outline' ? '#111' : fill === 'fill' ? '#111' : '#fff', shadowColor: '#111' })}"></div>`).join('')}
    </div></div>`).join('');
  $$('#btnStyles .bs').forEach((b) => (b.onclick = () => saveTheme({ btnFill: b.dataset.fill, btnShape: b.dataset.shape })));
  // font
  $('#fontSel').value = t.font;
}
function toHex6(c) {
  c = String(c || '#000000');
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('');
  return c.slice(0, 7);
}

async function saveTheme(patch) {
  me.theme = await api('/api/me/theme', { method: 'PUT', body: { ...patch, custom: true } });
  renderThemes(); saved(); refreshPreview();
}
const saveThemeDeb = debounce(saveTheme, 400);

function setupAppearance() {
  $('#fontSel').innerHTML = meta.fonts.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  $('#fontSel').onchange = (e) => saveTheme({ font: e.target.value });
  $$('#bgTypes .opt').forEach((o) => (o.onclick = () => {
    if (o.dataset.bg === 'image' && !me.theme.bgImage) { me.theme.bgType = 'image'; renderThemes(); $('#bgFile').click(); return; }
    saveTheme({ bgType: o.dataset.bg });
  }));
  $('#gradDir').onchange = (e) => saveTheme({ gradientDir: e.target.value });
  $$('[data-color]').forEach((c) => c.addEventListener('input', () => {
    const k = c.dataset.color; me.theme[k] = c.value; $(`[data-hex="${k}"]`).value = c.value; saveThemeDeb({ [k]: c.value });
  }));
  $$('[data-hex]').forEach((c) => c.addEventListener('input', () => {
    let v = c.value.trim(); if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) { $(`[data-color="${c.dataset.hex}"]`).value = toHex6(v); saveThemeDeb({ [c.dataset.hex]: v }); }
  }));
  $('#bgFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    me.theme = await api('/api/me/bg-image', { method: 'POST', body: fd });
    renderThemes(); refreshPreview(); toast('✓ Gambar latar diperbarui'); e.target.value = '';
  };
}
function renderAppearance() { renderProfile(); renderSocials(); renderThemes(); }

// ================= ANALITIK =================
async function loadAnalytics() {
  const days = $('#anDays').value;
  const a = await api(`/api/me/analytics?days=${days}`);
  const fmt = (n) => n.toLocaleString('id-ID');
  $('#sViews').textContent = fmt(a.totals.views);
  $('#sUnique').textContent = fmt(a.totals.unique);
  $('#sClicks').textContent = fmt(a.totals.clicks);
  $('#sCtr').textContent = a.totals.ctr + '%';

  const labels = a.daily.map((d) => new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  if (chart) chart.destroy();
  chart = new Chart($('#chart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Kunjungan', data: a.daily.map((d) => d.views), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', fill: true, tension: .35, pointRadius: days > 30 ? 0 : 3 },
      { label: 'Klik', data: a.daily.map((d) => d.clicks), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.08)', fill: true, tension: .35, pointRadius: days > 30 ? 0 : 3 }
    ] },
    options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
  });

  const max = Math.max(1, ...a.links.map((l) => l.clicks));
  $('#tLinks').innerHTML = a.links.length
    ? `<tr><th>Tautan</th><th style="text-align:right">Klik (periode)</th><th style="text-align:right">Total</th></tr>` +
      a.links.map((l) => `<tr><td><b>${esc(l.title)}</b><div class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px">${esc(l.url)}</div><div class="bar"><span style="width:${(l.clicks / max) * 100}%"></span></div></td><td class="n">${fmt(l.clicks)}</td><td class="n" style="color:#888">${fmt(l.total)}</td></tr>`).join('')
    : '<tr><td class="muted">Belum ada tautan.</td></tr>';
  const devEntries = Object.entries(a.devices);
  const tot = devEntries.reduce((s, [, v]) => s + v, 0) || 1;
  $('#tDev').innerHTML = devEntries.length ? devEntries.sort((x, y) => y[1] - x[1]).map(([k, v]) => `<tr><td>${esc(k)}<div class="bar"><span style="width:${(v / tot) * 100}%"></span></div></td><td class="n">${Math.round((v / tot) * 100)}%</td></tr>`).join('') : '<tr><td class="muted">Belum ada data.</td></tr>';
  $('#tRef').innerHTML = a.referrers.length ? a.referrers.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${fmt(v)}</td></tr>`).join('') : '<tr><td class="muted">Belum ada data.</td></tr>';
}

// ================= PENGATURAN =================
function renderSettings() {
  $('#sUser').value = me.username;
  $('#sEmail').value = me.email;
  $('#seoTitle').value = me.settings.seoTitle || '';
  $('#seoDesc').value = me.settings.seoDesc || '';
  $('#noindex').checked = me.settings.hideFromSearch !== false;
}
function setupSettings() {
  $('#sUser').addEventListener('input', (e) => (e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')));
  $('#saveUser').onclick = async () => { me = await api('/api/me/account', { method: 'PUT', body: { username: $('#sUser').value } }); renderHeader(); refreshPreview(); toast('✓ Username diperbarui'); };
  $('#saveEmail').onclick = async () => { me = await api('/api/me/account', { method: 'PUT', body: { email: $('#sEmail').value } }); renderHeader(); toast('✓ Email diperbarui'); };
  $('#savePw').onclick = async () => {
    await api('/api/me/password', { method: 'PUT', body: { current: $('#pwCur').value, next: $('#pwNew').value } });
    $('#pwCur').value = $('#pwNew').value = ''; toast('✓ Kata sandi diperbarui');
  };
  const saveSeo = debounce(async () => { me.settings = await api('/api/me/settings', { method: 'PUT', body: { seoTitle: $('#seoTitle').value, seoDesc: $('#seoDesc').value } }); saved(); }, 600);
  $('#seoTitle').addEventListener('input', saveSeo);
  $('#seoDesc').addEventListener('input', saveSeo);
  $('#noindex').onchange = async (e) => { me.settings = await api('/api/me/settings', { method: 'PUT', body: { hideFromSearch: e.target.checked } }); saved(); };
  $('#btnDelAcc').onclick = async () => {
    const pw = await confirmBox({ title: 'Hapus akun permanen?', text: 'Masukkan kata sandi untuk konfirmasi. Tindakan ini tidak dapat dibatalkan.', yes: 'Hapus akun', password: true });
    if (!pw) return;
    await api('/api/me', { method: 'DELETE', body: { password: pw } });
    location.href = '/';
  };
  $('#anDays').onchange = loadAnalytics;
}

// ================= INIT =================
(async function init() {
  [meta, me] = await Promise.all([api('/api/meta'), api('/api/me')]);
  me.settings ||= {};
  setupChrome(); setupLinks(); setupProfile(); setupSocials(); setupAppearance(); setupSettings();
  renderHeader(); renderLinks(); renderAppearance(); renderSettings();
  $('#preview').src = `/${me.username}?preview=1`;
  const tab = location.hash.slice(1);
  if (['links', 'appearance', 'analytics', 'settings'].includes(tab)) showTab(tab);
})();
