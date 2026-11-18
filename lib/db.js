// Penyimpanan sederhana berbasis file JSON (cukup untuk pemakaian internal).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Di Railway: pasang Volume, maka RAILWAY_VOLUME_MOUNT_PATH (mis. /data) otomatis dipakai.
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let state;
let timer = null;

function persistNow() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}

function save() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; persistNow(); }, 300);
}

try {
  state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  state = {
    meta: { secret: crypto.randomBytes(32).toString('hex'), createdAt: Date.now() },
    users: [],
    events: []
  };
  persistNow();
}
state.users ||= [];
state.events ||= [];

const MAX_EVENTS = 300000;
function addEvent(ev) {
  state.events.push(ev);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  save();
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { try { persistNow(); } finally { process.exit(0); } });
}

module.exports = {
  get state() { return state; },
  save,
  persistNow,
  addEvent,
  DATA_DIR,
  UPLOAD_DIR
};
