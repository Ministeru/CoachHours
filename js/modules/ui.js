// ─── MODAL HELPERS ────────────────────────────────────────
function createModal(html) {
  document.getElementById('app-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'app-modal';
  overlay.className = 'bottom-overlay';
  overlay.innerHTML = `<div class="bottom-sheet">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() { document.getElementById('app-modal')?.remove(); }

function showConfirmModal(message, callback) {
  createModal(`
    <div class="sheet-title">${t('confirmDelete')}</div>
    <p style="font-size:14px;color:var(--text2);margin-bottom:16px">${escH(message)}</p>
    <button class="btn" style="background:var(--red);color:#fff;margin-top:0;margin-bottom:6px"
      onclick="window._modalCb&&window._modalCb()">${t('confirm')}</button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
  window._modalCb = callback;
}

function showTypeConfirmModal(message, callback) {
  createModal(`
    <div class="sheet-title">${t('confirmDelete')}</div>
    <p style="font-size:14px;color:var(--text2);margin-bottom:12px">${escH(message)}</p>
    <p style="font-size:12px;color:var(--text3);margin-bottom:8px">${t('typeConfirmToDelete')}</p>
    <input type="text" id="type-confirm-input" placeholder="confirm" style="margin-bottom:12px"
      oninput="document.getElementById('type-confirm-btn').disabled=this.value.toLowerCase()!=='confirm'">
    <button id="type-confirm-btn" class="btn" style="background:var(--red);color:#fff;margin-top:0;margin-bottom:6px" disabled
      onclick="window._modalCb&&window._modalCb()">${t('confirm')}</button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
  window._modalCb = callback;
  setTimeout(() => document.getElementById('type-confirm-input')?.focus(), 80);
}


// ─── SCREEN NAV ───────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-'+name)?.classList.add('active');
  document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('snav-'+name)?.classList.add('active');
  if (name === 'calendar') renderCalendar();
  else if (name === 'groups') renderGroups();
  else if (name === 'summary') renderSummary();
  else if (name === 'settings') renderSettings();
  else if (name === 'admin') renderAdminPanel();
}
