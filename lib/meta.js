// Tema, font, dan ikon sosial — dipakai server & dikirim ke editor.

const DEFAULT_THEME = {
  preset: 'default',
  bgType: 'solid',          // solid | gradient | image
  bgColor: '#f3f3f1',
  bgColor2: '#c7d2fe',
  gradientDir: 'to bottom',
  bgImage: '',
  btnFill: 'fill',          // fill | outline | hard | soft
  btnShape: 'pill',         // square | rounded | pill
  btnColor: '#ffffff',
  btnTextColor: '#111111',
  shadowColor: '#000000',
  textColor: '#111111',
  font: 'Inter'
};

const PRESETS = {
  default:  { name: 'Default',    bgType: 'solid', bgColor: '#f3f3f1', btnFill: 'soft', btnShape: 'pill', btnColor: '#ffffff', btnTextColor: '#111111', textColor: '#111111', font: 'Inter' },
  air:      { name: 'Air',        bgType: 'solid', bgColor: '#ffffff', btnFill: 'outline', btnShape: 'rounded', btnColor: '#111111', btnTextColor: '#111111', textColor: '#111111', font: 'DM Sans' },
  bps:      { name: 'BPS',        bgType: 'gradient', bgColor: '#0b3d91', bgColor2: '#1e6fd9', gradientDir: 'to bottom', btnFill: 'fill', btnShape: 'rounded', btnColor: '#f7941d', btnTextColor: '#ffffff', textColor: '#ffffff', font: 'Poppins' },
  midnight: { name: 'Midnight',   bgType: 'solid', bgColor: '#0f172a', btnFill: 'fill', btnShape: 'pill', btnColor: '#1e293b', btnTextColor: '#f8fafc', textColor: '#f8fafc', font: 'Inter' },
  sunset:   { name: 'Sunset',     bgType: 'gradient', bgColor: '#ff7e5f', bgColor2: '#feb47b', gradientDir: 'to bottom', btnFill: 'fill', btnShape: 'pill', btnColor: '#ffffff', btnTextColor: '#7a2e12', textColor: '#ffffff', font: 'Poppins' },
  ocean:    { name: 'Ocean',      bgType: 'gradient', bgColor: '#0ea5e9', bgColor2: '#1e3a8a', gradientDir: 'to bottom right', btnFill: 'outline', btnShape: 'pill', btnColor: '#ffffff', btnTextColor: '#ffffff', textColor: '#ffffff', font: 'Montserrat' },
  forest:   { name: 'Hutan',      bgType: 'solid', bgColor: '#14532d', btnFill: 'fill', btnShape: 'rounded', btnColor: '#bbf7d0', btnTextColor: '#14532d', textColor: '#ecfdf5', font: 'Nunito' },
  lavender: { name: 'Lavender',   bgType: 'gradient', bgColor: '#e9d5ff', bgColor2: '#fbcfe8', gradientDir: 'to bottom', btnFill: 'soft', btnShape: 'pill', btnColor: '#ffffff', btnTextColor: '#6b21a8', textColor: '#3b0764', font: 'Nunito' },
  kertas:   { name: 'Kertas',     bgType: 'solid', bgColor: '#fdf6e3', btnFill: 'hard', btnShape: 'square', btnColor: '#ffffff', btnTextColor: '#111111', shadowColor: '#111111', textColor: '#111111', font: 'Space Grotesk' },
  noir:     { name: 'Noir',       bgType: 'solid', bgColor: '#000000', btnFill: 'outline', btnShape: 'square', btnColor: '#ffffff', btnTextColor: '#ffffff', textColor: '#ffffff', font: 'Space Grotesk' },
  mint:     { name: 'Mint',       bgType: 'solid', bgColor: '#d1fae5', btnFill: 'hard', btnShape: 'rounded', btnColor: '#ffffff', btnTextColor: '#064e3b', shadowColor: '#064e3b', textColor: '#064e3b', font: 'DM Sans' },
  neon:     { name: 'Neon',       bgType: 'gradient', bgColor: '#111827', bgColor2: '#4c1d95', gradientDir: 'to bottom', btnFill: 'fill', btnShape: 'pill', btnColor: '#a3e635', btnTextColor: '#111827', textColor: '#f5f3ff', font: 'Montserrat' },
  elegan:   { name: 'Elegan',     bgType: 'solid', bgColor: '#f5f0e8', btnFill: 'fill', btnShape: 'square', btnColor: '#2b2b2b', btnTextColor: '#f5f0e8', textColor: '#2b2b2b', font: 'Playfair Display' },
  sakura:   { name: 'Sakura',     bgType: 'solid', bgColor: '#fff1f2', btnFill: 'soft', btnShape: 'rounded', btnColor: '#fda4af', btnTextColor: '#881337', textColor: '#881337', font: 'Lora' }
};

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'DM Sans', 'Nunito', 'Space Grotesk', 'Lora', 'Playfair Display', 'Merriweather', 'Quicksand', 'Plus Jakarta Sans'];

// type -> label, kelas ikon Font Awesome, placeholder
const SOCIALS = {
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram', ph: 'https://instagram.com/username' },
  whatsapp:  { label: 'WhatsApp',  icon: 'fa-brands fa-whatsapp',  ph: '081234567890' },
  email:     { label: 'Email',     icon: 'fa-solid fa-envelope',   ph: 'nama@bps.go.id' },
  phone:     { label: 'Telepon',   icon: 'fa-solid fa-phone',      ph: '081234567890' },
  website:   { label: 'Website',   icon: 'fa-solid fa-globe',      ph: 'https://bps.go.id' },
  linkedin:  { label: 'LinkedIn',  icon: 'fa-brands fa-linkedin',  ph: 'https://linkedin.com/in/username' },
  github:    { label: 'GitHub',    icon: 'fa-brands fa-github',    ph: 'https://github.com/username' },
  youtube:   { label: 'YouTube',   icon: 'fa-brands fa-youtube',   ph: 'https://youtube.com/@channel' },
  tiktok:    { label: 'TikTok',    icon: 'fa-brands fa-tiktok',    ph: 'https://tiktok.com/@username' },
  facebook:  { label: 'Facebook',  icon: 'fa-brands fa-facebook',  ph: 'https://facebook.com/username' },
  x:         { label: 'X / Twitter', icon: 'fa-brands fa-x-twitter', ph: 'https://x.com/username' },
  threads:   { label: 'Threads',   icon: 'fa-brands fa-threads',   ph: 'https://threads.net/@username' },
  telegram:  { label: 'Telegram',  icon: 'fa-brands fa-telegram',  ph: 'https://t.me/username' },
  spotify:   { label: 'Spotify',   icon: 'fa-brands fa-spotify',   ph: 'https://open.spotify.com/...' },
  drive:     { label: 'Google Drive', icon: 'fa-brands fa-google-drive', ph: 'https://drive.google.com/...' }
};

const ANIMATIONS = ['none', 'shake', 'pulse', 'wobble', 'glow'];

function normalizePhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}

function socialHref(type, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (type === 'email') return 'mailto:' + v.replace(/^mailto:/, '');
  if (type === 'phone') return 'tel:+' + normalizePhone(v.replace(/^tel:/, ''));
  if (type === 'whatsapp') {
    if (/^https?:\/\//i.test(v)) return v;
    return 'https://wa.me/' + normalizePhone(v);
  }
  return normalizeUrl(v);
}

// Tambah https:// bila tanpa skema; tolak skema berbahaya.
function normalizeUrl(u) {
  let v = String(u || '').trim();
  if (!v) return '';
  if (/^(javascript|data|vbscript|file):/i.test(v)) return '';
  if (/^(mailto|tel|sms|whatsapp):/i.test(v)) return v;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try { return new URL(v).toString(); } catch { return ''; }
}

module.exports = { DEFAULT_THEME, PRESETS, FONTS, SOCIALS, ANIMATIONS, socialHref, normalizeUrl };
