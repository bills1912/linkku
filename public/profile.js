(() => {
  const P = window.__PAGE__;
  const modal = document.getElementById('shareModal');
  const $ = (id) => document.getElementById(id);
  let current = { url: P.url, title: P.title };

  function open(url, title, isPage) {
    current = { url, title };
    $('shTitle').textContent = isPage ? 'Bagikan halaman ini' : 'Bagikan tautan ini';
    $('shUrl').textContent = url.replace(/^https?:\/\//, '');
    const qr = isPage ? `/qr/${P.username}.png` : null;
    $('shQr').hidden = !qr;
    $('shQrDl').hidden = !qr;
    if (qr) $('shQr').src = qr;
    const text = encodeURIComponent(`${title} — ${url}`);
    $('shWa').href = `https://wa.me/?text=${text}`;
    $('shTg').href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    $('shMail').href = `mailto:?subject=${encodeURIComponent(title)}&body=${text}`;
    $('shNative').hidden = !navigator.share;
    modal.hidden = false;
  }

  $('shareBtn').onclick = () => open(P.url, P.title, true);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

  document.querySelectorAll('.lk .dots').forEach((d) => {
    d.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(d.dataset.url, d.dataset.title || d.dataset.url, false);
    });
  });

  $('shCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(current.url); }
    catch {
      const t = document.createElement('textarea'); t.value = current.url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    $('shCopy').innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
    setTimeout(() => ($('shCopy').innerHTML = '<i class="fa-regular fa-copy"></i> Salin tautan'), 1500);
  };
  $('shNative').onclick = () => navigator.share?.({ title: current.title, url: current.url }).catch(() => {});
})();
