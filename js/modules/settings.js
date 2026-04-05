// ─── SETTINGS ─────────────────────────────────────────────
function renderSettings() {
  const ratesSection = isAdmin() ? `
    <div class="section-divider">${t('rates')}</div>
    <div class="card">
      <div class="rate-row">
        <label>${t('ratePrivate')}</label>
        <input type="number" id="rate-private" value="${settings.ratePrivate}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('perHour')}</span>
      </div>
      <div class="rate-row">
        <label>${t('rateGroup')}</label>
        <input type="number" id="rate-group" value="${settings.rateGroup}" min="0" oninput="saveSettings()">
        <span class="rate-suffix">${t('perHour')}</span>
      </div>
    </div>` : '';

  const accountRole = isAdmin() ? t('adminCoach') : t('coach');

  document.getElementById('settings-body').innerHTML = `
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
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${escH(currentUser?.email||'')} · ${accountRole}</div>
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
