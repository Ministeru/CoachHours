// ─── HELPERS ──────────────────────────────────────────────
function escQ(s) { return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function escH(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escId(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

function timeToMins(t) { const [h,m] = t.trim().split(':').map(Number); return h*60+m; }
function fmtHours(mins) {
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  if (h === 0) return m + t('min');
  if (m === 0) return h + t('hr');
  return h + t('hr') + ' ' + m + t('min');
}
function fmtHoursDecimal(hours) { return fmtHours(Math.round(hours * 60)); }
function addMins(time, mins) {
  const [h,m] = time.split(':').map(Number);
  const t = h*60+m+mins;
  return String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}

function isAdmin() { return currentUser?.role === 'admin'; }
function activeUid() { return viewingUserId || currentUser?.id || ''; }
function requireAuth() { if (!currentUser) { logoutUser(); return false; } return true; }

// Pad date parts
function dateISO(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parseDate(str) {
  // str = 'YYYY-MM-DD'
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y,m-1,d);
}

const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
function monthName(idx) { return t(MONTH_NAMES[idx]); }
function dayHeader(idx) { return t(DAY_KEYS[idx]); } // 0=sun
