// ─── SETTINGS ─────────────────────────────────────────────
const APP_URL = 'https://ministeru.github.io/CoachHours/';

function isStandalonePWA() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function appQrSvg() {
  const qr = qrcode(0, 'M');
  qr.addData(APP_URL);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
}

function renderInstallSection() {
  if (isStandalonePWA()) return '';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const action = deferredInstallPrompt
    ? `<button class="btn btn-primary" style="margin-top:0" onclick="promptInstallApp()">${t('installBtn')}</button>`
    : `<p style="font-size:13px;color:var(--text2)">${isIOS ? t('iosInstallHint') : t('genericInstallHint')}</p>`;
  return `
    <div class="section-divider">${t('installApp')}</div>
    <div class="card">
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${t('installAppDesc')}</div>
      ${action}
      <div style="display:flex;align-items:center;gap:14px;margin-top:14px;padding-top:14px;border-top:0.5px solid var(--border)">
        <div style="width:96px;height:96px;flex-shrink:0;background:#fff;border-radius:8px;padding:6px;box-sizing:border-box">${appQrSvg()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${t('scanToInstall')}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="text" readonly value="${APP_URL}" style="flex:1;font-size:11px;padding:8px 10px" dir="ltr" onclick="this.select()">
            <button onclick="copyAppLink()" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text);cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">${t('copyLink')}</button>
          </div>
        </div>
      </div>
      <div id="install-copy-msg" style="display:none;color:var(--green);font-size:12px;margin-top:8px">${t('copiedToClipboard')}</div>
    </div>`;
}

async function promptInstallApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderSettings();
}

async function copyAppLink() {
  try { await navigator.clipboard.writeText(APP_URL); } catch(e) {}
  const el = document.getElementById('install-copy-msg');
  if (el) { el.style.display = 'block'; setTimeout(() => { if (el) el.style.display = 'none'; }, 2000); }
}

function renderSettings() {
  const ratesSection = isAdmin() ? `
    <div class="section-divider">${t('rates')}</div>
    <div class="card">
      <div class="rate-row">
        <label>${t('ratePrivate')}</label>
        <input type="number" id="rate-private" value="${settings.ratePrivate}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('per45min')}</span>
      </div>
      <div class="rate-row">
        <label>${t('rateGroup')}</label>
        <input type="number" id="rate-group" value="${settings.rateGroup}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('perHour')}</span>
      </div>
      <div class="rate-row">
        <label>${t('rateDouble')}</label>
        <input type="number" id="rate-double" value="${settings.rateDouble}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('per45min')}</span>
      </div>
      <div class="rate-row">
        <label>${t('rateCamp')}</label>
        <input type="number" id="rate-camp" value="${settings.rateCamp}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('perHour')}</span>
      </div>
      <div class="rate-row">
        <label>${t('transportBonus')}</label>
        <input type="number" id="rate-transport" value="${settings.transportBonus}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('perDay')}</span>
      </div>
    </div>` : '';

  const accountRole = isAdmin() ? `${t('adminCoach')}${SEP}${t('coach')}` : t('coach');

  document.getElementById('settings-body').innerHTML = `
    ${renderInstallSection()}
    ${ratesSection}
    <div class="section-divider">${t('language')}</div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:14px">${t('language')}</span>
        <div class="type-toggle" style="width:auto">
          <button class="type-btn${lang==='he'?' act-group':''}" style="padding:8px 16px;font-size:13px" onclick="setLang('he')">עברית</button>
          <button class="type-btn${lang==='en'?' act-private':''}" style="padding:8px 16px;font-size:13px" onclick="setLang('en')">English</button>
        </div>
      </div>
    </div>
    <div class="section-divider">${t('account')}</div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:500">${escH(currentUser?.username||'')}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${escH(currentUser?.email||'')}${SEP}${accountRole}</div>
        </div>
        <button onclick="logoutUser()" style="background:var(--red-bg);color:var(--red);border:0.5px solid var(--red);border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit">${t('signOut')}</button>
      </div>
      <div style="border-top:0.5px solid var(--border);margin-top:12px;padding-top:10px">
        <button onclick="toggleChangePwd()" style="background:none;border:none;color:var(--text2);font-size:13px;cursor:pointer;font-family:inherit;padding:0;display:flex;align-items:center;gap:6px">
          <span id="change-pwd-arrow" style="font-size:10px;display:inline-block;transition:transform 0.2s">▶</span>${t('changePassword')}
        </button>
        <div id="change-pwd-section" style="display:none;margin-top:12px">
          <div id="change-pwd-error" class="error-box" style="margin-bottom:10px"></div>
          <div style="margin-bottom:10px">
            <label class="form-label">${t('newPassword')}</label>
            <input type="password" id="pwd-new" style="width:100%" dir="ltr">
          </div>
          <div style="margin-bottom:12px">
            <label class="form-label">${t('confirmPassword')}</label>
            <input type="password" id="pwd-confirm" style="width:100%" dir="ltr">
          </div>
          <button onclick="changePassword()" style="background:var(--bg3);color:var(--text);border:0.5px solid var(--border);border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:inherit;width:100%">${t('updatePassword')}</button>
          <div id="change-pwd-ok" style="display:none;color:var(--green);font-size:13px;margin-top:8px;text-align:center">${t('passwordUpdated')}</div>
        </div>
      </div>
    </div>
  `;
}

function saveSettings() {
  if (!isAdmin()) return;
  settings.ratePrivate = parseFloat(document.getElementById('rate-private')?.value) || 80;
  settings.rateGroup   = parseFloat(document.getElementById('rate-group')?.value)   || 50;
  settings.rateDouble      = parseFloat(document.getElementById('rate-double')?.value)    || 120;
  settings.rateCamp        = parseFloat(document.getElementById('rate-camp')?.value)      || 40;
  settings.transportBonus  = parseFloat(document.getElementById('rate-transport')?.value) ?? 15;
  saveUD('ch_settings', settings);
}

function toggleChangePwd() {
  const section = document.getElementById('change-pwd-section');
  const arrow   = document.getElementById('change-pwd-arrow');
  const open = section.style.display !== 'none';
  section.style.display = open ? 'none' : '';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

async function changePassword() {
  if (!requireAuth()) return;
  const newPwd  = document.getElementById('pwd-new')?.value;
  const confPwd = document.getElementById('pwd-confirm')?.value;
  const errEl   = document.getElementById('change-pwd-error');
  const okEl    = document.getElementById('change-pwd-ok');
  if (errEl) errEl.style.display = 'none';
  if (okEl) okEl.style.display = 'none';
  if (!newPwd || newPwd.length < 6) { if (errEl) { errEl.textContent = t('passwordTooShort'); errEl.style.display = 'block'; } return; }
  if (newPwd !== confPwd) { if (errEl) { errEl.textContent = t('passwordMismatch'); errEl.style.display = 'block'; } return; }
  try {
    await auth.currentUser.updatePassword(newPwd);
    if (document.getElementById('pwd-new')) document.getElementById('pwd-new').value = '';
    if (document.getElementById('pwd-confirm')) document.getElementById('pwd-confirm').value = '';
    if (okEl) okEl.style.display = 'block';
    logActivity('CHANGE_PASSWORD', currentUser?.username);
  } catch(e) {
    if (errEl) {
      errEl.textContent = e.code === 'auth/requires-recent-login' ? t('recentLoginRequired') : t('passwordUpdateError');
      errEl.style.display = 'block';
    }
  }
}
