/* Tombol tampilkan/sembunyikan kata sandi untuk semua input[type=password] */
(function () {
  const EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  function setState(inp, btn, show) {
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_OFF : EYE;
    btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    btn.title = btn.getAttribute('aria-label');
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  }

  function enhance(inp) {
    if (inp.dataset.pwToggle) return;
    inp.dataset.pwToggle = '1';
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    if (inp.style.marginBottom) { wrap.style.marginBottom = inp.style.marginBottom; inp.style.marginBottom = '0'; }
    if (inp.hidden) { wrap.hidden = true; inp.hidden = false; } // status tersembunyi pindah ke pembungkus
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    btn.tabIndex = 0;
    setState(inp, btn, false);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // fokus tetap di input
    btn.addEventListener('click', () => {
      setState(inp, btn, inp.type === 'password');
      inp.focus();
      const v = inp.value; inp.setSelectionRange?.(v.length, v.length);
    });
    wrap.appendChild(btn);
    // sembunyikan kembali setelah form dikirim
    inp.form?.addEventListener('submit', () => setState(inp, btn, false));
    inp.pwHide = () => setState(inp, btn, false);
  }

  window.enhancePasswordFields = (root = document) => root.querySelectorAll('input[type=password]').forEach(enhance);
  window.enhancePasswordFields();
})();
