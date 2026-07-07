// ─── EVENTS (camps, tournaments) ──────────────────────────
// An event owns its own roster and per-day attendance map:
//   { id, name, startDate, endDate, roster: [name], attendance: { 'YYYY-MM-DD': { present, savedAt } } }

const EV_DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ─── ATTENDANCE TRACKERS ───────────────────────────────────
// An event can have several independent attendance grids (Camp Attendance, Bus Attendance,
// or any admin-named one), each with its own expected/actual data — none of them share state
// with each other or with the per-group camp schedule/attendance system used for daily marking.
const DEFAULT_TRACKER_ID = 'at-default';

// Every event has at least the mandatory default tracker; older events (created before this
// feature) get it synthesized here rather than migrated, so nothing needs a data backfill.
function getEventTrackers(ev) {
  return (ev.attendanceTrackers && ev.attendanceTrackers.length)
    ? ev.attendanceTrackers
    : [{ id: DEFAULT_TRACKER_ID, name: t('campAttendance'), isDefault: true, createdAt: 0 }];
}

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

// Events nav is always visible for everyone; the screen itself shows an empty state when there's nothing to show.
function updateEventsNav() {
  ['nav-events', 'snav-events'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

// Groups the current user may mark for this event. No groups → whole roster as one ('all').
function accessibleGroups(ev) {
  if ((ev.type || 'camp') !== 'camp' || !(ev.groups && ev.groups.length)) {
    return [{ id: 'all', name: t('roster'), players: ev.roster || [] }];
  }
  if (isAdmin()) return ev.groups.map(g => ({ id: g.id, name: g.name, players: g.players || [] }));
  const mySlots = new Set((ev.coaches || []).filter(c => c.coachId === activeUid()).map(c => c.id));
  return ev.groups.filter(g => mySlots.has(g.coachSlotId)).map(g => ({ id: g.id, name: g.name, players: g.players || [] }));
}

// Attendance record for a day+group, tolerating the legacy flat shape ({present, savedAt}).
function dayAtt(ev, date, groupId) {
  const day = ev.attendance?.[date];
  if (!day) return null;
  if (Array.isArray(day.present)) return groupId === 'all' ? day : null;
  return day[groupId] || null;
}

// ─── ATTENDANCE TRACKER GRID ───────────────────────────────
// Each admin-defined tracker (Camp Attendance, Bus Attendance, or any custom name — see
// getEventTrackers/createAttendanceTracker above) has its own independent expected/actual axis,
// entirely separate from the per-group camp schedule/attendance used for daily marking. A kid
// can attend camp via a parent drop-off without riding the bus, or vice versa, so trackers must
// never share state with each other.
//   ev.trackerData[trackerId].schedule   = { 'YYYY-MM-DD': { [name]: true } }  — sparse; missing = not expected
//   ev.trackerData[trackerId].attendance = { 'YYYY-MM-DD': { present: [name,...], savedAt, savedBy } }

// Names grouped by an arbitrary per-player key map, in first-used order; players missing
// a key fall under a shared "none" bucket. includedSet, if given, restricts to that subset
// (a tracker's chosen participants); null = everyone.
function groupedRoster(names, keyMap, noneLabel, includedSet) {
  const order = [];
  const map = new Map();
  names.forEach(name => {
    if (includedSet && !includedSet.has(name)) return;
    const label = keyMap[name] || noneLabel;
    if (!map.has(label)) { map.set(label, []); order.push(label); }
    map.get(label).push(name);
  });
  return order.map(label => ({ label, players: map.get(label) }));
}

// Which per-player attribute a tracker groups its roster by. The mandatory default tracker
// (Camp Attendance) groups by each player's regular home coach, since that's how the
// whole-camp roster sheets were organized; any other tracker (e.g. Bus Attendance) groups by
// pickup location, since that's the logistics that actually matters for a bus route. A
// tracker can override this explicitly via tracker.groupBy ('coach' | 'location').
function trackerGroupBy(tracker) {
  return tracker.groupBy || (tracker.isDefault ? 'coach' : 'location');
}

// The exact list of names Camp Attendance should show a row for. Deliberately the same list a
// coach taps through when taking daily attendance (the union of every real ev.groups member) —
// not the separately-maintained ev.roster — so a name checked present in the daily roll-call is
// *the same string* as the row it needs to match here, with no risk of the two drifting apart.
// Falls back to ev.roster when no real groups exist yet (the single pseudo-group 'all' case).
function campAttendanceRoster(ev) {
  if ((ev.type || 'camp') === 'camp' && ev.groups && ev.groups.length) {
    return [...new Set(ev.groups.flatMap(g => g.players || []))];
  }
  return ev.roster || [];
}

function groupedRosterForTracker(ev, tracker, includedSet) {
  const names = tracker.id === DEFAULT_TRACKER_ID ? campAttendanceRoster(ev) : (ev.roster || []);
  return trackerGroupBy(tracker) === 'coach'
    ? groupedRoster(names, ev.playerCoach || {}, t('noCoach'), includedSet)
    : groupedRoster(names, ev.pickupLocations || {}, t('noLocation'), includedSet);
}

// A tracker with no explicit `included` list means "everyone" (the default Camp Attendance
// tracker never needs upkeep as the roster grows); a custom tracker's included list is explicit.
function trackerIncludedSet(tracker) {
  return tracker.included ? new Set(tracker.included) : null;
}

// Every name marked present for this day, across every group (a coach can only check off names
// already sitting in their group's roster, so anyone here is a real, legitimate attendee — even
// if they were never added to the top-level event roster). Used to reconcile Camp Attendance's
// totals with the real daily checklist, and to surface those extra kids as their own grid rows.
function campActualPresentSet(ev, date) {
  const day = ev.attendance?.[date];
  const set = new Set();
  if (!day) return set;
  if (Array.isArray(day.present)) { day.present.forEach(n => set.add(n)); return set; }
  Object.values(day).forEach(rec => (rec.present || []).forEach(n => set.add(n)));
  return set;
}

// Real actual-attendance record for the whole-camp default tracker: read straight from the
// existing daily roll-call (ev.attendance) that coaches already fill in every day. Matches by
// exact name across *every* group recorded that day, rather than requiring the player to be a
// current member of one specific ev.groups entry — group membership and the roster can drift
// (groups created after attendance was already being taken under the single-roster fallback,
// players checked present without ever being formally added to a group), and this tracker must
// still reflect the real daily numbers regardless.
function campDayAttendance(ev, date, name) {
  const day = ev.attendance?.[date];
  if (!day) return null;
  return { present: campActualPresentSet(ev, date).has(name) ? [name] : [] };
}

// Whether a player is expected on a given tracker/day. The default Camp Attendance tracker
// treats every roster player as expected unless explicitly marked otherwise (being enrolled in
// camp IS the expectation); custom trackers (bus, etc.) default to not-expected until opted in,
// since only a subset of the roster usually participates.
function dayExpected(ev, trackerId, date, name) {
  const mark = ev.trackerData?.[trackerId]?.schedule?.[date]?.[name];
  return trackerId === DEFAULT_TRACKER_ID ? mark !== false : !!mark;
}

// One grid cell's glyph + CSS class, comparing this tracker's expected-vs-actual data.
function cellMarker(ev, trackerId, date, name) {
  const expected = dayExpected(ev, trackerId, date, name);
  const att = trackerId === DEFAULT_TRACKER_ID
    ? campDayAttendance(ev, date, name)
    : (ev.trackerData?.[trackerId]?.attendance?.[date] || null);
  if (!att) return expected ? { sym: '✓', cls: 'exp-pending' } : { sym: '✕', cls: 'exp-no' };
  const came = (att.present || []).includes(name);
  if (expected && came) return { sym: '✓', cls: 'exp-ok' };
  if (expected && !came) return { sym: '✕', cls: 'exp-miss' };
  if (!expected && came) return { sym: '✓', cls: 'exp-extra' };
  return { sym: '✕', cls: 'exp-no' };
}

// Rolls up this tracker's day-by-day roll calls into one number per player: how many of the
// camp's days did they actually attend, out of how many days have been marked so far.
function trackerPlayerTotal(ev, trackerId, days, name) {
  const data = ev.trackerData?.[trackerId] || {};
  let present = 0, marked = 0;
  days.forEach(d => {
    const att = trackerId === DEFAULT_TRACKER_ID ? campDayAttendance(ev, d, name) : data.attendance?.[d];
    if (!att) return;
    marked++;
    if ((att.present || []).includes(name)) present++;
  });
  return { present, marked };
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

  // Preserve search/sort values across re-renders
  const prevQuery = document.getElementById('events-search')?.value || '';
  const prevSort  = document.getElementById('events-sort')?.value  || 'date';

  // Inject controls into their container (only once per render cycle; values preserved above)
  const ctrlEl = document.getElementById('events-controls');
  if (ctrlEl) ctrlEl.innerHTML = `
    <div style="padding:0 16px 10px;display:flex;gap:8px">
      <input type="search" id="events-search" value="${escH(prevQuery)}" placeholder="${t('searchEvents')}" oninput="renderEvents()"
        style="flex:1;min-width:0;width:0;padding:8px 12px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:14px;font-family:inherit;outline:none">
      <select id="events-sort" onchange="renderEvents()"
        style="padding:8px 10px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;flex-shrink:0">
        <option value="date"${prevSort==='date'?' selected':''}>${t('sortDate')}</option>
        <option value="name"${prevSort==='name'?' selected':''}>${t('sortName')}</option>
        <option value="created"${prevSort==='created'?' selected':''}>${t('sortCreated')}</option>
      </select>
    </div>`;

  const query = prevQuery.trim().toLowerCase();
  const sort  = prevSort;

  // Coaches see only events they're assigned to.
  const uid = activeUid();
  let visible = isAdmin() ? [...events] : events.filter(ev => (ev.coaches || []).some(c => c.coachId === uid));

  // Player / name search
  if (query) {
    visible = visible.filter(ev => {
      if (ev.name?.toLowerCase().includes(query)) return true;
      const allPlayers = [
        ...(ev.roster || []),
        ...(ev.groups || []).flatMap(g => g.players || [])
      ];
      return allPlayers.some(n => n.toLowerCase().includes(query));
    });
  }

  // Sort
  if (sort === 'name') {
    visible.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  } else if (sort === 'created') {
    visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else {
    // By start date — soonest first
    visible.sort((a, b) => {
      const da = a.dates?.[0] || a.startDate || '';
      const db = b.dates?.[0] || b.startDate || '';
      return da.localeCompare(db);
    });
  }

  if (!visible.length) { el.innerHTML = `<div class="empty">${query ? t('noResults') : t('noEvents')}</div>`; return; }

  el.innerHTML = visible.map(ev => {
    const days     = eventDates(ev);
    const accGrps  = accessibleGroups(ev);
    const rosterN  = isAdmin() ? (ev.roster || []).length : accGrps.reduce((s, g) => s + (g.players || []).length, 0);
    const markedN  = days.filter(d => accGrps.some(g => dayAtt(ev, d, g.id))).length;
    const typeColor = ev.type === 'tournament' ? 'var(--orange)' : 'var(--blue)';
    const typeBg    = ev.type === 'tournament' ? 'rgba(251,146,60,0.18)' : 'rgba(96,165,250,0.18)';
    const typeBadge = `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${typeBg};color:${typeColor}">${t(ev.type || 'camp')}</span>`;

    // Show matched player names under the card when searching
    let matchRow = '';
    if (query) {
      const allPlayers = [...new Set([...(ev.roster || []), ...(ev.groups || []).flatMap(g => g.players || [])])];
      const matched = allPlayers.filter(n => n.toLowerCase().includes(query));
      if (matched.length) {
        matchRow = `<div style="font-size:11px;color:var(--blue);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${matched.map(n => escH(n)).join(' · ')}</div>`;
      }
    }

    return `<div class="card" onclick="openEvent('${escQ(ev.id)}')" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:8px"><div style="font-size:16px;font-weight:600">${escH(ev.name)}</div>${typeBadge}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">${fmtEventRange(ev.startDate, ev.endDate)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">${rosterN} ${t('players')}${SEP}${markedN}/${days.length} ${t('day')}</div>
          ${matchRow}
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
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('startTime')}</label>
        <input type="time" id="ev-start" value="09:00">
      </div>
      <div class="form-group">
        <label class="form-label">${t('endTime')}</label>
        <input type="time" id="ev-end" value="17:00">
      </div>
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
  const startTime = document.getElementById('ev-start')?.value || null;
  const endTime   = document.getElementById('ev-end')?.value || null;
  const id = 'e' + Date.now();
  await saveEvent(id, {
    id, name, type: _eventType, dates,
    startDate: dates[0], endDate: dates[dates.length - 1],
    startTime: startTime || null, endTime: endTime || null,
    roster: [], attendance: {}, coaches: [], groups: [], coachIds: [],
    attendanceTrackers: [{ id: DEFAULT_TRACKER_ID, name: t('campAttendance'), isDefault: true, createdAt: Date.now() }],
    trackerData: {},
    createdBy: currentUser.id, createdAt: Date.now()
  });
  logActivity('CREATE_EVENT', name);
  closeModal();
}

function buildRosterList(eventId, roster, query, sort) {
  let players = query ? roster.filter(n => n.toLowerCase().includes(query.toLowerCase())) : [...roster];
  if (sort === 'az') players.sort((a, b) => a.localeCompare(b, 'he'));
  else if (sort === 'za') players.sort((a, b) => b.localeCompare(a, 'he'));
  if (!players.length) return `<div style="font-size:13px;color:var(--text3);padding:8px 0">${t('noPlayers')}</div>`;
  return players.map((n, i) =>
    `<div style="display:flex;align-items:center;padding:9px 0;border-bottom:0.5px solid var(--border)" data-roster-row="${escH(n)}">
      <span style="font-size:12px;color:var(--text3);min-width:26px">${i + 1}</span>
      <span class="roster-name-display" onclick="editRosterNameInline(this,'${escQ(eventId)}','${escQ(n)}')" style="flex:1;font-size:14px;cursor:pointer" title="${t('rename')}">${escH(n)}</span>
      <span class="roster-rename-btn" onclick="editRosterNameInline(this.previousElementSibling,'${escQ(eventId)}','${escQ(n)}')" title="${t('rename')}" style="color:var(--text3);font-size:14px;cursor:pointer;padding:0 8px;line-height:1">✎</span>
      <span onclick="removeEventRosterPlayer('${escQ(eventId)}','${escQ(n)}')" style="color:var(--text3);font-size:18px;cursor:pointer;padding:0 4px;line-height:1">×</span>
    </div>`
  ).join('');
}

function filterEventRoster(eventId, query, sort) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const el = document.getElementById('ev-roster-list');
  if (el) el.innerHTML = buildRosterList(eventId, ev.roster || [], query, sort);
}

// Tap a roster name → turn it into an inline text box in place, no separate screen.
function editRosterNameInline(el, eventId, oldName) {
  const row = el.closest('[data-roster-row]');
  if (!row || row.dataset.editing) return;
  row.dataset.editing = '1';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = 'flex:1;font-size:14px;padding:4px 8px';
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { input.dataset.cancel = '1'; input.blur(); }
  };
  input.onblur = () => commitRosterRename(eventId, oldName, input);
  el.replaceWith(input);
  input.focus();
  input.select();
}

async function commitRosterRename(eventId, oldName, input) {
  const cancelled = input.dataset.cancel === '1';
  const newName = input.value.trim();
  const refresh = () => filterEventRoster(
    eventId,
    document.getElementById('ev-roster-search')?.value || '',
    document.getElementById('ev-roster-sort')?.value || ''
  );
  if (cancelled || !newName || newName === oldName) { refresh(); return; }
  const ev = events.find(e => e.id === eventId);
  if (ev && (ev.roster || []).includes(newName)) {
    input.style.borderColor = 'var(--red)';
    input.title = t('errDuplicatePlayer');
    input.focus();
    return;
  }
  await renameEventRosterPlayer(eventId, oldName, newName);
}

// Renames a player everywhere within this event: roster, camp groups, camp schedule/attendance
// (per group/day), pickup location, and every attendance tracker's schedule/attendance/included
// lists — so a typo fix never orphans historical data or silently drops someone from a tracker.
async function renameEventRosterPlayer(eventId, oldName, newName) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;

  const roster = (ev.roster || []).map(n => n === oldName ? newName : n);
  const groups = (ev.groups || []).map(g => ({ ...g, players: (g.players || []).map(n => n === oldName ? newName : n) }));

  const attendance = {};
  Object.entries(ev.attendance || {}).forEach(([date, day]) => {
    if (Array.isArray(day.present)) {
      attendance[date] = { ...day, present: day.present.map(n => n === oldName ? newName : n) };
    } else {
      const newDay = {};
      Object.entries(day).forEach(([gid, rec]) => {
        newDay[gid] = { ...rec, present: (rec.present || []).map(n => n === oldName ? newName : n) };
      });
      attendance[date] = newDay;
    }
  });

  const schedule = {};
  Object.entries(ev.schedule || {}).forEach(([date, dayMap]) => {
    const newDayMap = {};
    Object.entries(dayMap).forEach(([gid, grpMap]) => {
      const newGrpMap = { ...grpMap };
      if (oldName in newGrpMap) { newGrpMap[newName] = newGrpMap[oldName]; delete newGrpMap[oldName]; }
      newDayMap[gid] = newGrpMap;
    });
    schedule[date] = newDayMap;
  });

  const pickupLocations = { ...(ev.pickupLocations || {}) };
  if (oldName in pickupLocations) { pickupLocations[newName] = pickupLocations[oldName]; delete pickupLocations[oldName]; }

  const playerCoach = { ...(ev.playerCoach || {}) };
  if (oldName in playerCoach) { playerCoach[newName] = playerCoach[oldName]; delete playerCoach[oldName]; }

  const trackerData = {};
  Object.entries(ev.trackerData || {}).forEach(([tid, data]) => {
    const newTrackerSchedule = {};
    Object.entries(data.schedule || {}).forEach(([date, dayMap]) => {
      const newDayMap = { ...dayMap };
      if (oldName in newDayMap) { newDayMap[newName] = newDayMap[oldName]; delete newDayMap[oldName]; }
      newTrackerSchedule[date] = newDayMap;
    });
    const newTrackerAttendance = {};
    Object.entries(data.attendance || {}).forEach(([date, rec]) => {
      newTrackerAttendance[date] = { ...rec, present: (rec.present || []).map(n => n === oldName ? newName : n) };
    });
    trackerData[tid] = {
      ...data,
      schedule: newTrackerSchedule,
      attendance: newTrackerAttendance,
      included: data.included ? data.included.map(n => n === oldName ? newName : n) : data.included
    };
  });

  await saveEvent(eventId, { ...ev, roster, groups, attendance, schedule, pickupLocations, playerCoach, trackerData });
  logActivity('RENAME_EVENT_PLAYER', `${oldName} → ${newName}`);
  openEvent(eventId);
}

function openEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const admin = isAdmin();
  const days = eventDates(ev);
  const accGroups = accessibleGroups(ev);
  const totalPlayers = accGroups.reduce((s, g) => s + (g.players?.length || 0), 0);

  // Day calendar — month grid, coaches can only tap today, admin can tap any event day.
  const todayISO = dateISO(new Date());
  const daySet = new Set(days);
  const monthKeys = [...new Set(days.map(d => d.slice(0, 7)))];
  const calGrids = monthKeys.map(ym => {
    const [cy, cm] = ym.split('-').map(Number);
    const firstDow = new Date(cy, cm - 1, 1).getDay();
    const daysInMonth = new Date(cy, cm, 0).getDate();
    const headers = DAY_KEYS.map(k => `<div class="month-day-header">${t(k)}</div>`).join('');
    const pads = Array(firstDow).fill('<div></div>').join('');
    const cells = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${cy}-${String(cm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isEventDay = daySet.has(iso);
      const isToday = iso === todayISO;
      const canMark = isEventDay && (admin || iso === todayISO);
      let statusHtml = '';
      if (isEventDay) {
        const anyMarked = accGroups.some(g => dayAtt(ev, iso, g.id));
        if (anyMarked) {
          const present = accGroups.reduce((s, g) => { const a = dayAtt(ev, iso, g.id); return s + (a ? (a.present || []).length : 0); }, 0);
          statusHtml = `<div style="font-size:9px;color:var(--green);font-weight:700;line-height:1.2">${present}/${totalPlayers}</div>`;
        }
      }
      const cellStyle = isEventDay
        ? `background:rgba(96,165,250,0.14);border:0.5px solid rgba(96,165,250,0.3);${canMark ? 'cursor:pointer;' : 'opacity:0.5;'}`
        : 'opacity:0.18;pointer-events:none;';
      cells.push(`<div class="month-day${isToday ? ' today' : ''}" ${canMark ? `onclick="openEventDay('${escQ(eventId)}','${iso}')"` : ''} style="${cellStyle}">
        <div class="month-day-num">${d}</div>${statusHtml}
      </div>`);
    }
    return `<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">${monthName(cm-1)} ${cy}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${headers}${pads}${cells.join('')}</div>`;
  }).join('<div style="height:10px"></div>');
  const dayRows = calGrids || `<div style="font-size:13px;color:var(--text3);padding:10px 0">—</div>`;

  // Admin-only management blocks (roster + camp coaches/groups)
  let adminBlocks = '';
  if (admin) {
    const rosterList = buildRosterList(eventId, ev.roster || [], '', '');

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
      <input type="search" id="ev-roster-search" placeholder="${lang==='he'?'חיפוש שחקן...':'Search player...'}"
        oninput="filterEventRoster('${escQ(eventId)}',this.value,document.getElementById('ev-roster-sort')?.value||'')"
        style="display:block;width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:14px;font-family:inherit;outline:none;margin-bottom:6px">
      <select id="ev-roster-sort" onchange="filterEventRoster('${escQ(eventId)}',document.getElementById('ev-roster-search')?.value||'',this.value)"
        style="display:block;width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;margin-bottom:8px">
        <option value="">${lang==='he'?'סדר הוספה':'Order added'}</option>
        <option value="az">${lang==='he'?'א → ת':'A → Z'}</option>
        <option value="za">${lang==='he'?'ת → א':'Z → A'}</option>
      </select>
      <div id="ev-roster-list" style="margin-bottom:10px">${rosterList}</div>
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

  const timeLine = (ev.startTime && ev.endTime)
    ? `${ev.startTime} – ${ev.endTime}`
    : (admin ? `<span style="color:var(--text3)">${lang==='he'?'שעות לא הוגדרו':'No hours set'}</span>` : '');
  const editTimesBtn = admin
    ? `<button onclick="openEditEventTimes('${escQ(eventId)}')" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:16px;padding:4px 12px;font-size:12px;color:var(--text2);cursor:pointer;font-family:inherit">${lang==='he'?'ערוך שעות':'Edit hours'}</button>`
    : '';

  const trackers = getEventTrackers(ev);
  const trackerRows = trackers.map(tr => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)">
      <span onclick="openEventGrid('${escQ(eventId)}','${escQ(tr.id)}')" style="flex:1;font-size:14px;cursor:pointer">${escH(tr.name)}</span>
      ${(admin && !tr.isDefault) ? `<span onclick="confirmDeleteAttendanceTracker('${escQ(eventId)}','${escQ(tr.id)}')" style="color:var(--text3);font-size:18px;cursor:pointer;padding:0 6px;line-height:1">×</span>` : ''}
      <span onclick="openEventGrid('${escQ(eventId)}','${escQ(tr.id)}')" style="font-size:18px;color:var(--text3);cursor:pointer;padding-inline-start:4px">›</span>
    </div>`).join('');
  const addTrackerRow = admin ? `<div class="add-row" style="margin-top:8px">
    <input type="text" id="ev-tracker-input" placeholder="${t('newAttendanceName')}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();createAttendanceTracker('${escQ(eventId)}')}">
    <button onclick="createAttendanceTracker('${escQ(eventId)}')">${t('createAttendance')}</button>
  </div>` : '';

  createModal(`
    <div class="sheet-title">${escH(ev.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${t(ev.type || 'camp')}${SEP}${fmtEventRange(ev.startDate, ev.endDate)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px">
      <span style="font-size:12px;color:var(--text2)">${timeLine}</span>
      ${editTimesBtn}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="card-label" style="margin:0">${t('eventDays')}</div>
      ${editDaysBtn}
    </div>
    <div style="max-height:${admin ? '34vh' : '60vh'};overflow-y:auto;margin-bottom:6px">${dayRows}</div>

    <div class="card-label" style="margin:16px 0 6px">${t('attendanceSection')}</div>
    ${trackerRows}
    ${addTrackerRow}
    ${adminBlocks}
    <button class="btn btn-secondary" style="margin-top:18px" onclick="closeModal()">${t('cancel')}</button>
  `, 'wide-sheet');
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

  const rows = roster.map(n => {
    const inCurrent = (grp.players || []).includes(n);
    const otherGrp  = (ev.groups || []).find(g => g.id !== groupId && (g.players || []).includes(n));
    const badge = otherGrp
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(251,146,60,0.15);color:var(--orange);white-space:nowrap;flex-shrink:0">${escH(otherGrp.name)}</span>`
      : '';
    return `<div data-pname="${escH(n)}" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border);cursor:pointer"
        onclick="var cb=this.querySelector('input');cb.checked=!cb.checked">
      <input type="checkbox" data-name="${escH(n)}" data-other="${escH(otherGrp?.id || '')}" ${inCurrent ? 'checked' : ''}
        style="width:18px;height:18px;accent-color:var(--blue);flex-shrink:0;cursor:pointer" onclick="event.stopPropagation()">
      <span style="flex:1;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(n)}</span>
      ${badge}
    </div>`;
  }).join('') || `<p style="font-size:13px;color:var(--text3);padding:10px 0">${t('noPlayers')}</p>`;

  const coachOpts = `<option value="">— ${t('selectCoach')} —</option>` +
    (ev.coaches || []).map(c => `<option value="${c.id}" ${grp.coachSlotId === c.id ? 'selected' : ''}>${escH(eventCoachName(c))}</option>`).join('');

  const searchBar = roster.length > 4 ? `<input type="search" placeholder="${lang==='he'?'חיפוש שחקן...':'Search player...'}"
    oninput="filterGroupPlayers(this.value)"
    style="display:block;width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:14px;font-family:inherit;outline:none;margin-bottom:6px">` : '';

  createModal(`
    <div class="sheet-title">${escH(grp.name)}</div>
    <div class="form-group">
      <label class="form-label">${t('assignCoach')}</label>
      <select id="eg-coach">${coachOpts}</select>
    </div>
    <div class="card-label" style="margin:8px 0 4px">${t('roster')}</div>
    ${searchBar}<div id="eg-rows" style="max-height:42vh;overflow-y:auto">${rows}</div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveEventGroup('${escQ(eventId)}','${escQ(groupId)}')">${t('save')}</button>
    <button class="btn btn-danger" style="margin-top:6px" onclick="deleteEventGroup('${escQ(eventId)}','${escQ(groupId)}')">${t('delete')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `, 'wide-sheet');
}

async function saveEventGroup(eventId, groupId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const coachSlotId = document.getElementById('eg-coach')?.value || null;
  const checkedCbs = Array.from(document.querySelectorAll('#eg-rows input[type="checkbox"]:checked'));
  const players = checkedCbs.map(cb => cb.dataset.name).filter(Boolean);

  // Detect players being moved from other groups
  const moves = checkedCbs
    .filter(cb => cb.dataset.other)
    .map(cb => ({ name: cb.dataset.name, fromId: cb.dataset.other }))
    .filter(m => m.name && m.fromId);

  const grpName = (ev.groups || []).find(g => g.id === groupId)?.name || '';

  const doSave = async () => {
    const groups = (ev.groups || []).map(g => {
      if (g.id === groupId) return { ...g, players, coachSlotId };
      const taken = moves.filter(m => m.fromId === g.id).map(m => m.name);
      return taken.length ? { ...g, players: (g.players || []).filter(n => !taken.includes(n)) } : g;
    });
    await saveEvent(eventId, { ...ev, groups });
    openEvent(eventId);
  };

  if (!moves.length) { await doSave(); return; }

  const moveLines = moves.map(m => {
    const fromName = (ev.groups || []).find(g => g.id === m.fromId)?.name || m.fromId;
    const dir = lang === 'he' ? `מ-${escH(fromName)} ל-${escH(grpName)}` : `${escH(fromName)} → ${escH(grpName)}`;
    return `<div style="padding:4px 0;border-bottom:0.5px solid var(--border)">${escH(m.name)}<span style="color:var(--text3);font-size:12px"> · ${dir}</span></div>`;
  }).join('');

  createModal(`
    <div class="sheet-title">${lang==='he'?'העברת שחקנים':'Move players'}</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${lang==='he'?'השחקנים הבאים יועברו:':'The following players will be moved:'}</div>
    <div style="margin-bottom:16px">${moveLines}</div>
    <button class="btn btn-primary" onclick="window._modalCb&&window._modalCb()">${lang==='he'?'אישור':'Confirm'}</button>
    <button class="btn btn-secondary" style="margin-top:6px" onclick="openEventGroup('${escQ(eventId)}','${escQ(groupId)}')">${t('cancel')}</button>
  `);
  window._modalCb = doSave;
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
  if (isAdmin() && groups.length > 1) { openEventDayAdmin(eventId, date); return; }
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

// Returns true/false if schedule data exists for this player on this day, null if no data.
function schedExpected(ev, date, groupId, playerName) {
  const g = ev.schedule?.[date]?.[groupId];
  if (!g || typeof g !== 'object') return null;
  const v = g[playerName];
  return v === undefined ? null : Boolean(v);
}

// Admin tap: cycle null → expected → not expected → null
async function togglePlayerSchedule(eventId, date, groupId, playerName, inAdminView) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const cur = schedExpected(ev, date, groupId, playerName);
  const next = cur === null ? true : cur === true ? false : null;
  const grpSched = { ...(ev.schedule?.[date]?.[groupId] || {}) };
  if (next === null) delete grpSched[playerName]; else grpSched[playerName] = next;
  const schedule = { ...(ev.schedule || {}), [date]: { ...(ev.schedule?.[date] || {}), [groupId]: grpSched } };
  await saveEvent(eventId, { ...ev, schedule });
  if (inAdminView) openEventDayAdmin(eventId, date);
  else openEventGroupDay(eventId, date, groupId);
}

function schedPill(eventId, date, groupId, playerName, exp, admin, inAdminView) {
  const click = admin ? `onclick="togglePlayerSchedule('${escQ(eventId)}','${date}','${escQ(groupId)}','${escQ(playerName)}',${inAdminView})"` : '';
  if (exp === true)  return `<span ${click} style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(96,165,250,0.15);color:var(--blue);${admin?'cursor:pointer;':''}white-space:nowrap;flex-shrink:0">${lang==='he'?'מגיע':'Expected'}</span>`;
  if (exp === false) return `<span ${click} style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(251,146,60,0.15);color:var(--orange);${admin?'cursor:pointer;':''}white-space:nowrap;flex-shrink:0">${lang==='he'?'לא מגיע':'Not expected'}</span>`;
  if (admin)         return `<span ${click} style="font-size:11px;color:var(--text3);cursor:pointer;flex-shrink:0;min-width:24px;text-align:center">—</span>`;
  return `<span style="flex-shrink:0;min-width:24px"></span>`;
}

function filterAttSearch(query) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('#att-rows > div[data-pname]').forEach(row => {
    row.style.display = (!q || (row.dataset.pname || '').toLowerCase().includes(q)) ? '' : 'none';
  });
}

function filterGroupPlayers(query) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('#eg-rows > div[data-pname]').forEach(row => {
    row.style.display = (!q || (row.dataset.pname || '').toLowerCase().includes(q)) ? '' : 'none';
  });
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
  const admin = isAdmin();

  const rows = grp.players.map(n => {
    const exp = schedExpected(ev, date, groupId, n);
    const pill = schedPill(eventId, date, groupId, n, exp, admin, false);
    return `<div data-pname="${escH(n)}" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:0.5px solid var(--border)">
      ${pill}
      <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
        <input type="checkbox" id="att-${escId(n)}" data-name="${escH(n)}" ${present.includes(n)?'checked':''}
          style="width:18px;height:18px;accent-color:var(--blue)">
        <span style="font-size:15px">${escH(n)}</span>
      </label>
    </div>`;
  }).join('');

  const schedGrp = ev.schedule?.[date]?.[groupId];
  const expCount = schedGrp ? Object.values(schedGrp).filter(Boolean).length : null;
  const schedInfo = expCount !== null
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:10px"><span style="color:var(--blue)">${expCount}</span> ${lang==='he'?'מגיעים':'expected'} · <span style="color:var(--orange)">${grp.players.length - expCount}</span> ${lang==='he'?'לא מגיעים':'not expected'}</div>`
    : '';

  const searchRow = grp.players.length > 4 ? `<input type="search" placeholder="${lang==='he'?'חיפוש שחקן...':'Search player...'}" oninput="filterAttSearch(this.value)"
    style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:10px;border:0.5px solid var(--border);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;outline:none;margin-bottom:6px">` : '';

  const empty = !grp.players.length ? `<p id="att-empty" style="color:var(--text2);font-size:13px;padding:12px 0">${t('noPlayers')}</p>` : '';
  const addPlayerRow = admin ? `<div class="add-row" style="margin-top:10px">
    <input type="text" id="att-add-input" placeholder="${t('playerPlaceholder')}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addEventGroupDayPlayer('${escQ(eventId)}','${date}','${escQ(groupId)}')}">
    <button onclick="addEventGroupDayPlayer('${escQ(eventId)}','${date}','${escQ(groupId)}')">${t('addPlayer')}</button>
  </div>` : '';

  createModal(`
    <div class="sheet-title">${escH(grp.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${escH(ev.name)}${SEP}${t(EV_DAY_KEYS[dow])}${SEP}${dd}/${mo}/${y}${att.savedAt ? SEP + escH(att.savedAt) + (att.savedBy ? ' · ' + escH(att.savedBy) : '') : ''}</div>
    ${schedInfo}${searchRow}
    <div id="att-rows">${rows}</div>${empty}
    ${addPlayerRow}
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveEventGroupDay('${escQ(eventId)}','${date}','${escQ(groupId)}')">${t('saveAttendance')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `, 'wide-sheet');
}

// Walk-in kid: add to the roster (and the marked group) and check them present.
async function addEventGroupDayPlayer(eventId, date, groupId) {
  if (!isAdmin()) return;
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

// ─── EVENT HOURS (for summary calculation) ────────────────
function openEditEventTimes(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev || !isAdmin()) return;
  createModal(`
    <div class="sheet-title">${lang==='he'?'שעות האירוע':'Event hours'}</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${t('startTime')}</label>
        <input type="time" id="ev-edit-start" value="${ev.startTime || '09:00'}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('endTime')}</label>
        <input type="time" id="ev-edit-end" value="${ev.endTime || '17:00'}">
      </div>
    </div>
    <div id="ev-time-error" class="error-box" style="margin-bottom:8px"></div>
    <button class="btn btn-primary" style="margin-top:4px" onclick="saveEventTimes('${escQ(eventId)}')">${t('save')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `);
}

async function saveEventTimes(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev || !isAdmin()) return;
  const startTime = document.getElementById('ev-edit-start')?.value || null;
  const endTime   = document.getElementById('ev-edit-end')?.value || null;
  if (startTime && endTime && timeToMins(endTime) <= timeToMins(startTime)) {
    const err = document.getElementById('ev-time-error');
    if (err) { err.textContent = t('errEndBeforeStart'); err.style.display = 'block'; }
    return;
  }
  await saveEvent(eventId, { ...ev, startTime: startTime || null, endTime: endTime || null });
  openEvent(eventId);
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
  const savedBy = currentUser?.username || '';
  day = { ...(day || {}), [groupId]: { present, savedAt, savedBy } };
  const attendance = { ...(ev.attendance || {}), [date]: day };
  await saveEvent(eventId, { ...ev, attendance });
  logActivity('EVENT_ATTENDANCE', `${ev.name} ${date} ${groupId}`);
  openEvent(eventId);
}

// Admin combined view: all groups for one day on a single screen.
function openEventDayAdmin(eventId, date) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const groups = accessibleGroups(ev);
  const [y, mo, dd] = date.split('-').map(Number);
  const dow = new Date(y, mo - 1, dd).getDay();

  const sections = groups.map(g => {
    const att = dayAtt(ev, date, g.id) || {};
    const present = att.present || [];
    const schedGrp = ev.schedule?.[date]?.[g.id];
    const expCount = schedGrp ? Object.values(schedGrp).filter(Boolean).length : null;
    const rows = g.players.map(n => {
      const exp = schedExpected(ev, date, g.id, n);
      const pill = schedPill(eventId, date, g.id, n, exp, true, true);
      return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:0.5px solid var(--border)">
        ${pill}
        <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
          <input type="checkbox" data-group="${escH(g.id)}" data-name="${escH(n)}" ${present.includes(n)?'checked':''}
            style="width:18px;height:18px;accent-color:var(--blue)">
          <span style="font-size:15px">${escH(n)}</span>
        </label>
      </div>`;
    }).join('') || `<p style="color:var(--text2);font-size:13px;padding:8px 0">${t('noPlayers')}</p>`;
    const savedLabel = att.savedAt ? `<span style="font-size:11px;color:var(--text3);margin-inline-start:6px">${escH(att.savedAt)}${att.savedBy ? ' · ' + escH(att.savedBy) : ''}</span>` : '';
    const expLabel = expCount !== null ? `<span style="font-size:11px;color:var(--text3);margin-inline-start:6px">· <span style="color:var(--blue)">${expCount}</span> ${lang==='he'?'מגיעים':'expected'} · <span style="color:var(--orange)">${g.players.length - expCount}</span> ${lang==='he'?'לא מגיעים':'not'}</span>` : '';
    return `<div class="card-label" style="margin:14px 0 4px">${escH(g.name)}${expLabel}${savedLabel}</div>
      <div>${rows}</div>`;
  }).join('');

  createModal(`
    <div class="sheet-title">${escH(ev.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${t(EV_DAY_KEYS[dow])}${SEP}${dd}/${mo}/${y}</div>
    ${sections}
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveEventAllGroups('${escQ(eventId)}','${date}')">${t('saveAttendance')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `, 'wide-sheet');
}

async function saveEventAllGroups(eventId, date) {
  const ev = events.find(e => e.id === eventId);
  if (!ev || !isAdmin()) return;
  const now = new Date();
  const savedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const groups = accessibleGroups(ev);
  let day = ev.attendance?.[date];
  if (day && Array.isArray(day.present)) day = { all: day }; // migrate legacy flat shape
  day = { ...(day || {}) };
  const allCheckboxes = Array.from(document.querySelectorAll('#app-modal input[type="checkbox"][data-group]'));
  groups.forEach(g => {
    const present = allCheckboxes
      .filter(cb => cb.dataset.group === g.id && cb.checked)
      .map(cb => cb.dataset.name)
      .filter(Boolean);
    day[g.id] = { present, savedAt, savedBy: currentUser?.username || '' };
  });
  const attendance = { ...(ev.attendance || {}), [date]: day };
  await saveEvent(eventId, { ...ev, attendance });
  logActivity('EVENT_ATTENDANCE', `${ev.name} ${date} all-groups`);
  openEvent(eventId);
}

// Bird's-eye, all-days-at-once view of one attendance tracker, grouped by pickup location.
// Tapping a body cell toggles that player's expected mark; tapping a day header opens the
// roll-call for who actually attended that tracker that day (openTrackerDay).
function openEventGrid(eventId, trackerId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const tracker = getEventTrackers(ev).find(t2 => t2.id === trackerId);
  if (!tracker) return;
  const admin = isAdmin();
  const days = eventDates(ev);
  const isDefaultTracker = trackerId === DEFAULT_TRACKER_ID;

  let sections = groupedRosterForTracker(ev, tracker, trackerIncludedSet(tracker));

  // Camp Attendance must reconcile with the real daily checklist: if a name shows up as present
  // on some day but isn't accounted for by any section above (stale data from before groups
  // existed, a group that's since been deleted, etc.), surface it as its own row instead of
  // silently dropping it from the totals.
  if (isDefaultTracker) {
    const knownSet = new Set(sections.flatMap(s => s.players));
    const extra = new Set();
    days.forEach(d => campActualPresentSet(ev, d).forEach(n => { if (!knownSet.has(n)) extra.add(n); }));
    if (extra.size) sections = [...sections, { label: t('notOnRoster'), players: [...extra] }];
  }

  if (!admin) {
    const allowedNames = new Set(accessibleGroups(ev).flatMap(g => g.players || []));
    sections = sections
      .map(s => ({ label: s.label, players: s.players.filter(n => allowedNames.has(n)) }))
      .filter(s => s.players.length);
  }
  const headerCells = days.map(d => {
    const [y, mo, dd] = d.split('-').map(Number);
    const dayHandler = isDefaultTracker
      ? `openEventDay('${escQ(eventId)}','${d}')`
      : `openTrackerDay('${escQ(eventId)}','${escQ(trackerId)}','${d}')`;
    const onclick = admin ? ` onclick="${dayHandler}" style="cursor:pointer"` : '';
    return `<th title="${dd}/${mo}/${y}"${onclick}>${dd}</th>`;
  }).join('') + `<th>${t('totalLabel')}</th>`;

  const stickyRO = admin ? '' : ' readonly';
  const bodyRows = sections.map(sec => {
    const locRow = `<tr class="grid-loc-row"><td class="grid-sticky" colspan="${days.length + 2}">${escH(sec.label)}</td></tr>`;
    const playerRows = sec.players.map(name => {
      const cells = days.map(d => {
        const m = cellMarker(ev, trackerId, d, name);
        const onclick = admin ? ` onclick="toggleGridCell('${escQ(eventId)}','${escQ(trackerId)}','${d}','${escQ(name)}')"` : '';
        return `<td class="exp-cell ${m.cls}${stickyRO}"${onclick}>${m.sym}</td>`;
      }).join('');
      const onclick = admin ? ` onclick="openPlayerGroupEdit('${escQ(eventId)}','${escQ(trackerId)}','${escQ(name)}')"` : '';
      const { present, marked } = trackerPlayerTotal(ev, trackerId, days, name);
      const totalCell = `<td class="grid-total-cell">${present}/${marked}</td>`;
      return `<tr><td class="grid-sticky${stickyRO}"${onclick}>${escH(name)}</td>${cells}${totalCell}</tr>`;
    }).join('');
    return locRow + playerRows;
  }).join('') || `<tr><td colspan="${days.length + 2}" style="padding:16px 0;text-align:center;color:var(--text3)">${t('noPlayers')}</td></tr>`;

  const rosterNames = sections.flatMap(s => s.players);
  const totalCells = days.map(d => {
    const total = rosterNames.filter(n => {
      const att = isDefaultTracker ? campDayAttendance(ev, d, n) : ev.trackerData?.[trackerId]?.attendance?.[d];
      return att && (att.present || []).includes(n);
    }).length;
    return `<td>${total}</td>`;
  }).join('') + `<td></td>`;
  const totalRow = sections.length
    ? `<tr class="grid-total-row"><td class="grid-sticky">${t('totalLabel')}</td>${totalCells}</tr>`
    : '';

  const legend = `
    <div style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-bottom:12px;font-size:11px;color:var(--text2)">
      <span><span class="exp-ok">✓</span> ${t('legendOk')}</span>
      <span><span class="exp-miss" style="padding:1px 5px">✕</span> ${t('legendMiss')}</span>
      <span><span class="exp-extra" style="padding:1px 5px">✓</span> ${t('legendExtra')}</span>
      <span><span class="exp-pending">✓</span> ${t('legendPending')}</span>
      <span><span class="exp-no">✕</span> ${t('legendNo')}</span>
    </div>`;

  createModal(`
    <div class="sheet-title">${escH(tracker.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${escH(ev.name)}${admin ? SEP + t('tapDayHint') : ''}</div>
    ${legend}
    <div class="grid-table-wrap">
      <table class="grid-table">
        <thead><tr><th class="grid-sticky"></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>
    </div>
    <button class="btn btn-secondary" style="margin-top:16px" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `, 'grid-sheet');
}

// Binary toggle of this tracker's expected mark for one player/day.
async function toggleGridCell(eventId, trackerId, date, name) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const dayMap = { ...(ev.trackerData?.[trackerId]?.schedule?.[date] || {}) };
  if (trackerId === DEFAULT_TRACKER_ID) {
    // Default tracker: everyone is expected unless explicitly excepted, so tapping toggles an
    // explicit "not expected" (false) exception on and off rather than adding/removing "true".
    if (dayMap[name] === false) delete dayMap[name]; else dayMap[name] = false;
  } else {
    if (dayMap[name]) delete dayMap[name]; else dayMap[name] = true;
  }
  const trackerData = {
    ...(ev.trackerData || {}),
    [trackerId]: {
      ...(ev.trackerData?.[trackerId] || {}),
      schedule: { ...(ev.trackerData?.[trackerId]?.schedule || {}), [date]: dayMap }
    }
  };
  await saveEvent(eventId, { ...ev, trackerData, attendanceTrackers: getEventTrackers(ev) });
  openEventGrid(eventId, trackerId);
}

// Roll-call for who actually attended this tracker on a given day.
function openTrackerDay(eventId, trackerId, date) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const tracker = getEventTrackers(ev).find(t2 => t2.id === trackerId);
  if (!tracker) return;
  // Camp Attendance mirrors the existing daily roll-call instead of keeping its own copy —
  // route there so there's only ever one place to mark it.
  if (trackerId === DEFAULT_TRACKER_ID) { openEventDay(eventId, date); return; }
  if (!isAdmin()) { openEventGrid(eventId, trackerId); return; }
  const sections = groupedRosterForTracker(ev, tracker, trackerIncludedSet(tracker));
  const att = ev.trackerData?.[trackerId]?.attendance?.[date] || {};
  const present = att.present || [];
  const [y, mo, dd] = date.split('-').map(Number);

  const rows = sections.map(sec => {
    const locHeader = `<div class="card-label" style="margin:14px 0 4px">${escH(sec.label)}</div>`;
    const playerRows = sec.players.map(name => attRowHtml(name, present.includes(name))).join('')
      || `<p style="color:var(--text2);font-size:13px;padding:6px 0">${t('noPlayers')}</p>`;
    return locHeader + playerRows;
  }).join('') || `<p style="color:var(--text2);font-size:13px;padding:12px 0">${t('noPlayers')}</p>`;

  createModal(`
    <div class="sheet-title">${escH(tracker.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${escH(ev.name)}${SEP}${dd}/${mo}/${y}${att.savedAt ? SEP + escH(att.savedAt) + (att.savedBy ? ' · ' + escH(att.savedBy) : '') : ''}</div>
    <div id="att-rows">${rows}</div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveTrackerDay('${escQ(eventId)}','${escQ(trackerId)}','${date}')">${t('saveAttendance')}</button>
    <button class="btn btn-secondary" onclick="openEventGrid('${escQ(eventId)}','${escQ(trackerId)}')">${t('cancel')}</button>
  `, 'wide-sheet');
}

async function saveTrackerDay(eventId, trackerId, date) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const present = Array.from(document.querySelectorAll('#att-rows input[type="checkbox"]:checked'))
    .map(cb => cb.dataset.name)
    .filter(Boolean);
  const now = new Date();
  const savedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const savedBy = currentUser?.username || '';
  const trackerData = {
    ...(ev.trackerData || {}),
    [trackerId]: {
      ...(ev.trackerData?.[trackerId] || {}),
      attendance: { ...(ev.trackerData?.[trackerId]?.attendance || {}), [date]: { present, savedAt, savedBy } }
    }
  };
  await saveEvent(eventId, { ...ev, trackerData, attendanceTrackers: getEventTrackers(ev) });
  logActivity('TRACKER_ATTENDANCE', `${ev.name} ${trackerName(ev, trackerId)} ${date}`);
  openEventGrid(eventId, trackerId);
}

function trackerName(ev, trackerId) {
  return getEventTrackers(ev).find(t2 => t2.id === trackerId)?.name || trackerId;
}

// Step 1: name it, then choose who's actually in it (unlike Camp Attendance, most custom
// trackers — a bus, a trip — only involve a subset of the roster).
function createAttendanceTracker(eventId) {
  if (!isAdmin()) return;
  const input = document.getElementById('ev-tracker-input');
  const name = input?.value.trim();
  if (!name) return;
  openTrackerPlayerSelect(eventId, name);
}

function openTrackerPlayerSelect(eventId, name) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const rows = (ev.roster || []).map(n =>
    `<label style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <input type="checkbox" class="tracker-select-cb" data-name="${escH(n)}" style="width:18px;height:18px;accent-color:var(--blue)">
      <span style="font-size:14px">${escH(n)}</span>
    </label>`
  ).join('') || `<p style="color:var(--text2);font-size:13px;padding:12px 0">${t('noPlayers')}</p>`;

  createModal(`
    <div class="sheet-title">${escH(name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${t('selectPlayersHint')}</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button onclick="toggleAllTrackerSelect(true)" style="flex:1;padding:8px;background:var(--bg3);border:0.5px solid var(--border);border-radius:8px;font-size:12px;color:var(--text);cursor:pointer;font-family:inherit">${t('selectAll')}</button>
      <button onclick="toggleAllTrackerSelect(false)" style="flex:1;padding:8px;background:var(--bg3);border:0.5px solid var(--border);border-radius:8px;font-size:12px;color:var(--text);cursor:pointer;font-family:inherit">${t('selectNone')}</button>
    </div>
    <div id="tracker-select-rows" style="max-height:50vh;overflow-y:auto">${rows}</div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="confirmCreateAttendanceTracker('${escQ(eventId)}','${escQ(name)}')">${t('createAttendance')}</button>
    <button class="btn btn-secondary" onclick="openEvent('${escQ(eventId)}')">${t('cancel')}</button>
  `, 'wide-sheet');
}

function toggleAllTrackerSelect(checked) {
  document.querySelectorAll('.tracker-select-cb').forEach(cb => { cb.checked = checked; });
}

async function confirmCreateAttendanceTracker(eventId, name) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const included = Array.from(document.querySelectorAll('.tracker-select-cb:checked')).map(cb => cb.dataset.name);
  const attendanceTrackers = [
    ...getEventTrackers(ev),
    { id: 'at' + Date.now(), name, isDefault: false, createdAt: Date.now(), included }
  ];
  await saveEvent(eventId, { ...ev, attendanceTrackers });
  openEvent(eventId);
}

function confirmDeleteAttendanceTracker(eventId, trackerId) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const tracker = getEventTrackers(ev).find(t2 => t2.id === trackerId);
  if (!tracker || tracker.isDefault) return;
  showConfirmModal(`${t('delete')}: "${escH(tracker.name)}"?`, async () => {
    const attendanceTrackers = getEventTrackers(ev).filter(t2 => t2.id !== trackerId);
    const trackerData = { ...(ev.trackerData || {}) };
    delete trackerData[trackerId];
    await saveEvent(eventId, { ...ev, attendanceTrackers, trackerData });
    openEvent(eventId);
  });
}

// Edits whichever attribute this tracker groups by — home coach for Camp Attendance,
// pickup location for anything else (see trackerGroupBy).
function openPlayerGroupEdit(eventId, trackerId, name) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const tracker = getEventTrackers(ev).find(t2 => t2.id === trackerId);
  if (!tracker) return;
  const mode = trackerGroupBy(tracker);
  const current = mode === 'coach' ? (ev.playerCoach || {})[name] || '' : (ev.pickupLocations || {})[name] || '';
  const label = mode === 'coach' ? t('homeCoach') : t('pickupLocation');
  const title = mode === 'coach' ? t('editHomeCoach') : t('editLocation');
  createModal(`
    <div class="sheet-title">${title}</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">${escH(name)}</div>
    <div class="form-group">
      <label class="form-label">${label}</label>
      <input type="text" id="pl-input" value="${escH(current)}" placeholder="${label}"
        onkeydown="if(event.key==='Enter'){event.preventDefault();saveEventPlayerGroup('${escQ(eventId)}','${escQ(trackerId)}','${escQ(name)}','${mode}')}">
    </div>
    <button class="btn btn-primary" onclick="saveEventPlayerGroup('${escQ(eventId)}','${escQ(trackerId)}','${escQ(name)}','${mode}')">${t('save')}</button>
    <button class="btn btn-secondary" onclick="openEventGrid('${escQ(eventId)}','${escQ(trackerId)}')">${t('cancel')}</button>
  `);
  setTimeout(() => document.getElementById('pl-input')?.focus(), 80);
}

async function saveEventPlayerGroup(eventId, trackerId, name, mode) {
  if (!isAdmin()) return;
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const value = document.getElementById('pl-input')?.value.trim() || '';
  if (mode === 'coach') {
    const playerCoach = { ...(ev.playerCoach || {}) };
    if (value) playerCoach[name] = value; else delete playerCoach[name];
    await saveEvent(eventId, { ...ev, playerCoach });
  } else {
    const pickupLocations = { ...(ev.pickupLocations || {}) };
    if (value) pickupLocations[name] = value; else delete pickupLocations[name];
    await saveEvent(eventId, { ...ev, pickupLocations });
  }
  openEventGrid(eventId, trackerId);
}
