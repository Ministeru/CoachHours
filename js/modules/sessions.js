// ─── SESSION MODAL (Admin) ─────────────────────────────────
// Modal state
let _modalSession = null; // null = new, object = editing

function openSessionModal(date, time, sessionId, presetGroupId) {
  if (!isAdmin()) return;
  _modalSession = sessionId ? sessions.find(s => s.id === sessionId) : null;
  const s = _modalSession;
  // Reset modal state vars to match current session (or defaults for new)
  _sessionType = s?.type || (presetGroupId ? 'group' : 'private');
  _recurringFreq = 'none';
  _activeDuration = 60;
  _rainMode = s?.cancelled ? (s.cancelled.general ? 'general' : s.cancelled.whole ? 'whole' : s.cancelled.from ? 'from' : 'none') : 'none';

  const defaultDate = date || dateISO(calDate);
  const defaultStart = time || '09:00';
  const defaultEnd   = time ? addMins(time, 60) : '10:00';

  const coachOptions = allCoaches.map(c =>
    `<option value="${c.id}" ${s?.assignedCoachId===c.id?'selected':''}>${escH(c.username)}</option>`
  ).join('');

  const groupOptions = Object.values(groups).map(g =>
    `<option value="${g.id}" ${(s?.groupId===g.id || (!s && presetGroupId===g.id))?'selected':''}>${escH(g.name)}</option>`
  ).join('');

  const recurringFreq = s?.recurring?.freq || 'none';
  const recurringUntil = s?.recurring?.until || '';

  let rainSection = '';
  if (s) {
    const isGeneral = s.cancelled?.general;
    const isWhole   = s.cancelled?.whole;
    const isFrom    = s.cancelled?.from;
    const isActive  = !isGeneral && !isWhole && !isFrom;
    rainSection = `<div class="form-group">
      <label class="form-label">${t('rainCancel')}</label>
      <div class="chip-group">
        <button class="chip${isActive?' active':''}" id="rain-none" onclick="setRainCancel('none')">${t('uncancel')}</button>
        <button class="chip${isGeneral?' active':''}" id="rain-general" onclick="setRainCancel('general')">${t('cancelGeneral')}</button>
        <button class="chip${isWhole?' active':''}" id="rain-whole" onclick="setRainCancel('whole')">${t('rainWhole')}</button>
        <button class="chip${isFrom?' active':''}" id="rain-from" onclick="setRainCancel('from')">${t('rainFrom')}</button>
      </div>
      <div id="rain-from-row" style="margin-top:8px;display:${isFrom?'':'none'}">
        <input type="time" id="rain-from-time" value="${s.cancelled?.from||''}">
      </div>
    </div>`;
  }

  // Build all-players datalist for private sessions
  const allPlayersList = getAllPlayers().map(p => `<option value="${escH(p)}">`).join('');

  const deleteBtn = s ? `<button class="btn btn-danger" style="margin-top:4px" onclick="confirmDeleteSession('${s.id}')">${t('deleteSession')}</button>` : '';

  createModal(`
    <div class="sheet-title">${s ? t('editSession') : t('newSession')}</div>

    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="sm-date" value="${s?s.date:defaultDate}"
        style="font-size:16px;font-weight:600;color:var(--accent)">
    </div>

    <div class="form-group">
      <label class="form-label">${t('sessionType')}</label>
      <div class="type-toggle">
        <button class="type-btn${_sessionType==='private'?' act-private':''}" id="sm-type-private" onclick="setSessionType('private')">${t('private')}</button>
        <button class="type-btn${_sessionType==='group'?' act-group':''}" id="sm-type-group" onclick="setSessionType('group')">${t('group')}</button>
      </div>
    </div>

    <div class="form-group" id="sm-group-row" style="display:${_sessionType==='group'?'':'none'}">
      <label class="form-label">${t('selectGroup')}</label>
      <select id="sm-group" onchange="onGroupChange(this.value)">
        <option value="">${t('selectGroup')}</option>${groupOptions}
      </select>
    </div>

    <div class="form-group" id="sm-player-row" style="display:${_sessionType==='private'?'':'none'}">
      <label class="form-label">${t('playerLabel')}</label>
      <input type="text" id="sm-player" list="sm-players-list" value="${escH(s?.assignedPlayerName||'')}" placeholder="${t('playerPlaceholder')}">
      <datalist id="sm-players-list">${allPlayersList}</datalist>
    </div>

    <div class="form-group">
      <label class="form-label">${t('sessionName')}</label>
      <input type="text" id="sm-name" value="${s?escH(s.name):''}" placeholder="${t('sessionName')}">
    </div>

    <div class="form-group">
      <label class="form-label">${t('notes')}</label>
      <textarea id="sm-notes" placeholder="${t('notes')}" style="width:100%;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-size:14px;color:var(--text);font-family:inherit;resize:vertical;min-height:56px">${s?escH(s.notes||''):''}</textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('startTime')}</label>
        <input type="time" id="sm-start" value="${s?s.startTime:defaultStart}" oninput="updateEndByDuration()">
      </div>
      <div class="form-group">
        <label class="form-label">${t('endTime')}</label>
        <input type="time" id="sm-end" value="${s?s.endTime:defaultEnd}" oninput="document.getElementById('sm-time-error').style.display='none'">
      </div>
    </div>
    <div id="sm-time-error" class="error-box" style="margin-bottom:8px"></div>

    ${!s ? `<div class="form-group">
      <label class="form-label">${t('duration')}</label>
      <div class="chip-group" id="duration-chips">
        <button class="chip" id="dur-45" onclick="setDuration(45)">45${t('min')}</button>
        <button class="chip active" id="dur-60" onclick="setDuration(60)">1${t('hr')}</button>
        <button class="chip" id="dur-90" onclick="setDuration(90)">1${t('hr')} 30${t('min')}</button>
      </div>
    </div>` : ''}

    <div class="form-group">
      <label class="form-label">${t('assignCoach')}</label>
      <select id="sm-coach"><option value="">${t('selectCoach')}</option>${coachOptions}</select>
    </div>

    ${!s ? `<div class="form-group">
      <label class="form-label">${t('recurring')}</label>
      <div class="chip-group">
        <button class="chip active" id="rec-none" onclick="setRecurring('none')">${t('recurringNone')}</button>
        <button class="chip" id="rec-weekly" onclick="setRecurring('weekly')">${t('recurringWeekly')}</button>
        <button class="chip" id="rec-biweekly" onclick="setRecurring('biweekly')">${t('recurringBiweekly')}</button>
        <button class="chip" id="rec-monthly" onclick="setRecurring('monthly')">${t('recurringMonthly')}</button>
      </div>
      <div id="rec-until-row" style="display:none;margin-top:8px">
        <label class="form-label">${t('until')}</label>
        <input type="date" id="sm-until" value="">
      </div>
    </div>` : ''}
    ${rainSection}
    <button class="btn btn-primary" style="margin-top:4px" onclick="saveSessionModal()">${t('save')}</button>
    ${deleteBtn}
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
}

function getAllPlayers() {
  const seen = new Set();
  Object.values(groups).forEach(g => g.players.forEach(p => seen.add(p)));
  Object.values(players).forEach(p => seen.add(p.name));
  return [...seen].sort();
}

function onGroupChange(groupId) {
  const g = groups[groupId];
  if (!g) return;
  const nameEl = document.getElementById('sm-name');
  if (nameEl) nameEl.value = g.name;
}

let _sessionType = 'private';
let _recurringFreq = 'none';
let _rainMode = 'none';

function setSessionType(type) {
  _sessionType = type;
  document.getElementById('sm-type-private')?.classList.toggle('act-private', type==='private');
  document.getElementById('sm-type-group')?.classList.toggle('act-group', type==='group');
  document.getElementById('sm-group-row').style.display  = type==='group'   ? '' : 'none';
  document.getElementById('sm-player-row').style.display = type==='private' ? '' : 'none';
}

function setRecurring(freq) {
  _recurringFreq = freq;
  ['none','weekly','biweekly','monthly'].forEach(f => {
    document.getElementById('rec-'+f)?.classList.toggle('active', f===freq);
  });
  const row = document.getElementById('rec-until-row');
  if (row) row.style.display = freq !== 'none' ? '' : 'none';
}

function setRainCancel(mode) {
  _rainMode = mode;
  const fromRow = document.getElementById('rain-from-row');
  if (fromRow) fromRow.style.display = mode==='from' ? '' : 'none';
  ['none','general','whole','from'].forEach(m => {
    document.getElementById('rain-'+m)?.classList.toggle('active', m===mode);
  });
}

let _activeDuration = 60;
function setDuration(mins) {
  _activeDuration = mins;
  [45,60,90].forEach(d => document.getElementById('dur-'+d)?.classList.toggle('active', d===mins));
  const start = document.getElementById('sm-start')?.value;
  if (start) document.getElementById('sm-end').value = addMins(start, mins);
}

function updateEndByDuration() {
  const start = document.getElementById('sm-start')?.value;
  if (start && document.getElementById('dur-60')) {
    document.getElementById('sm-end').value = addMins(start, _activeDuration);
  }
}

async function saveSessionModal() {
  const name  = document.getElementById('sm-name')?.value.trim();
  const start = document.getElementById('sm-start')?.value;
  const end   = document.getElementById('sm-end')?.value;
  const date  = document.getElementById('sm-date')?.value;
  const coach  = document.getElementById('sm-coach')?.value || null;
  const grp    = document.getElementById('sm-group')?.value || null;
  const player = document.getElementById('sm-player')?.value.trim() || null;
  const type   = document.getElementById('sm-type-group')?.classList.contains('act-group') ? 'group' : 'private';
  const notes  = document.getElementById('sm-notes')?.value.trim() || '';

  if (!name || !start || !end || !date) return;

  const timeErrEl = document.getElementById('sm-time-error');
  if (timeToMins(end) <= timeToMins(start)) {
    if (timeErrEl) { timeErrEl.textContent = t('errEndBeforeStart'); timeErrEl.style.display = 'block'; }
    return;
  }
  if (timeErrEl) timeErrEl.style.display = 'none';

  const base = {
    name, startTime: start, endTime: end, date, notes,
    type, assignedCoachId: coach || null,
    groupId: type==='group' ? grp : null,
    assignedPlayerName: type==='private' ? player : null,
    cancelled: false, attendance: null, recurring: null
  };

  if (_modalSession) {
    // Editing existing
    const patch = { name, startTime: start, endTime: end, date, notes, type, assignedCoachId: coach||null,
      groupId: type==='group'?grp:null, assignedPlayerName: type==='private'?player:null };
    // Handle cancellation
    if (_rainMode === 'none') patch.cancelled = false;
    else if (_rainMode === 'general') patch.cancelled = { general: true, whole: false, from: null };
    else if (_rainMode === 'whole') patch.cancelled = { whole: true, from: null, reason: 'rain' };
    else if (_rainMode === 'from') {
      const fromTime = document.getElementById('rain-from-time')?.value || start;
      patch.cancelled = { whole: false, from: fromTime, reason: 'rain' };
    }

    // Feature 4: find adjacent session before the write (uses in-memory sessions)
    const oldEndTime = _modalSession.endTime;
    const oldDate    = _modalSession.date;
    let adjacentSession = null;
    if (timeToMins(end) > timeToMins(oldEndTime)) {
      adjacentSession = sessions.find(s =>
        s.date === oldDate &&
        s.id !== _modalSession.id &&
        s.startTime === oldEndTime
      );
    }

    await updateSession(_modalSession.id, patch);
    logActivity('EDIT_SESSION', name);

    if (adjacentSession) {
      await updateSession(adjacentSession.id, { startTime: end });
    }
  } else {
    // New session
    const until = document.getElementById('sm-until')?.value;
    if (_recurringFreq !== 'none' && until) {
      await createRecurringSessions(base, _recurringFreq, until);
    } else {
      await createSession(base);
    }
  }
  closeModal();
}

function confirmDeleteSession(sessionId) {
  const s = sessions.find(x => x.id === sessionId);
  showConfirmModal(t('confirmDeleteMsg'), async () => {
    closeModal();
    await deleteSessionDoc(sessionId);
  });
}
