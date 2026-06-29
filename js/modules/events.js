// ─── EVENTS (camps, tournaments) ──────────────────────────
// An event owns its own roster and per-day attendance map:
//   { id, name, startDate, endDate, roster: [name], attendance: { 'YYYY-MM-DD': { present, savedAt } } }

const EV_DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function eventDates(ev) {
  // Newer events store an explicit list of selected days; older ones a start/end range.
  if (ev.dates && ev.dates.length) return [...ev.dates].sort();
  const out = [];
  if (!ev.startDate || !ev.endDate) return out;
  let cur = parseDate(ev.startDate);
  const end = parseDate(ev.endDate);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(dateISO(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    guard++;
  }
  return out;
}

let _eventType = 'camp';
function setEventType(tp) {
  _eventType = tp;
  ['camp','tournament'].forEach(x => document.getElementById('evt-' + x)?.classList.toggle('active', x === tp));
}

// Flat list of assigned real-coach uids — kept on the doc so Firestore rules can gate writes.
function eventCoachIds(coaches) {
  return [...new Set((coaches || []).map(c => c.coachId).filter(Boolean))];
}

function coachHasEventAccess() {
  if (isAdmin()) return true;
  if (!currentUser) return false;
  return events.some(ev => (ev.coaches || []).some(c => c.coachId === currentUser.id));
}

// Show/hide the Events nav: admins always; coaches only when assigned to ≥1 event.
function updateEventsNav() {
  const show = coachHasEventAccess();
  ['nav-events', 'snav-events'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
  if (!show && document.getElementById('screen-events')?.classList.contains('active')) showScreen('calendar');
}

// Groups the current user may mark for this event. No groups → whole roster as one ('all').
function accessibleGroups(ev) {
  if ((ev.type || 'camp') !== 'camp' || !(ev.groups && ev.groups.length)) {
    return [{ id: 'all', name: t('roster'), players: ev.roster || [] }];
  }
  if (isAdmin()) return ev.groups.map(g => ({ id: g.id, name: g.name, players: g.players || [] }));
  const mySlots = new Set((ev.coaches || []).filter(c => c.coachId === currentUser.id).map(c => c.id));
  return ev.groups.filter(g => mySlots.has(g.coachSlotId)).map(g => ({ id: g.id, name: g.name, players: g.players || [] }));
}

// Attendance record for a day+group, tolerating the legacy flat shape ({present, savedAt}).
function dayAtt(ev, date, groupId) {
  const day = ev.attendance?.[date];
  if (!day) return null;
  if (Array.isArray(day.present)) return groupId === 'all' ? day : null;
  return day[groupId] || null;
}

function fmtEventRange(a, b) {
  if (!a) return '';
  const da = parseDate(a), dbb = parseDate(b || a);
  if (a === (b || a)) return `${da.getDate()} ${monthName(da.getMonth())} ${da.getFullYear()}`;
  const sameMonth = da.getMonth() === dbb.getMonth() && da.getFullYear() === dbb.getFullYear();
  return sameMonth
    ? `${da.getDate()} – ${dbb.getDate()} ${monthName(dbb.getMonth())} ${dbb.getFullYear()}`
    : `${da.getDate()} ${monthName(da.getMonth())} – ${dbb.getDate()} ${monthName(dbb.getMonth())} ${dbb.getFullYear()}`;
}

function renderEvents() {
  updateEventsNav();
  const addRow = document.getElementById('events-add-btn-row');
  if (addRow) addRow.style.display = isAdmin() ? '' : 'none';

  const el = document.getElementById('events-list');
  if (!el) return;
  // Coaches see only events they're assigned to.
  const visible = isAdmin() ? events : events.filter(ev => (ev.coaches || []).some(c => c.coachId === currentUser.id));
  if (!visible.length) { el.innerHTML = `<div class="empty">${t('noEvents')}</div>`; return; }

  el.innerHTML = visible.map(ev => {
    const days     = eventDates(ev);
    const rosterN  = (ev.roster || []).length;
    const markedN  = days.filter(d => ev.attendance?.[d]).length;
    const typeColor = ev.type === 'tournament' ? 'var(--orange)' : 'var(--blue)';
    const typeBg    = ev.type === 'tournament' ? 'rgba(251,146,60,0.18)' : 'rgba(96,165,250,0.18)';
    const typeBadge = `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${typeBg};color:${typeColor}">${t(ev.type || 'camp')}</span>`;
    return `<div class="card" onclick="openEvent('${escQ(ev.id)}')" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:8px"><div style="font-size:16px;font-weight:600">${escH(ev.name)}</div>${typeBadge}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">${fmtEventRange(ev.startDate, ev.endDate)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">${rosterN} ${t('players')}${SEP}${markedN}/${days.length} ${t('day')}</div>
        </div>
        <span style="font-size:22px;color:var(--text3);flex-shrink:0">›</span>
      </div>
    </div>`;
  }).join('');
}

function openAddEventModal() {
  if (!isAdmin()) return;
  _eventType = 'camp';
  dpInit('dp-container', []);
  createModal(`
    <div class="sheet-title">${t('newEvent')}</div>
    <div class="form-group">
      <label class="form-label">${t('eventName')}</label>
      <input type="text" id="ev-name" placeholder="${t('eventName')}">
    </div>
    <div class="form-group">
      <label class="form-label">${t('eventType')}</label>
      <div class="chip-group">
        <button class="chip active" id="evt-camp" onclick="setEventType('camp')">${t('camp')}</button>
        <button class="chip" id="evt-tournament" onclick="setEventType('tournament')">${t('tournament')}</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">${t('eventDays')}</label>
      <div id="dp-container"></div>
    </div>
    <div id="ev-error" class="error-box" style="margin-bottom:8px"></div>
    <button class="btn btn-primary" style="margin-top:4px" onclick="saveNewEvent()">${t('save')}</button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
  dpRender('dp-container');
  setTimeout(() => document.getElementById('ev-name')?.focus(), 80);
}

async function saveNewEvent() {
  if (!isAdmin()) return;
  const name  = document.getElementById('ev-name')?.value.trim();
  const dates = dpGetDates('dp-container');
  const errEl = document.getElementById('ev-error');
  if (!name) return;
  if (!dates.length) {
    if (errEl) { errEl.textContent = t('errNoDays'); errEl.style.display = 'block'; }
    return;
  }
  const id = 'e' + Date.now();
  await saveEvent(id, {
    id, name, type: _eventType, dates,
    startDate: dates[0], endDate: dates[dates.length - 1],
    roster: [], attendance: {}, coaches: [], groups: [], coachIds: [],
    createdBy: currentUser.id, createdAt: Date.now()
  });
  logActivity('CREATE_EVENT', name);
  closeModal();
}

function openEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const admin = isAdmin();
  const days = eventDates(ev);
  const accGroups = accessibleGroups(ev);
  const totalPlayers = accGroups.reduce((s, g) => s + (g.players?.length || 0), 0);

  // Day list — present/total scoped to what THIS user can mark (admin: full; coach: their group)
  const dayRows = days.map(d => {
    const present = accGroups.reduce((s, g) => { const a = dayAtt(ev, d, g.id); return s + (a ? (a.present || []).length : 0); }, 0);
    const anyMarked = accGroups.some(g => dayAtt(ev, d, g.id));
    const [y, mo, dd] = d.split('-').map(Number);
    const dow = new Date(y, mo - 1, dd).getDay();
    const label = `${t(EV_DAY_KEYS[dow])} ${dd}/${mo}`;
    const status = anyMarked
      ? `<span style="font-size:12px;color:var(--green);font-weight:600">${present}/${totalPlayers}</span>`
      : `<span style="font-size:12px;color:var(--text3)">—</span>`;
    return `<div onclick="openEventDay('${escQ(eventId)}','${d}')" style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <span style="font-size:14px">${escH(label)}</span>${status}
    </div>`;
  }).join('') || `<div style="font-size:13px;color:var(--text3);padding:10px 0">—</div>`;

  // Admin-only management blocks (roster + camp coaches/groups)
  let adminBlocks = '';
  if (admin) {
    const rosterChips = (ev.roster || []).map(n =>
      `<span class="player-chip">${escH(n)}<span class="rm" onclick="removeEventRosterPlayer('${escQ(eventId)}','${escQ(n)}')">×</span></span>`
    ).join('') || `<span style="font-size:13px;color:var(--text3)">${t('noPlayers')}</span>`;

    let campSections = '';
    if ((ev.type || 'camp') === 'camp') {
      const coachRows = (ev.coaches || []).map(c => {
        const opts = `<option value="">— ${t('selectCoach')} —</option>` +
          allCoaches.map(rc => `<option value="${rc.id}" ${c.coachId === rc.id ? 'selected' : ''}>${escH(rc.username)}</option>`).join('');
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:0.5px solid var(--border)">
          <span style="flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(eventCoachName(c))}</span>
          <select onchange="assignEventCoach('${escQ(eventId)}','${escQ(c.id)}',this.value)" style="width:auto;flex-shrink:0;font-size:12px;padding:5px 8px;max-width:150px">${opts}</select>
          <button onclick="removeEventCoach('${escQ(eventId)}','${escQ(c.id)}')" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 4px;line-height:1">×</button>
        </div>`;
      }).join('') || `<div style="font-size:13px;color:var(--text3);padding:6px 0">—</div>`;

      const groupRows = (ev.groups || []).map(g => {
        const coach = (ev.coaches || []).find(c => c.id === g.coachSlotId);
        const coachLabel = coach ? escH(eventCoachName(coach)) : `<span style="color:var(--text3)">${t('selectCoach')}</span>`;
        return `<div onclick="openEventGroup('${escQ(eventId)}','${escQ(g.id)}')" style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
          <div style="min-width:0"><div style="font-size:14px;font-weight:500">${escH(g.name)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">${(g.players || []).length} ${t('players')}${SEP}${coachLabel}</div></div>
          <span style="font-size:18px;color:var(--text3);flex-shrink:0">›</span>
        </div>`;
      }).join('') || `<div style="font-size:13px;color:var(--text3);padding:6px 0">—</div>`;

      campSections = `
        <div class="card-label" style="margin:16px 0 6px">${t('coaches')}</div>
        ${coachRows}
        <div class="add-row" style="margin-top:8px">
          <input type="text" id="ev-coach-input" placeholder="${t('coach')}"
            onkeydown="if(event.key==='Enter'){event.preventDefault();addEventCoach('${escQ(eventId)}')}">
          <button onclick="addEventCoach('${escQ(eventId)}')">${t('addPlayer')}</button>
        </div>

        <div class="card-label" style="margin:16px 0 6px">${t('groups')}</div>
        ${groupRows}
        <div class="add-row" style="margin-top:8px">
          <input type="text" id="ev-group-input" placeholder="${t('groupName')}"
            onkeydown="if(event.key==='Enter'){event.preventDefault();addEventGroup('${escQ(eventId)}')}">
          <button onclick="addEventGroup('${escQ(eventId)}')">${t('addPlayer')}</button>
        </div>`;
    }

    adminBlocks = `
      <div class="card-label" style="margin:16px 0 8px">${t('roster')}</div>
      <div class="player-chips" style="margin-bottom:10px">${rosterChips}</div>
      <div class="add-row">
        <input type="text" id="ev-roster-input" placeholder="${t('playerPlaceholder')}"
          onkeydown="if(event.key==='Enter'){event.preventDefault();addEventRosterPlayer('${escQ(eventId)}')}">
        <button onclick="addEventRosterPlayer('${escQ(eventId)}')">${t('addPlayer')}</button>
      </div>
      ${campSections}
      <button class="btn btn-danger" style="margin-top:18px" onclick="confirmDeleteEvent('${escQ(eventId)}')">${t('deleteEvent')}</button>`;
  }

  const editDaysBtn = admin
    ? `<button onclick="openEditEventDays('${escQ(eventId)}')" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:16px;padding:4px 12px;font-size:12px;color:var(--text2);cursor:pointer;font-family:inherit">${t('editDays')}</button>`
    : '';

  createModal(`
    <div class="sheet-title">${escH(ev.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:16px">${t(ev.type || 'camp')}${SEP}${fmtEventRange(ev.startDate, ev.endDate)}</div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="card-label" style="margin:0">${t('eventDays')}</div>
      ${editDaysBtn}
    </div>
    <div style="max-height:${admin ? '34vh' : '60vh'};overflow-y:auto;margin-bottom:6px">${dayRows}</div>
    ${adminBlocks}
    <button class="btn btn-secondary" style="margin-top:18px" onclick="closeModal()">${t('cancel')}</button>
  `);
}

async function addEventRosterPlayer(eventId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const input = document.getElementById('ev-roster-input');
  const name = input?.value.trim();
  if (!name) return;
  if ((ev.roster || []).includes(name)) { if (input) { input.value = ''; input.focus(); } return; }
  await saveEvent(eventId, { ...ev, roster: [...(ev.roster || []), name] });
  openEvent(eventId);
  setTimeout(() => document.getElementById('ev-roster-input')?.focus(), 60);
}

function removeEventRosterPlayer(eventId, name) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  showConfirmModal(`${t('delete')}: "${escH(name)}"?`, async () => {
    await saveEvent(eventId, { ...ev, roster: (ev.roster || []).filter(n => n !== name) });
    openEvent(eventId);
  });
}

function confirmDeleteEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  showTypeConfirmModal(`${t('deleteEvent')}: "${escH(ev.name)}"?`, async () => {
    await deleteEvent(eventId);
    closeModal();
  });
}

function openEditEventDays(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  dpInit('dp-container', eventDates(ev));
  createModal(`
    <div class="sheet-title">${t('editDays')}</div>
    <div id="dp-container"></div>
    <div id="ev-error" class="error-box" style="margin:8px 0 0"></div>
    <button class="btn btn-primary" style="margin-top:12px" onclick="saveEventDays('${escQ(eventId)}')">${t('save')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `);
  dpRender('dp-container');
}

async function saveEventDays(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const dates = dpGetDates('dp-container');
  const errEl = document.getElementById('ev-error');
  if (!dates.length) {
    if (errEl) { errEl.textContent = t('errNoDays'); errEl.style.display = 'block'; }
    return;
  }
  await saveEvent(eventId, { ...ev, dates, startDate: dates[0], endDate: dates[dates.length - 1] });
  openEvent(eventId);
}

// ─── CAMP COACHES ─────────────────────────────────────────
// A coach slot is generic (just a name) until assigned to a real coach account.
function eventCoachName(c) {
  if (c.coachId) { const rc = allCoaches.find(x => x.id === c.coachId); if (rc) return rc.username; }
  return c.name;
}

async function addEventCoach(eventId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const input = document.getElementById('ev-coach-input');
  const name = input?.value.trim();
  if (!name) return;
  const slot = { id: 'cs' + Date.now(), name, coachId: null };
  const coaches = [...(ev.coaches || []), slot];
  await saveEvent(eventId, { ...ev, coaches, coachIds: eventCoachIds(coaches) });
  openEvent(eventId);
}

async function assignEventCoach(eventId, slotId, coachId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const coaches = (ev.coaches || []).map(c => c.id === slotId ? { ...c, coachId: coachId || null } : c);
  await saveEvent(eventId, { ...ev, coaches, coachIds: eventCoachIds(coaches) });
  openEvent(eventId);
}

function removeEventCoach(eventId, slotId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  showConfirmModal(`${t('delete')}?`, async () => {
    const coaches = (ev.coaches || []).filter(c => c.id !== slotId);
    const groups  = (ev.groups || []).map(g => g.coachSlotId === slotId ? { ...g, coachSlotId: null } : g);
    await saveEvent(eventId, { ...ev, coaches, coachIds: eventCoachIds(coaches), groups });
    openEvent(eventId);
  });
}

// ─── CAMP GROUPS ──────────────────────────────────────────
async function addEventGroup(eventId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const input = document.getElementById('ev-group-input');
  const name = input?.value.trim();
  if (!name) return;
  const grp = { id: 'eg' + Date.now(), name, players: [], coachSlotId: null };
  await saveEvent(eventId, { ...ev, groups: [...(ev.groups || []), grp] });
  openEvent(eventId);
}

function openEventGroup(eventId, groupId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const grp = (ev.groups || []).find(g => g.id === groupId);
  if (!grp) return;
  const roster = ev.roster || [];

  const rows = roster.map(n =>
    `<label style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <input type="checkbox" data-name="${escH(n)}" ${(grp.players || []).includes(n) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--blue)">
      <span style="font-size:15px">${escH(n)}</span>
    </label>`
  ).join('') || `<p style="font-size:13px;color:var(--text3);padding:10px 0">${t('noPlayers')}</p>`;

  const coachOpts = `<option value="">— ${t('selectCoach')} —</option>` +
    (ev.coaches || []).map(c => `<option value="${c.id}" ${grp.coachSlotId === c.id ? 'selected' : ''}>${escH(eventCoachName(c))}</option>`).join('');

  createModal(`
    <div class="sheet-title">${escH(grp.name)}</div>
    <div class="form-group">
      <label class="form-label">${t('assignCoach')}</label>
      <select id="eg-coach">${coachOpts}</select>
    </div>
    <div class="card-label" style="margin:8px 0 4px">${t('roster')}</div>
    <div id="eg-rows" style="max-height:42vh;overflow-y:auto">${rows}</div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveEventGroup('${escQ(eventId)}','${escQ(groupId)}')">${t('save')}</button>
    <button class="btn btn-danger" style="margin-top:6px" onclick="deleteEventGroup('${escQ(eventId)}','${escQ(groupId)}')">${t('delete')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `);
}

async function saveEventGroup(eventId, groupId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const players = Array.from(document.querySelectorAll('#eg-rows input[type="checkbox"]:checked')).map(cb => cb.dataset.name);
  const coachSlotId = document.getElementById('eg-coach')?.value || null;
  const groups = (ev.groups || []).map(g => g.id === groupId ? { ...g, players, coachSlotId } : g);
  await saveEvent(eventId, { ...ev, groups });
  openEvent(eventId);
}

function deleteEventGroup(eventId, groupId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  showConfirmModal(`${t('deleteGroup')}?`, async () => {
    await saveEvent(eventId, { ...ev, groups: (ev.groups || []).filter(g => g.id !== groupId) });
    openEvent(eventId);
  });
}

// ─── EVENT DAY ATTENDANCE (per group) ─────────────────────
function openEventDay(eventId, date) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const groups = accessibleGroups(ev);
  if (groups.length === 1) { openEventGroupDay(eventId, date, groups[0].id); return; }
  if (!groups.length) {
    createModal(`<div class="sheet-title">${escH(ev.name)}</div>
      <p style="font-size:13px;color:var(--text2);padding:12px 0">${t('noPlayers')}</p>
      <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>`);
    return;
  }
  const [y, mo, dd] = date.split('-').map(Number);
  const dow = new Date(y, mo - 1, dd).getDay();
  const rows = groups.map(g => {
    const a = dayAtt(ev, date, g.id);
    const status = a
      ? `<span style="font-size:12px;color:var(--green);font-weight:600">${(a.present || []).length}/${g.players.length}</span>`
      : `<span style="font-size:12px;color:var(--text3)">—</span>`;
    return `<div onclick="openEventGroupDay('${escQ(eventId)}','${date}','${escQ(g.id)}')" style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <span style="font-size:14px">${escH(g.name)}</span>${status}
    </div>`;
  }).join('');
  createModal(`
    <div class="sheet-title">${escH(ev.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${t(EV_DAY_KEYS[dow])}${SEP}${dd}/${mo}/${y}</div>
    ${rows}
    <button class="btn btn-secondary" style="margin-top:14px" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `);
}

function openEventGroupDay(eventId, date, groupId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const grp = accessibleGroups(ev).find(g => g.id === groupId);
  if (!grp) { openEvent(eventId); return; }
  const att = dayAtt(ev, date, groupId) || {};
  const present = att.present || [];
  const [y, mo, dd] = date.split('-').map(Number);
  const dow = new Date(y, mo - 1, dd).getDay();

  const rows  = grp.players.map(n => attRowHtml(n, present.includes(n))).join('');
  const empty = !grp.players.length ? `<p id="att-empty" style="color:var(--text2);font-size:13px;padding:12px 0">${t('noPlayers')}</p>` : '';

  createModal(`
    <div class="sheet-title">${escH(grp.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${escH(ev.name)}${SEP}${t(EV_DAY_KEYS[dow])}${SEP}${dd}/${mo}/${y}${att.savedAt ? SEP + att.savedAt : ''}</div>
    <div id="att-rows">${rows}</div>${empty}
    <div class="add-row" style="margin-top:10px">
      <input type="text" id="att-add-input" placeholder="${t('playerPlaceholder')}"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addEventGroupDayPlayer('${escQ(eventId)}','${date}','${escQ(groupId)}')}">
      <button onclick="addEventGroupDayPlayer('${escQ(eventId)}','${date}','${escQ(groupId)}')">${t('addPlayer')}</button>
    </div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveEventGroupDay('${escQ(eventId)}','${date}','${escQ(groupId)}')">${t('saveAttendance')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `);
}

// Walk-in kid: add to the roster (and the marked group) and check them present.
async function addEventGroupDayPlayer(eventId, date, groupId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const input = document.getElementById('att-add-input');
  const name = input?.value.trim();
  if (!name) return;
  let roster = ev.roster || [];
  if (!roster.includes(name)) roster = [...roster, name];
  let groups = ev.groups || [];
  if (groupId !== 'all') {
    groups = groups.map(g => (g.id === groupId && !(g.players || []).includes(name)) ? { ...g, players: [...(g.players || []), name] } : g);
  }
  await saveEvent(eventId, { ...ev, roster, groups });
  const existing = document.getElementById('att-' + escId(name));
  if (existing) { existing.checked = true; }
  else {
    document.getElementById('att-empty')?.remove();
    document.getElementById('att-rows')?.insertAdjacentHTML('beforeend', attRowHtml(name, true));
  }
  if (input) { input.value = ''; input.focus(); }
}

async function saveEventGroupDay(eventId, date, groupId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const present = Array.from(document.querySelectorAll('#att-rows input[type="checkbox"]:checked'))
    .map(cb => cb.dataset.name)
    .filter(Boolean);
  const now = new Date();
  const savedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  let day = ev.attendance?.[date];
  if (day && Array.isArray(day.present)) day = { all: day }; // migrate legacy flat shape
  day = { ...(day || {}), [groupId]: { present, savedAt } };
  const attendance = { ...(ev.attendance || {}), [date]: day };
  await saveEvent(eventId, { ...ev, attendance });
  logActivity('EVENT_ATTENDANCE', `${ev.name} ${date} ${groupId}`);
  openEvent(eventId);
}
