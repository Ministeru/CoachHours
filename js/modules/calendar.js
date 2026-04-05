// ─── CALENDAR ─────────────────────────────────────────────
function getCalendarSessions() {
  if (viewingUserId) return sessions.filter(s => s.assignedCoachId === viewingUserId);
  return sessions;
}

function sessionsForDate(dateStr) {
  return getCalendarSessions().filter(s => s.date === dateStr);
}

function setCalView(view) {
  calView = view;
  ['month','week','day'].forEach(v => {
    document.getElementById('cvb-'+v)?.classList.toggle('active', v === view);
  });
  renderCalendar();
}

function calPrev() {
  if (calView === 'month') { calDate = new Date(calDate.getFullYear(), calDate.getMonth()-1, 1); }
  else if (calView === 'week') { calDate = new Date(calDate.getTime() - 7*24*60*60*1000); }
  else { calDate = new Date(calDate.getTime() - 24*60*60*1000); }
  renderCalendar();
}
function calNext() {
  if (calView === 'month') { calDate = new Date(calDate.getFullYear(), calDate.getMonth()+1, 1); }
  else if (calView === 'week') { calDate = new Date(calDate.getTime() + 7*24*60*60*1000); }
  else { calDate = new Date(calDate.getTime() + 24*60*60*1000); }
  renderCalendar();
}

function renderCalendar() {
  // Show/hide "Today" jump chip
  const todayChip = document.getElementById('cal-today-chip');
  if (todayChip) {
    const today = new Date();
    const todayStr = dateISO(today);
    let todayInView = false;
    if (calView === 'month') {
      todayInView = calDate.getFullYear() === today.getFullYear() && calDate.getMonth() === today.getMonth();
    } else if (calView === 'week') {
      const dow = calDate.getDay();
      const monday = new Date(calDate.getTime() - ((dow + 6) % 7) * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      todayInView = today >= monday && today <= new Date(sunday.getTime() + 86400000 - 1);
    } else {
      todayInView = dateISO(calDate) === todayStr;
    }
    todayChip.style.display = todayInView ? 'none' : '';
    todayChip.textContent = t('today');
  }
  // Render today strip
  const stripEl = document.getElementById('cal-today-strip');
  if (stripEl) stripEl.innerHTML = renderTodayStrip();
  // Render view
  if (calView === 'month') renderMonthView();
  else if (calView === 'week') renderWeekView();
  else renderDayView();
}

function calJumpToday() {
  calDate = new Date();
  renderCalendar();
}

function renderTodayStrip() {
  const todayStr = dateISO(new Date());
  // Only show when today is visible in current view
  const now = new Date();
  let todayInView = false;
  if (calView === 'month') {
    todayInView = calDate.getFullYear() === now.getFullYear() && calDate.getMonth() === now.getMonth();
  } else if (calView === 'week') {
    const dow = calDate.getDay();
    const monday = new Date(calDate.getTime() - ((dow + 6) % 7) * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    todayInView = now >= monday && now <= new Date(sunday.getTime() + 86400000 - 1);
  } else {
    todayInView = dateISO(calDate) === todayStr;
  }
  if (!todayInView) return '';
  const todaySessions = sessionsForDate(todayStr).filter(s => !s.cancelled?.whole && !s.cancelled?.general);
  if (!todaySessions.length) return '';

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const upcoming = [...todaySessions]
    .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime))
    .find(s => timeToMins(s.startTime) > nowMins);

  let totalHours = 0, totalEarnings = 0;
  todaySessions.forEach(s => {
    const h = sessionHours(s);
    totalHours += h;
    totalEarnings += h * (s.type === 'private' ? (settings.ratePrivate||0) : (settings.rateGroup||0));
  });

  const nextInfo = upcoming
    ? `<span style="color:var(--text2)">▶ ${upcoming.startTime}</span>`
    : `<span style="color:var(--green)">✓ ${lang==='he'?'הכל נגמר':'All done'}</span>`;

  return `<div style="margin:0 16px 8px;padding:10px 14px;background:rgba(255,255,255,0.035);border:0.5px solid var(--border);border-radius:var(--radius);display:flex;align-items:center;gap:12px">
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px">${t('todaySessionsLabel')}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:14px;font-weight:600">${todaySessions.length} ${lang==='he'?'אימונים':'sessions'}</span>
        <span style="color:var(--text3);font-size:12px">·</span>
        <span style="font-size:13px;color:var(--text2)">${fmtHoursDecimal(totalHours)}</span>
        <span style="color:var(--text3);font-size:12px">·</span>
        <span style="font-size:13px;color:var(--green);font-weight:500">₪${Math.round(totalEarnings)}</span>
        <span style="color:var(--text3);font-size:12px">·</span>
        ${nextInfo}
      </div>
    </div>
  </div>`;
}

function renderMonthView() {
  const year = calDate.getFullYear(), month = calDate.getMonth();
  if (isAdmin()) document.getElementById('cal-add-btn').style.display = '';
  document.getElementById('cal-title').textContent = monthName(month) + ' ' + year;

  const today = dateISO(new Date());
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  // Start week on Sunday (0)
  let startDow = firstDay.getDay(); // 0=Sun

  const days = [];
  // Previous month padding
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1-startDow+i);
    days.push({ date: dateISO(d), otherMonth: true });
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: dateISO(new Date(year, month, d)), otherMonth: false });
  }
  // Next month padding (fill to 6 weeks = 42 cells)
  while (days.length % 7 !== 0) {
    const d = new Date(year, month+1, days.length - lastDay.getDate() - startDow + 1);
    days.push({ date: dateISO(d), otherMonth: true });
  }

  const dayHeaders = DAY_KEYS.map(k => `<div class="month-day-header">${t(k)}</div>`).join('');

  const cells = days.map(({ date, otherMonth }) => {
    const dayNum = parseInt(date.split('-')[2]);
    const daysSessions = sessionsForDate(date);
    const isToday = date === today;
    const chips = daysSessions.slice(0,2).map(s => {
      const isCancelled = s.cancelled && (s.cancelled.whole || s.cancelled.from || s.cancelled.general);
      const cls = isCancelled ? 'month-chip-cancelled' : (s.type === 'group' ? 'month-chip-group' : 'month-chip-private');
      return `<div class="month-chip ${cls}">${escH(s.name)}</div>`;
    }).join('');
    const more = daysSessions.length > 2 ? `<div class="month-more">+${daysSessions.length-2}</div>` : '';
    const addBtn = isAdmin() ? `<button class="month-add-btn" onclick="event.stopPropagation();openSessionModal('${date}',null,null)">+</button>` : '';
    return `<div class="month-day${otherMonth?' other-month':''}${isToday?' today':''}" onclick="goToDay('${date}')">
      <div class="month-day-num">${dayNum}</div>
      ${chips}${more}${addBtn}
    </div>`;
  }).join('');

  document.getElementById('cal-body').innerHTML = `
    <div class="month-grid">
      ${dayHeaders}
      ${cells}
    </div>
  `;
}

function goToDay(dateStr) {
  calDate = parseDate(dateStr);
  setCalView('day');
}

function renderWeekView() {
  if (isAdmin()) document.getElementById('cal-add-btn').style.display = '';
  // Get Monday of the week containing calDate
  const dow = calDate.getDay(); // 0=Sun
  const monday = new Date(calDate.getTime() - ((dow + 6) % 7) * 24*60*60*1000); // start from Monday
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i*24*60*60*1000);
    days.push(d);
  }
  const startStr = days[0].getDate() + ' ' + t(MONTH_NAMES[days[0].getMonth()].replace('Short',''));
  const endStr   = days[6].getDate() + ' ' + monthName(days[6].getMonth()) + ' ' + days[6].getFullYear();
  document.getElementById('cal-title').textContent = startStr + ' – ' + endStr;

  const today = dateISO(new Date());
  let html = '';
  days.forEach(d => {
    const dateStr = dateISO(d);
    const dayLabel = t(DAY_KEYS[d.getDay()]) + ' ' + d.getDate() + '/' + (d.getMonth()+1);
    const isToday = dateStr === today;
    const daySessions = sessionsForDate(dateStr);
    const addBtn = isAdmin() ? `<button onclick="openSessionModal('${dateStr}',null,null)" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1;padding:0 4px">+</button>` : '';
    html += `<div class="week-day-block">
      <div class="week-day-header${isToday?' today':''}">
        <span>${dayLabel}</span>${addBtn}
      </div>`;
    if (!daySessions.length) {
      html += `<div style="font-size:11px;color:var(--text3);padding:4px 0 6px">${t('noSessions')}</div>`;
    } else {
      daySessions.forEach(s => { html += sessionCardHtml(s); });
    }
    html += '</div>';
  });
  document.getElementById('cal-body').innerHTML = html;
}

function renderDayView() {
  document.getElementById('cal-add-btn').style.display = 'none'; // day view has its own add button
  const dateStr = dateISO(calDate);
  const dow = calDate.getDay();
  const dayLabel = t(DAY_KEYS[dow]) + ', ' + calDate.getDate() + ' ' + monthName(calDate.getMonth()) + ' ' + calDate.getFullYear();
  document.getElementById('cal-title').textContent = dayLabel;

  const daySessions = sessionsForDate(dateStr);
  const addBtn   = isAdmin() ? `<button onclick="openSessionModal('${dateStr}',null,null)" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit">+ ${t('addSession').replace('+ ','')}</button>` : '';
  const shiftBtn = isAdmin() ? `<button onclick="openShiftDayModal('${dateStr}')" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit">⏱ ${lang==='he'?'הזז':'Shift'}</button>` : '';
  const moveBtn  = isAdmin() ? `<button onclick="openMoveDayModal('${dateStr}')" style="background:var(--bg3);border:0.5px solid var(--border);border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit">📅 ${lang==='he'?'העבר':'Move'}</button>` : '';

  let html = isAdmin() ? `<div style="padding:0 16px 12px;display:flex;justify-content:flex-end;gap:8px">${shiftBtn}${moveBtn}${addBtn}</div>` : '';

  if (!daySessions.length) {
    html += `<div class="card"><div class="empty">${t('noSessions')}</div></div>`;
  } else {
    // Sort by startTime
    const sorted = [...daySessions].sort((a,b) => a.startTime.localeCompare(b.startTime));
    html += '<div style="padding:0 16px">';
    sorted.forEach(s => { html += sessionCardHtml(s, true); });
    html += '</div>';
  }
  document.getElementById('cal-body').innerHTML = html;
}

function sessionCardHtml(s) {
  const isCancelled = s.cancelled && (s.cancelled.whole || s.cancelled.from || s.cancelled.general);
  const typeClass = s.type === 'group' ? 'group' : 'private';
  const cancelClass = isCancelled ? ' cancelled' : '';
  const coachName = allCoaches.find(c => c.id === s.assignedCoachId)?.username || '';
  const groupName = s.groupId && groups[s.groupId] ? groups[s.groupId].name : '';
  const playerName = s.assignedPlayerName || '';

  // Type badge
  const typeBadge = `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;margin-inline-start:6px;${
    s.type==='group'
      ? 'background:rgba(96,165,250,0.2);color:var(--blue)'
      : 'background:rgba(34,197,94,0.2);color:var(--green)'
  }">${t(s.type)}</span>`;

  // Info rows
  let infoRows = `<div class="session-card-meta" style="margin-top:5px">⏱ ${s.startTime} – ${s.endTime}</div>`;
  if (coachName) infoRows += `<div class="session-card-meta">👤 ${escH(coachName)}</div>`;
  if (groupName) infoRows += `<div class="session-card-meta">👥 ${escH(groupName)}</div>`;
  if (playerName) infoRows += `<div class="session-card-meta">🎯 ${escH(playerName)}</div>`;
  if (s.notes) infoRows += `<div class="session-card-meta" style="font-style:italic;color:var(--text3)">📝 ${escH(s.notes)}</div>`;

  let cancelBadge = '';
  if (isCancelled) {
    let reason, icon;
    if (s.cancelled.general) { reason = t('cancelGeneral'); icon = '🚫'; }
    else if (s.cancelled.whole) { reason = t('rainWhole'); icon = '🌧'; }
    else { reason = `${t('rainFrom')} ${s.cancelled.from}`; icon = '🌧'; }
    cancelBadge = `<div class="session-card-cancelled-badge">${icon} ${t('cancelled')} — ${reason}</div>`;
  }

  let attBtn = '';
  if (s.type === 'group' && !isCancelled && isAttendanceOpen(s)) {
    const present = s.attendance?.present?.length ?? '?';
    const total = s.groupId && groups[s.groupId] ? groups[s.groupId].players.length : '?';
    attBtn = `<div class="session-card-att-btn" onclick="event.stopPropagation();openAttendanceModal('${s.id}')">✅ ${t('attendance')} ${present}/${total}</div>`;
  } else if (s.type === 'group' && !isCancelled && s.attendance) {
    const present = s.attendance.present?.length ?? 0;
    const total = s.groupId && groups[s.groupId] ? groups[s.groupId].players.length : '?';
    attBtn = `<div style="font-size:11px;color:var(--text3);margin-top:4px">✅ ${present}/${total}</div>`;
  }

  const clickHandler = isAdmin() ? `onclick="openSessionModal('${s.date}','${s.startTime}','${escQ(s.id)}')"` : '';
  const slotTaken = sessions.some(x => x.date === s.date && x.id !== s.id && x.startTime === s.endTime);
  const nextBtn = (isAdmin() && !slotTaken) ? `<button style="margin-top:6px;padding:4px 10px;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius-sm);font-size:11px;color:var(--text2);cursor:pointer;font-family:inherit" onclick="event.stopPropagation();openSessionModal('${escQ(s.date)}','${escQ(s.endTime)}',null)">${t('nextSessionFrom')} ${s.endTime}</button>` : '';

  return `<div class="session-card ${typeClass}${cancelClass}" ${clickHandler} style="margin-bottom:8px">
    <div style="display:flex;align-items:center">
      <div class="session-card-name" style="flex:1">${escH(s.name)}</div>${typeBadge}
    </div>
    ${infoRows}
    ${cancelBadge}
    ${attBtn}
    ${nextBtn}
  </div>`;
}

// ─── ATTENDANCE ────────────────────────────────────────────
function isAttendanceOpen(session) {
  const now = new Date();
  const [endH, endM] = session.endTime.split(':').map(Number);
  const sessionEnd = parseDate(session.date);
  sessionEnd.setHours(endH, endM, 0, 0);
  const nextDay10 = parseDate(session.date);
  nextDay10.setDate(nextDay10.getDate() + 1);
  nextDay10.setHours(10, 0, 0, 0);
  return now >= sessionEnd && now <= nextDay10;
}

function openAttendanceModal(sessionId) {
  const s = sessions.find(x => x.id === sessionId);
  if (!s) return;
  const g = s.groupId ? groups[s.groupId] : null;

  if (!g) {
    createModal(`<div class="sheet-title">${t('attendance')}</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">${t('matchingGroupNotFound')}</p>
      <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>`);
    return;
  }

  if (!isAttendanceOpen(s)) {
    createModal(`<div class="sheet-title">${t('attendance')}</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">${t('attendanceWindow')}</p>
      <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>`);
    return;
  }

  const current = s.attendance?.present || [];
  const savedAt = s.attendance?.savedAt || null;
  const rows = g.players.map(name => `
    <label style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:0.5px solid var(--border);cursor:pointer">
      <input type="checkbox" id="att-${escId(name)}" ${current.includes(name)?'checked':''}
        style="width:18px;height:18px;accent-color:var(--blue)">
      <span style="font-size:15px">${escH(name)}</span>
    </label>`).join('');
  const noPlayers = !g.players.length ? `<p style="color:var(--text2);font-size:13px;padding:12px 0">${t('noPlayers')}</p>` : '';

  createModal(`
    <div class="sheet-title">${escH(g.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${s.date} · ${s.startTime}${savedAt?' · '+savedAt:''}</div>
    ${rows}${noPlayers}
    <button class="btn btn-primary" style="margin-top:14px" onclick="saveAttendance('${sessionId}','${g.players.map(escQ).join(',')}')">
      ${t('saveAttendance')}
    </button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
}

async function saveAttendance(sessionId, playersCsv) {
  const players = playersCsv ? playersCsv.split(',') : [];
  const present = players.filter(name => document.getElementById('att-'+escId(name))?.checked);
  const now = new Date();
  const savedAt = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  await updateSession(sessionId, { attendance: { present, savedAt } });
  closeModal();
  logActivity('SAVE_ATTENDANCE', sessionId);
}

// ─── SHIFT DAY ────────────────────────────────────────────
function openShiftDayModal(dateStr) {
  if (!isAdmin()) return;
  const presets = [-30, -15, -10, -5, 5, 10, 15, 30];
  const chips = presets.map(n =>
    `<button class="chip" id="shift-chip-${n < 0 ? 'n'+Math.abs(n) : 'p'+n}" onclick="selectShiftChip(${n})">${n > 0 ? '+' : ''}${n}${t('min')}</button>`
  ).join('');
  createModal(`
    <div class="sheet-title">${lang==='he'?'הזז את כל היום':'Shift entire day'}</div>
    <div class="chip-group" style="margin-bottom:14px">${chips}</div>
    <input type="number" id="shift-custom-input" placeholder="${lang==='he'?'דקות מותאמות אישית':'custom minutes'}"
      oninput="[${presets.join(',')}].forEach(n=>{const id='shift-chip-'+(n<0?'n'+Math.abs(n):'p'+n);document.getElementById(id)?.classList.remove('active');})"
      style="width:100%;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-size:14px;color:var(--text);font-family:inherit;box-sizing:border-box;margin-bottom:10px">
    <button class="btn btn-primary" onclick="applyDayShift('${dateStr}',parseInt(document.getElementById('shift-custom-input').value))">
      ${lang==='he'?'אישור':'Confirm'}
    </button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
}

function selectShiftChip(n) {
  const presets = [-30, -15, -10, -5, 5, 10, 15, 30];
  presets.forEach(p => {
    const id = 'shift-chip-' + (p < 0 ? 'n'+Math.abs(p) : 'p'+p);
    document.getElementById(id)?.classList.toggle('active', p === n);
  });
  const input = document.getElementById('shift-custom-input');
  if (input) input.value = n;
}

async function applyDayShift(dateStr, offsetMins) {
  if (!offsetMins || isNaN(offsetMins)) return;
  const daySessions = sessionsForDate(dateStr);
  if (!daySessions.length) { closeModal(); return; }
  const batch = db.batch();
  daySessions.forEach(s => {
    batch.update(db.collection('sessions').doc(s.id), {
      startTime: addMins(s.startTime, offsetMins),
      endTime:   addMins(s.endTime,   offsetMins)
    });
  });
  await batch.commit();
  logActivity('SHIFT_DAY', `${dateStr} ${offsetMins > 0 ? '+' : ''}${offsetMins}min`);
  closeModal();
}

// ─── MOVE DAY ─────────────────────────────────────────────
function openMoveDayModal(dateStr) {
  if (!isAdmin()) return;
  createModal(`
    <div class="sheet-title">${lang==='he'?'העבר יום לתאריך אחר':'Move day to another date'}</div>
    <div class="form-group">
      <label class="form-label">${t('date')}</label>
      <input type="date" id="move-day-target" value="${dateStr}">
    </div>
    <div id="move-day-warning" style="display:none;color:var(--orange);font-size:13px;margin-bottom:10px">
      ${lang==='he'?'לתאריך הנבחר כבר יש אימונים.':'Target date already has sessions.'}
    </div>
    <button class="btn btn-primary" style="margin-top:4px" onclick="confirmMoveDayTo('${dateStr}')">
      ${lang==='he'?'העבר':'Move'}
    </button>
    <button id="move-day-force-btn" class="btn" style="display:none;background:var(--orange);color:#fff;margin-top:4px"
      onclick="_executeMoveDay('${dateStr}',document.getElementById('move-day-target').value)">
      ${lang==='he'?'העבר בכל זאת':'Proceed anyway'}
    </button>
    <button class="btn btn-secondary" onclick="closeModal()">${t('cancel')}</button>
  `);
}

function confirmMoveDayTo(sourceDateStr) {
  const targetDateStr = document.getElementById('move-day-target')?.value;
  if (!targetDateStr || targetDateStr === sourceDateStr) return;
  const targetSessions = sessionsForDate(targetDateStr);
  if (targetSessions.length > 0) {
    document.getElementById('move-day-warning').style.display = '';
    document.getElementById('move-day-force-btn').style.display = '';
    return;
  }
  _executeMoveDay(sourceDateStr, targetDateStr);
}

async function _executeMoveDay(sourceDateStr, targetDateStr) {
  if (!targetDateStr || targetDateStr === sourceDateStr) return;
  const daySessions = sessionsForDate(sourceDateStr);
  if (!daySessions.length) { closeModal(); return; }
  const batch = db.batch();
  daySessions.forEach(s =>
    batch.update(db.collection('sessions').doc(s.id), { date: targetDateStr })
  );
  calDate = parseDate(targetDateStr);
  await batch.commit();
  logActivity('MOVE_DAY', `${sourceDateStr} → ${targetDateStr}`);
  closeModal();
  renderCalendar();
}

// ─── SUMMARY NAVIGATION ───────────────────────────────────
function goToCalendarDay(dateStr) {
  calDate = parseDate(dateStr);
  calView = 'day';
  showScreen('calendar');
  ['month','week','day'].forEach(v =>
    document.getElementById('cvb-'+v)?.classList.toggle('active', v === 'day')
  );
}

function openSummarySession(sessionId) {
  const s = sessions.find(x => x.id === sessionId);
  if (!s) return;
  goToCalendarDay(s.date);
  setTimeout(() => openSessionModal(s.date, s.startTime, s.id), 50);
}
