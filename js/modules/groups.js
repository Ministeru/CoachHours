// ─── GROUPS ───────────────────────────────────────────────
let expandedGroupIds = new Set();
let expandedGroupEditMode = new Set();

// Stable color per group derived from its ID
const _GROUP_PALETTE = ['#60a5fa','#fb923c','#4ade80','#f472b6','#a78bfa','#fbbf24'];
function groupColor(groupId) {
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (h * 31 + groupId.charCodeAt(i)) & 0xffff;
  return _GROUP_PALETTE[h % _GROUP_PALETTE.length];
}

function groupCoachName(groupId) {
  const gs = sessions.filter(s => s.groupId === groupId && s.assignedCoachId);
  if (!gs.length) return null;
  const coachId = [...gs].sort((a,b) => b.date.localeCompare(a.date))[0].assignedCoachId;
  return allCoaches.find(c => c.id === coachId)?.username || null;
}

// ─── DRAG-AND-DROP (roster → group) ──────────────────────
let _draggingPlayerName = null;
const _groupDragCounters = {};

function onPlayerDragStart(e, name) {
  _draggingPlayerName = name;
  e.dataTransfer.setData('text/plain', name);
  e.dataTransfer.effectAllowed = 'copy';
  document.body.classList.add('player-dragging');
}

function onPlayerDragEnd() {
  _draggingPlayerName = null;
  document.body.classList.remove('player-dragging');
  document.querySelectorAll('.group-drop-zone.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onGroupDragEnter(e, groupId) {
  _groupDragCounters[groupId] = (_groupDragCounters[groupId] || 0) + 1;
  document.getElementById('gdz-' + groupId)?.classList.add('drag-over');
}

function onGroupDragLeave(e, groupId) {
  _groupDragCounters[groupId] = Math.max(0, (_groupDragCounters[groupId] || 1) - 1);
  if (!_groupDragCounters[groupId]) {
    document.getElementById('gdz-' + groupId)?.classList.remove('drag-over');
  }
}

async function onGroupDrop(e, groupId) {
  e.preventDefault();
  _groupDragCounters[groupId] = 0;
  document.getElementById('gdz-' + groupId)?.classList.remove('drag-over');
  document.body.classList.remove('player-dragging');
  const name = (e.dataTransfer.getData('text/plain') || _draggingPlayerName || '').trim();
  _draggingPlayerName = null;
  if (!name || !isAdmin()) return;
  await addPlayer(groupId, name);
}

function renderGroups() {
  const addRow = document.getElementById('groups-add-btn-row');
  if (addRow) addRow.style.display = isAdmin() ? '' : 'none';

  const gArr = Object.values(groups);
  const el = document.getElementById('groups-list');
  if (!gArr.length) { el.innerHTML = `<div class="empty">${t('noGroups')}</div>`; renderIndividualPlayers(); return; }

  el.innerHTML = gArr.map(g => {
    const expanded = expandedGroupIds.has(g.id);
    const sessionCount = getCalendarSessions().filter(s => s.groupId === g.id).length;
    let inner = '';
    if (expanded) {
      const editMode = expandedGroupEditMode.has(g.id);
      const chips = g.players.map(name =>
        `<span class="player-chip">${escH(name)}${(isAdmin()&&editMode)?`<span class="rm" onclick="confirmRemovePlayer('${g.id}','${escQ(name)}')">×</span>`:''}
        </span>`
      ).join('') || `<span style="font-size:13px;color:var(--text3)">${t('noPlayers')}</span>`;

      const editToggleBtn = isAdmin() ? `<button onclick="toggleGroupEditMode('${g.id}')" style="padding:4px 12px;font-size:12px;background:${editMode?'var(--orange-bg)':'var(--bg3)'};color:${editMode?'var(--orange)':'var(--text2)'};border:0.5px solid ${editMode?'var(--orange)':'var(--border)'};border-radius:20px;cursor:pointer;font-family:inherit;margin-bottom:8px">${editMode?t('donePlayers'):t('editPlayers')}</button>` : '';

      const addPlayerRow = (isAdmin()&&editMode) ? `<div class="add-row">
        <input type="text" id="add-pl-${g.id}" placeholder="${t('players')}">
        <button onclick="addPlayer('${g.id}',document.getElementById('add-pl-${g.id}').value);document.getElementById('add-pl-${g.id}').value=''">${t('addPlayer')}</button>
      </div>` : '';

      const scheduleBtn = isAdmin() ? `<button onclick="openSessionModal(null,null,null,'${g.id}')" style="width:100%;margin-top:10px;padding:9px;background:var(--blue-bg);color:var(--blue);border:0.5px solid var(--blue);border-radius:var(--radius-sm);font-size:13px;cursor:pointer;font-family:inherit">${t('scheduleGroupSession')}</button>` : '';

      const deleteRow = (isAdmin()&&editMode) ? `<button onclick="confirmDeleteGroupUI('${g.id}')" style="width:100%;margin-top:8px;padding:9px;background:var(--red-bg);color:var(--red);border:0.5px solid var(--red);border-radius:var(--radius-sm);font-size:13px;cursor:pointer;font-family:inherit">${t('deleteGroup')}</button>` : '';

      // Attendance stats
      let attHtml = '';
      if (g.players.length) {
        const gsessions = getCalendarSessions()
          .filter(s => s.groupId === g.id && s.attendance)
          .sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        if (gsessions.length) {
          attHtml = `<div style="margin-top:14px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">${t('attendance')} (${gsessions.length})</div>
            ${g.players.map(name => {
              const c = gsessions.filter(s => (s.attendance.present||[]).includes(name)).length;
              // One cell per session, in date order — shows the attendance pattern, not just a total
              const segs = gsessions.map(s =>
                `<span class="att-seg${(s.attendance.present||[]).includes(name)?' on':''}"></span>`
              ).join('');
              return `<div class="att-row" onclick="openPlayerHistory('${escQ(g.id)}','${escQ(name)}')" style="cursor:pointer">
                <span style="font-size:13px;min-width:90px;flex-shrink:0;color:var(--text);text-decoration:underline;text-decoration-color:var(--border2)">${escH(name)}</span>
                <div class="att-strip">${segs}</div>
                <span style="font-size:12px;color:var(--text2);min-width:38px;text-align:${lang==='he'?'left':'right'}">${c}/${gsessions.length}</span>
              </div>`;
            }).join('')}
          </div>`;
        }
      }

      inner = `<div style="border-top:0.5px solid var(--border);margin-top:12px;padding-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.07em;text-transform:uppercase">${t('players')}</div>
          ${editToggleBtn}
        </div>
        <div class="player-chips" style="margin-bottom:10px">${chips}</div>
        ${addPlayerRow}${attHtml}${scheduleBtn}${deleteRow}
      </div>`;
    }

    const gColor = groupColor(g.id);
    return `<div class="card"
      ondragover="event.preventDefault()"
      ondragenter="onGroupDragEnter(event,'${g.id}')"
      ondragleave="onGroupDragLeave(event,'${g.id}')"
      ondrop="onGroupDrop(event,'${g.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleGroupExpand('${g.id}')">
        <div>
          <div style="font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${gColor};flex-shrink:0"></span>
            ${escH(g.name)}
          </div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${g.players.length}${SEP}${sessionCount} ${t('sessionsCount')}</div>
        </div>
        <span style="font-size:22px;color:var(--text3);display:inline-block;transform:rotate(${expanded?'90':'0'}deg)">›</span>
      </div>${inner}
      <div class="group-drop-zone" id="gdz-${g.id}">${lang==='he'?'גרור שחקן לכאן':'Drop player here'}</div>
    </div>`;
  }).join('');

  renderIndividualPlayers();
}

function toggleGroupExpand(id) {
  if (expandedGroupIds.has(id)) { expandedGroupIds.delete(id); expandedGroupEditMode.delete(id); }
  else expandedGroupIds.add(id);
  renderGroups();
}

function toggleGroupEditMode(id) {
  if (expandedGroupEditMode.has(id)) expandedGroupEditMode.delete(id); else expandedGroupEditMode.add(id);
  renderGroups();
}

function openAddGroupModal() {
  if (!isAdmin()) return;
  createModal(`
    <div class="sheet-title">${t('newGroup')}</div>
    <input type="text" id="new-group-input" placeholder="${t('groupName')}"
      style="width:100%;background:var(--bg3);border:0.5px solid var(--border2);border-radius:8px;padding:11px 12px;font-size:16px;color:var(--text);font-family:inherit;margin-bottom:10px"
      onkeydown="if(event.key==='Enter')document.getElementById('new-group-ok').click()">
    <button id="new-group-ok" class="btn btn-primary" style="margin-top:0" onclick="window._addGroupCb()">${t('confirm')}</button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
  window._addGroupCb = async () => {
    const v = document.getElementById('new-group-input')?.value.trim();
    closeModal();
    if (!v) return;
    const id = 'g' + Date.now();
    await saveGroup(id, { id, name: v, players: [] });
    expandedGroupIds.add(id);
  };
  setTimeout(() => document.getElementById('new-group-input')?.focus(), 80);
}

async function addPlayer(groupId, name) {
  if (!isAdmin()) return;
  const n = name.trim();
  if (!n) return;
  const g = groups[groupId];
  if (!g || g.players.includes(n)) return;
  const updated = [...g.players, n];
  await saveGroup(groupId, { ...g, players: updated });
}

async function removePlayer(groupId, name) {
  if (!isAdmin()) return;
  const g = groups[groupId];
  if (!g) return;
  await saveGroup(groupId, { ...g, players: g.players.filter(p => p !== name) });
}

function confirmRemovePlayer(groupId, name) {
  if (!isAdmin()) return;
  showTypeConfirmModal(`${t('delete')}: "${escH(name)}"?`, async () => {
    closeModal();
    await removePlayer(groupId, name);
  });
}

function confirmDeleteGroupUI(id) {
  const g = groups[id];
  if (!g) return;
  showTypeConfirmModal(`${t('deleteGroup')}: "${escH(g.name)}"?`, async () => {
    expandedGroupIds.delete(id);
    expandedGroupEditMode.delete(id);
    await deleteGroup(id);
    closeModal();
  });
}

// ─── INDIVIDUAL PLAYERS ──────────────────────────────────
function renderIndividualPlayers() {
  const addRow = document.getElementById('individual-players-add-row');
  if (addRow) addRow.style.display = isAdmin() ? '' : 'none';

  const el = document.getElementById('individual-players-list');
  if (!el) return;
  const pArr = Object.values(players).sort((a,b) => a.name.localeCompare(b.name));

  if (!pArr.length) {
    el.innerHTML = `<div class="empty">${t('noIndividualPlayers')}</div>`;
    return;
  }

  // Map player name → first group that contains them
  const nameToGroupId = {};
  Object.values(groups).forEach(g => {
    g.players.forEach(name => { if (!nameToGroupId[name]) nameToGroupId[name] = g.id; });
  });

  // Bucket players by group (or unassigned)
  const bucketed = {};
  const unassigned = [];
  pArr.forEach(p => {
    const gid = nameToGroupId[p.name];
    if (gid) { (bucketed[gid] = bucketed[gid] || []).push(p); }
    else unassigned.push(p);
  });

  let html = '';
  const hasGrouped = Object.values(groups).some(g => bucketed[g.id]?.length);

  Object.values(groups).forEach(g => {
    const gPlayers = bucketed[g.id];
    if (!gPlayers?.length) return;
    const color = groupColor(g.id);
    const coach = groupCoachName(g.id);
    html += `<div class="roster-group-header">
      <div style="width:3px;height:14px;border-radius:2px;background:${color};flex-shrink:0"></div>
      <span class="roster-group-name">${escH(g.name)}</span>
      ${coach ? `<span class="roster-group-coach">· ${escH(coach)}</span>` : ''}
    </div>`;
    html += gPlayers.map(p => playerRosterCard(p, color)).join('');
  });

  if (unassigned.length) {
    if (hasGrouped) html += `<div class="roster-group-header">
      <div style="width:3px;height:14px;border-radius:2px;background:var(--border2);flex-shrink:0"></div>
      <span class="roster-group-name">${lang==='he'?'לא משויך':'Unassigned'}</span>
    </div>`;
    html += unassigned.map(p => playerRosterCard(p, null)).join('');
  }

  el.innerHTML = html;
}

function playerRosterCard(p, accentColor) {
  const bar = accentColor
    ? `<div style="width:3px;height:34px;border-radius:2px;background:${accentColor};flex-shrink:0"></div>`
    : `<div style="width:3px;flex-shrink:0"></div>`;
  return `<div class="card roster-player-card"
    draggable="${isAdmin() ? 'true' : 'false'}"
    ondragstart="onPlayerDragStart(event,'${escQ(p.name)}')"
    ondragend="onPlayerDragEnd()">
    <div style="display:flex;align-items:center;gap:10px">
      ${bar}
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(p.name)}</div>
      </div>
      ${isAdmin() ? `<button onclick="event.stopPropagation();confirmDeleteIndividualPlayer('${p.id}','${escQ(p.name)}')" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:4px 8px;line-height:1">×</button>` : ''}
      ${isAdmin() ? `<span style="color:var(--text3);font-size:13px;user-select:none">⠿</span>` : ''}
    </div>
  </div>`;
}

function openAddIndividualPlayerModal() {
  if (!isAdmin()) return;
  createModal(`
    <div class="sheet-title">${t('addIndividualPlayer')}</div>
    <input type="text" id="new-player-input" placeholder="${t('playerPlaceholder')}"
      style="width:100%;background:var(--bg3);border:0.5px solid var(--border2);border-radius:8px;padding:11px 12px;font-size:16px;color:var(--text);font-family:inherit;margin-bottom:10px"
      onkeydown="if(event.key==='Enter')document.getElementById('new-player-ok').click()">
    <button id="new-player-ok" class="btn btn-primary" style="margin-top:0" onclick="window._addPlayerCb()">${t('confirm')}</button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
  window._addPlayerCb = async () => {
    const v = document.getElementById('new-player-input')?.value.trim();
    closeModal();
    if (!v) return;
    const id = 'p' + Date.now();
    await saveIndividualPlayer(id, { id, name: v, createdAt: Date.now() });
    logActivity('ADD_PLAYER', v);
  };
  setTimeout(() => document.getElementById('new-player-input')?.focus(), 80);
}

function confirmDeleteIndividualPlayer(id, name) {
  if (!isAdmin()) return;
  showTypeConfirmModal(`${t('delete')}: "${escH(name)}"?`, async () => {
    closeModal();
    await deleteIndividualPlayer(id);
  });
}

// ─── PLAYER HISTORY ──────────────────────────────────────
function openPlayerHistory(groupId, playerName) {
  const g = groups[groupId];
  if (!g) return;
  const DAY_KEYS_FULL = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const gsessions = getCalendarSessions()
    .filter(s => s.groupId === groupId)
    .sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  // List view rows
  const rows = gsessions.map(s => {
    let statusColor, statusLabel;
    if (!s.attendance) {
      statusColor = 'var(--text3)'; statusLabel = '—';
    } else if ((s.attendance.present || []).includes(playerName)) {
      statusColor = 'var(--green)'; statusLabel = '+';
    } else {
      statusColor = 'var(--red)'; statusLabel = '×';
    }
    const [y, mo, d] = s.date.split('-').map(Number);
    const dow = new Date(y, mo-1, d).getDay();
    const isCancelled = s.cancelled?.whole || s.cancelled?.general;
    return `<div onclick="closeModal();goToCalendarDay('${escQ(s.date)}')" style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:0.5px solid var(--border);cursor:pointer;${isCancelled?'opacity:0.4':''}">
      <span style="font-size:14px;font-weight:700;width:20px;text-align:center;color:${statusColor}">${statusLabel}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${s.date}${SEP}${escH(t(DAY_KEYS_FULL[dow]))}</div>
        <div style="font-size:11px;color:var(--text2)">${s.startTime} – ${s.endTime}${isCancelled?SEP+escH(t('cancelled')):''}</div>
      </div>
      <span style="font-size:12px;color:var(--text3)">›</span>
    </div>`;
  }).join('');

  // Calendar month view
  const monthMap = {};
  gsessions.forEach(s => {
    const ym = s.date.substring(0, 7);
    if (!monthMap[ym]) monthMap[ym] = [];
    monthMap[ym].push(s);
  });
  const calMonths = Object.entries(monthMap).sort(([a],[b]) => a.localeCompare(b)).map(([ym, mSessions]) => {
    const [y, m] = ym.split('-').map(Number);
    const dayStatus = {};
    mSessions.forEach(s => {
      const d = parseInt(s.date.split('-')[2]);
      const isCancelled = s.cancelled?.whole || s.cancelled?.general;
      if (isCancelled) { dayStatus[d] = 'cancelled'; return; }
      if (!s.attendance)                                       dayStatus[d] = 'noatt';
      else if ((s.attendance.present||[]).includes(playerName)) dayStatus[d] = 'present';
      else                                                     dayStatus[d] = 'absent';
    });
    const firstDow = new Date(y, m-1, 1).getDay();
    const lastDay  = new Date(y, m, 0).getDate();
    const dayHeaders = ['S','M','T','W','T','F','S'].map(h =>
      `<div style="font-size:9px;font-weight:600;color:var(--text3);text-align:center;padding-bottom:4px">${h}</div>`
    ).join('');
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div></div>';
    for (let d = 1; d <= lastDay; d++) {
      const st = dayStatus[d];
      let bg = 'transparent', color = 'var(--text3)', fw = '400';
      if      (st === 'present')   { bg = 'rgba(34,197,94,0.2)';  color = 'var(--green)';  fw = '700'; }
      else if (st === 'absent')    { bg = 'rgba(248,113,113,0.2)'; color = 'var(--red)';    fw = '700'; }
      else if (st === 'noatt')     { bg = 'var(--bg3)';             color = 'var(--text2)';  fw = '500'; }
      else if (st === 'cancelled') { color = 'var(--text3)'; }
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells += `<div onclick="closeModal();goToCalendarDay('${dateStr}')" style="font-size:11px;text-align:center;padding:4px 2px;border-radius:5px;background:${bg};color:${color};font-weight:${fw};cursor:${st?'pointer':'default'}">${d}</div>`;
    }
    return `<div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">${monthName(m-1)} ${y}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${dayHeaders}${cells}</div>
    </div>`;
  }).join('') || `<div style="color:var(--text3);font-size:13px;padding:12px 0">${lang==='he'?'אין פגישות':'No sessions'}</div>`;

  const sessionsWithAtt = gsessions.filter(s => s.attendance);
  const presentCount    = sessionsWithAtt.filter(s => (s.attendance.present||[]).includes(playerName)).length;
  const totalCount      = sessionsWithAtt.length;
  const pct = totalCount ? Math.round(presentCount / totalCount * 100) : 0;

  const btnStyle = (active) => `padding:5px 14px;font-size:12px;font-weight:600;border-radius:20px;border:0.5px solid;cursor:pointer;font-family:inherit;${active?'background:var(--bg3);border-color:var(--border2);color:var(--text)':'background:none;border-color:transparent;color:var(--text2)'}`;

  createModal(`
    <div class="sheet-title">${escH(playerName)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:4px">${escH(g.name)}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div class="att-bar" style="flex:1"><div class="att-fill" style="width:${pct}%"></div></div>
      <span style="font-size:13px;font-weight:600;color:var(--text);min-width:54px;text-align:${lang==='he'?'left':'right'}">${presentCount}/${totalCount}</span>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:12px">
      <button id="phv-list" onclick="phToggleView('list')" style="${btnStyle(true)}">${lang==='he'?'רשימה':'List'}</button>
      <button id="phv-cal"  onclick="phToggleView('cal')"  style="${btnStyle(false)}">${lang==='he'?'לוח חודשי':'Month'}</button>
    </div>
    <div id="phv-list-body" style="max-height:55vh;overflow-y:auto">
      ${rows || `<div style="color:var(--text3);font-size:13px;padding:12px 0">${lang==='he'?'אין נוכחות שמורה':'No attendance recorded'}</div>`}
    </div>
    <div id="phv-cal-body" style="max-height:55vh;overflow-y:auto;display:none">${calMonths}</div>
    <button class="btn btn-secondary" style="margin-top:14px" onclick="closeModal()">${t('cancel')}</button>
  `);
}

function phToggleView(view) {
  const isList = view === 'list';
  const listBody = document.getElementById('phv-list-body');
  const calBody  = document.getElementById('phv-cal-body');
  const listBtn  = document.getElementById('phv-list');
  const calBtn   = document.getElementById('phv-cal');
  if (!listBody || !calBody) return;
  listBody.style.display = isList ? '' : 'none';
  calBody.style.display  = isList ? 'none' : '';
  const activeStyle = 'padding:5px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;font-family:inherit;background:var(--bg3);border:0.5px solid var(--border2);color:var(--text)';
  const inactiveStyle = 'padding:5px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;font-family:inherit;background:none;border:0.5px solid transparent;color:var(--text2)';
  if (listBtn) listBtn.style.cssText = isList ? activeStyle : inactiveStyle;
  if (calBtn)  calBtn.style.cssText  = isList ? inactiveStyle : activeStyle;
}
