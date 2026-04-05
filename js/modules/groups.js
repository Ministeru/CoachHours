// ─── GROUPS ───────────────────────────────────────────────
let expandedGroupIds = new Set();
let expandedGroupEditMode = new Set();

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
        const gsessions = getCalendarSessions().filter(s => s.groupId === g.id && s.attendance);
        if (gsessions.length) {
          const counts = {};
          gsessions.forEach(s => (s.attendance.present||[]).forEach(n => { counts[n]=(counts[n]||0)+1; }));
          attHtml = `<div style="margin-top:14px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">${t('attendance')} (${gsessions.length})</div>
            ${g.players.map(name => {
              const c = counts[name]||0;
              const pct = gsessions.length ? (c/gsessions.length)*100 : 0;
              return `<div class="att-row">
                <span style="font-size:13px;min-width:90px;flex-shrink:0">${escH(name)}</span>
                <div class="att-bar"><div class="att-fill" style="width:${pct}%"></div></div>
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

    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleGroupExpand('${g.id}')">
        <div>
          <div style="font-size:15px;font-weight:600">${escH(g.name)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${g.players.length} · ${sessionCount} ${t('sessionsCount')}</div>
        </div>
        <span style="font-size:22px;color:var(--text3);display:inline-block;transform:rotate(${expanded?'90':'0'}deg)">›</span>
      </div>${inner}
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

  el.innerHTML = pArr.map(p => {
    const sessionCount = getCalendarSessions().filter(s => s.type === 'private' && s.assignedPlayerName === p.name).length;
    return `<div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
      <div>
        <div style="font-size:15px;font-weight:500">${escH(p.name)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${sessionCount} ${t('sessionsCount')}</div>
      </div>
      ${isAdmin() ? `<button onclick="confirmDeleteIndividualPlayer('${p.id}','${escQ(p.name)}')" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:4px 8px;line-height:1" title="${t('delete')}">×</button>` : ''}
    </div>`;
  }).join('');
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
