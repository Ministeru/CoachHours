// ─── ADMIN PANEL ──────────────────────────────────────────
let activityLog = [];
function logActivity(action, detail) {
  const entry = { t: new Date().toLocaleTimeString(), action, detail: detail||'' };
  activityLog.unshift(entry);
  if (activityLog.length > 100) activityLog.length = 100;
  console.log(`[CoachHours] ${entry.t} — ${action}${detail?': '+detail:''}`);
}

async function renderAdminPanel() {
  if (!currentUser || !isAdmin()) return;
  let html = `<div class="section-divider">${t('coaches')}</div><div class="card"><div id="admin-user-list"></div></div>`;
  html += `<div class="section-divider">${t('activityLog')}</div><div class="card">
    <div style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)" onclick="toggleActivityLog()">
      ${t('activityLog')} <span id="activity-log-arrow">›</span>
    </div>
    <div id="activity-log-body" style="display:none;margin-top:8px;font-size:12px;color:var(--text2);max-height:200px;overflow-y:auto"></div>
  </div>`;
  document.getElementById('admin-body').innerHTML = html;
  try {
    const snap = await db.collection('users').get();
    const others = snap.docs.filter(d => d.id !== currentUser.id && !d.data().removed);
    const el = document.getElementById('admin-user-list');
    if (!others.length) { el.innerHTML = `<div class="empty">${t('noCoaches')}</div>`; return; }
    el.innerHTML = others.map(d => {
      const u = d.data();
      return `<div style="display:flex;align-items:center;gap:6px;padding:9px 0;border-bottom:0.5px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(u.username)}</div>
          <div style="font-size:11px;color:var(--text3)">${escH(u.role)}</div>
        </div>
        <button onclick="adminView('${d.id}')" style="background:var(--blue-bg);color:var(--blue);border:none;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap">${t('viewCoach')}</button>
        <button onclick="adminToggleRole('${d.id}')" style="background:var(--bg3);color:var(--text2);border:0.5px solid var(--border);border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap">${u.role==='admin'?t('revokeAdmin'):t('makeAdmin')}</button>
        <button onclick="adminRemove('${d.id}')" style="background:var(--red-bg);color:var(--red);border:none;border-radius:6px;padding:5px 8px;font-size:12px;cursor:pointer;font-family:inherit">${t('removeCoach')}</button>
      </div>`;
    }).join('');
  } catch(e) { console.error('[CoachHours] Admin panel error:', e); }
}

function toggleActivityLog() {
  const body = document.getElementById('activity-log-body');
  const arrow = document.getElementById('activity-log-arrow');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if (arrow) arrow.textContent = open ? '↓' : '›';
  if (open) body.innerHTML = activityLog.length
    ? activityLog.map(e => `<div style="padding:4px 0;border-bottom:0.5px solid var(--border)">${escH(e.t)} <strong>${escH(e.action)}</strong>${e.detail?' · '+escH(e.detail):''}</div>`).join('')
    : `<div style="padding:8px 0">${t('noActivity')}</div>`;
}

async function adminView(userId) {
  if (!requireAuth()) return;
  logActivity('ADMIN_VIEW', userId);
  viewingUserId = userId;
  const snap = await db.collection('users').doc(userId).get();
  const u = snap.exists ? snap.data() : null;
  const app = document.querySelector('.app');
  app?.classList.add('viewing');
  let banner = document.getElementById('view-banner');
  if (!banner) { banner = document.createElement('div'); banner.id = 'view-banner'; app?.prepend(banner); }
  banner.innerHTML = `<span>${t('viewing')}: ${escH(u?.username||'')}</span><button onclick="adminExitView()" style="background:rgba(0,0,0,0.15);border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;color:#111;font-weight:600">${t('exitView')}</button>`;
  showScreen('calendar');
}

async function adminExitView() {
  viewingUserId = null;
  document.getElementById('view-banner')?.remove();
  document.querySelector('.app')?.classList.remove('viewing');
  showScreen('admin');
}

async function adminToggleRole(userId) {
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return;
    const newRole = doc.data().role === 'admin' ? 'coach' : 'admin';
    await db.collection('users').doc(userId).update({ role: newRole });
    logActivity('ADMIN_ROLE', `${doc.data().username} → ${newRole}`);
    renderAdminPanel();
  } catch(e) { console.error('[CoachHours] Toggle role failed:', e); }
}

function adminRemove(userId) {
  db.collection('users').doc(userId).get().then(doc => {
    if (!doc.exists) return;
    const u = doc.data();
    showConfirmModal(`${t('removeCoach')}: "${escH(u.username)}"?`, async () => {
      logActivity('ADMIN_REMOVE', u.username);
      await db.collection('users').doc(userId).update({ removed: true });
      closeModal();
      renderAdminPanel();
    });
  });
}
