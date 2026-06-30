// ─── SUMMARY ──────────────────────────────────────────────
let summaryDate = new Date();

// Private and duo are billed per 45-min session unit; group and camp are per hour
function calcEarnings(hours, type) {
  const r = type === 'private' ? (settings.ratePrivate || 0)
          : type === 'double'  ? (settings.rateDouble  || 0)
          : type === 'camp'    ? (settings.rateCamp    || 0)
          : (settings.rateGroup || 0);
  return (type === 'private' || type === 'double') ? (hours * 60 / 45) * r : hours * r;
}

function sessionHours(s) {
  if (s.cancelled?.whole || s.cancelled?.general) return 0;
  if (s.cancelled?.from) {
    const played = timeToMins(s.cancelled.from) - timeToMins(s.startTime);
    return Math.max(0, played) / 60;
  }
  return (timeToMins(s.endTime) - timeToMins(s.startTime)) / 60;
}

function isSummaryMonthPast() {
  const today = new Date();
  const sy = summaryDate.getFullYear(), sm = summaryDate.getMonth();
  const ty = today.getFullYear(),       tm = today.getMonth();
  return sy < ty || (sy === ty && sm < tm);
}

function renderSummary() {
  const year = summaryDate.getFullYear();
  const month = summaryDate.getMonth();
  const monthStr = String(month+1).padStart(2,'0');
  const prefix = `${year}-${monthStr}`;

  document.getElementById('summary-h1').textContent = t('summary');
  document.getElementById('summary-subtitle').textContent = t('summarySubtitle');

  const monthSessions = getCalendarSessions().filter(s => s.date.startsWith(prefix));

  let privateHours = 0, groupHours = 0, privateCount = 0, groupCount = 0;
  let doubleHours  = 0, campHours  = 0, doubleCount  = 0, campCount  = 0;
  let rainCancelled = 0, generalCancelled = 0, partialCount = 0;
  monthSessions.forEach(s => {
    const h = sessionHours(s);
    if (s.cancelled?.whole)   { rainCancelled++;    return; }
    if (s.cancelled?.general) { generalCancelled++; return; }
    if (s.cancelled?.from) partialCount++;
    if      (s.type === 'private') { privateHours += h; privateCount++; }
    else if (s.type === 'double')  { doubleHours  += h; doubleCount++;  }
    else if (s.type === 'camp')    { campHours    += h; campCount++;    }
    else                           { groupHours   += h; groupCount++;   }
  });

  const workDaySet = new Set();
  monthSessions.forEach(s => { if (!s.cancelled?.whole && !s.cancelled?.general) workDaySet.add(s.date); });
  // Event-contributed hours (events with startTime/endTime set count as camp sessions)
  const visibleEvents = isAdmin() ? events : events.filter(ev => (ev.coaches || []).some(c => c.coachId === currentUser?.id));
  const evDayRows = [];
  visibleEvents.forEach(ev => {
    if (!ev.startTime || !ev.endTime) return;
    const evH = (timeToMins(ev.endTime) - timeToMins(ev.startTime)) / 60;
    if (evH <= 0) return;
    eventDates(ev).filter(d => d.startsWith(prefix)).forEach(d => {
      campHours += evH; campCount++;
      workDaySet.add(d);
      evDayRows.push({ date: d, name: ev.name, hours: evH, startTime: ev.startTime, endTime: ev.endTime });
    });
  });
  const workDays       = workDaySet.size;
  const transportTotal = workDays * (settings.transportBonus || 0);
  const totalEarnings  = calcEarnings(privateHours, 'private') + calcEarnings(groupHours, 'group') + calcEarnings(doubleHours, 'double') + calcEarnings(campHours, 'camp') + transportTotal;
  const totalHours     = privateHours + groupHours + doubleHours + campHours;

  const isPast = isSummaryMonthPast();

  const nav = `<div style="display:flex;align-items:center;justify-content:center;padding:0 16px 12px;gap:2px">
    <button onclick="summaryPrev()" style="background:none;border:none;color:var(--text2);font-size:26px;cursor:pointer;padding:8px 12px;line-height:1;font-family:inherit">‹</button>
    <div style="font-size:16px;font-weight:600;width:180px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${monthName(month)} ${year}</div>
    <button onclick="summaryNext()" style="background:none;border:none;color:var(--text2);font-size:26px;cursor:pointer;padding:8px 12px;line-height:1;font-family:inherit">›</button>
  </div>`;

  // Type rows for breakdown
  const typeRows = [];
  if (privateCount) typeRows.push({ label: t('privateSessions'), count: privateCount, hours: privateHours, color: '#22c55e', earnings: calcEarnings(privateHours, 'private') });
  if (groupCount)   typeRows.push({ label: t('groupSessions'),   count: groupCount,   hours: groupHours,   color: '#60a5fa', earnings: calcEarnings(groupHours,   'group')   });
  if (doubleCount)  typeRows.push({ label: t('doubleSessions'),  count: doubleCount,  hours: doubleHours,  color: '#a78bfa', earnings: calcEarnings(doubleHours,  'double')  });
  if (campCount)    typeRows.push({ label: t('campSessions'),    count: campCount,    hours: campHours,    color: '#fb923c', earnings: calcEarnings(campHours,    'camp')    });

  // Stacked bar — proportional width per session type
  const stackSegs = totalHours > 0 && typeRows.length
    ? typeRows.map(tr => `<div class="sum-seg" style="width:${(tr.hours / totalHours * 100).toFixed(1)}%;background:${tr.color}"></div>`).join('')
    : '';
  const stackedBar = stackSegs ? `<div class="sum-stack">${stackSegs}</div>` : '';

  // Type legend rows
  const typeLegRows = typeRows.map(tr =>
    `<div class="sum-typrow">
      <span class="sum-typswatch" style="background:${tr.color}"></span>
      <span class="sum-typlabel">${tr.label}</span>
      <span class="sum-typtxt">${tr.count}${SEP}${fmtHoursDecimal(tr.hours)}</span>
      <span class="sum-typamt">₪${tr.earnings.toFixed(0)}</span>
    </div>`
  ).join('');

  const extraLegRows = [
    transportTotal > 0 ? `<div class="sum-typrow">
      <span class="sum-typswatch" style="background:var(--text3)"></span>
      <span class="sum-typlabel">${t('transportBonus')}</span>
      <span class="sum-typtxt">${workDays} ${t('workDays')}</span>
      <span class="sum-typamt">₪${transportTotal.toFixed(0)}</span>
    </div>` : '',
    partialCount ? `<div class="sum-typrow">
      <span class="sum-typswatch" style="background:var(--orange);opacity:0.5"></span>
      <span class="sum-typlabel">🌧 ${t('partialSessions')}</span>
      <span class="sum-typtxt"></span>
      <span class="sum-typamt" style="color:var(--text2);font-weight:500">${partialCount}</span>
    </div>` : '',
    rainCancelled ? `<div class="sum-typrow">
      <span class="sum-typswatch" style="background:var(--text3)"></span>
      <span class="sum-typlabel">🌧 ${t('rainCancelledSessions')}</span>
      <span class="sum-typtxt"></span>
      <span class="sum-typamt" style="color:var(--text3);font-weight:500">${rainCancelled}</span>
    </div>` : '',
    generalCancelled ? `<div class="sum-typrow">
      <span class="sum-typswatch" style="background:var(--text3)"></span>
      <span class="sum-typlabel">✕ ${t('cancelledSessions')}</span>
      <span class="sum-typtxt"></span>
      <span class="sum-typamt" style="color:var(--text3);font-weight:500">${generalCancelled}</span>
    </div>` : '',
  ].join('');

  const hasBreakdown = typeRows.length > 0 || transportTotal > 0 || partialCount || rainCancelled || generalCancelled;

  // Single unified card: earnings + stats + breakdown
  const heroCard = `<div class="card sum-balance">
    <div class="sum-balance-label">${t('totalEarnings')}</div>
    <div class="sum-balance-amount">₪${totalEarnings.toFixed(0)}</div>
    <div class="sum-balance-stats">
      <div class="sum-stat"><span>${t('totalHours')}</span><strong>${fmtHoursDecimal(totalHours)}</strong></div>
      <div class="sum-stat"><span>${t('workDays')}</span><strong>${workDays}</strong></div>
    </div>
    ${hasBreakdown ? `<div class="sum-breakdown">${stackedBar}<div class="sum-typelist">${typeLegRows}${extraLegRows}</div></div>` : ''}
  </div>`;

  // PDF export button — always enabled; warning shown inside preview if month is current
  const pdfBtn = `<div style="padding:0 16px 8px">
    <button id="summary-pdf-btn" onclick="generateMonthlyPDF()" style="width:100%;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius-sm);padding:10px;font-size:13px;font-weight:500;color:var(--text2);font-family:inherit;cursor:pointer">↓ ${t('exportPDF')}</button>
  </div>`;

  // Build day groups for session log
  const sortedSessions = [...monthSessions].sort((a,b) => a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));
  const byDay = [];
  sortedSessions.forEach(s => {
    const last = byDay[byDay.length - 1];
    if (last && last.date === s.date) last.sessions.push(s);
    else byDay.push({ date: s.date, sessions: [s] });
  });
  // Merge event-day entries into byDay in sorted order
  evDayRows.forEach(ev => {
    let slot = byDay.find(d => d.date === ev.date);
    if (!slot) {
      const idx = byDay.findIndex(d => d.date > ev.date);
      slot = { date: ev.date, sessions: [], evEntries: [] };
      if (idx === -1) byDay.push(slot); else byDay.splice(idx, 0, slot);
    }
    (slot.evEntries = slot.evEntries || []).push(ev);
  });

  // Day-by-day session log
  const FULL_DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  const dayBlocks = byDay.map(({ date, sessions: daySessions, evEntries: dayEvEntries = [] }) => {
    const [y, mo, d] = date.split('-').map(Number);
    const dow = new Date(y, mo-1, d).getDay();
    const fullDayName = t(FULL_DAY_KEYS[dow]);

    const dayHours    = daySessions.reduce((sum, s) => sum + sessionHours(s), 0)
                      + dayEvEntries.reduce((sum, ev) => sum + ev.hours, 0);
    const dayEarnings = daySessions.reduce((sum, s) => {
      if (s.cancelled?.whole || s.cancelled?.general) return sum;
      return sum + calcEarnings(sessionHours(s), s.type);
    }, 0) + dayEvEntries.reduce((sum, ev) => sum + calcEarnings(ev.hours, 'camp'), 0);

    const rows = daySessions.map((s, i) => {
      const h = sessionHours(s);
      const isCancelled = !!(s.cancelled?.whole || s.cancelled?.general);
      const isPartial = !!s.cancelled?.from;
      const earnings = calcEarnings(h, s.type).toFixed(0);
      const isLast = (i === daySessions.length - 1) && dayEvEntries.length === 0;
      const rowClick = isAdmin()
        ? `onclick="openSummarySession('${escQ(s.id)}')" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;${isLast?'':'border-bottom:0.5px solid var(--border);'}${isCancelled?'opacity:0.4;':''}"`
        : `onclick="goToCalendarDay('${date}')" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;${isLast?'':'border-bottom:0.5px solid var(--border);'}${isCancelled?'opacity:0.4;':''}"`;
      return `<div ${rowClick}>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(s.name)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${escH(t(s.type||'private'))}${SEP}${s.startTime}${isPartial?' – '+s.cancelled.from:' – '+s.endTime}${isCancelled?(s.cancelled?.whole?SEP+'🌧 '+escH(t('rainWhole')):SEP+'✕ '+escH(t('cancelGeneral'))):isPartial?SEP+'🌧 '+escH(t('rainFrom')):''}</div>
        </div>
        <div style="text-align:${lang==='he'?'left':'right'};flex-shrink:0">
          <div style="font-size:13px;font-weight:500;color:${isCancelled?'var(--text3)':isPartial?'var(--orange)':'var(--text)'}">${fmtHoursDecimal(h)}</div>
          ${!isCancelled?`<div style="font-size:11px;color:var(--text2)">₪${earnings}</div>`:''}
        </div>
      </div>`;
    }).join('');

    const evRows = dayEvEntries.map((ev, i) => {
      const isLast = i === dayEvEntries.length - 1;
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;${isLast?'':'border-bottom:0.5px solid var(--border);'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(ev.name)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${t('camp')}${SEP}${ev.startTime} – ${ev.endTime}</div>
        </div>
        <div style="text-align:${lang==='he'?'left':'right'};flex-shrink:0">
          <div style="font-size:13px;font-weight:500">${fmtHoursDecimal(ev.hours)}</div>
          <div style="font-size:11px;color:var(--text2)">₪${calcEarnings(ev.hours,'camp').toFixed(0)}</div>
        </div>
      </div>`;
    }).join('');

    const dayTotalRow = dayHours > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:4px;border-top:0.5px solid var(--border)">
        <span style="font-size:11px;font-weight:600;color:var(--text2)">${fmtHoursDecimal(dayHours)}</span>
        ${dayEarnings > 0 ? `<span style="font-size:11px;font-weight:700;color:var(--green)">₪${dayEarnings.toFixed(0)}</span>` : ''}
      </div>` : '';

    return `<div class="card" style="margin-bottom:8px">
      <div onclick="goToCalendarDay('${date}')" style="cursor:pointer;display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:0.5px solid var(--border)">
        <div style="font-size:30px;font-weight:800;color:var(--text);line-height:1;letter-spacing:-1px;min-width:2ch;text-align:center">${d}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.2">${escH(fullDayName)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:1px">${escH(t(MONTH_NAMES[mo-1]))} ${year}</div>
        </div>
      </div>
      ${rows}${evRows}
      ${dayTotalRow}
    </div>`;
  }).join('');

  const listCard = byDay.length ? dayBlocks : `<div class="empty">${t('noSessions')}</div>`;

  document.getElementById('summary-body').innerHTML =
    nav +
    `<div class="sum-grid">
      <div class="sum-left">${heroCard}${pdfBtn}</div>
      <div class="sum-right"><div class="section-divider">${t('monthlySummary')}</div>${listCard}</div>
    </div>`;
}

function summaryPrev() {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth()-1, 1);
  renderSummary();
}
function summaryNext() {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth()+1, 1);
  renderSummary();
}


let _pdfContentHtml = '';
let _pdfFileName    = '';
let _pdfDirAttr     = 'ltr';

function generateMonthlyPDF() {
  const year   = summaryDate.getFullYear();
  const month  = summaryDate.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthSessions = getCalendarSessions().filter(s => s.date.startsWith(prefix));

  let privateHours = 0, groupHours = 0, privateCount = 0, groupCount = 0;
  let doubleHours  = 0, campHours  = 0, doubleCount  = 0, campCount  = 0;
  let rainCancelled = 0, generalCancelled = 0, partialCount = 0;
  monthSessions.forEach(s => {
    const h = sessionHours(s);
    if (s.cancelled?.whole)   { rainCancelled++;    return; }
    if (s.cancelled?.general) { generalCancelled++; return; }
    if (s.cancelled?.from) partialCount++;
    if      (s.type === 'private') { privateHours += h; privateCount++; }
    else if (s.type === 'double')  { doubleHours  += h; doubleCount++;  }
    else if (s.type === 'camp')    { campHours    += h; campCount++;    }
    else                           { groupHours   += h; groupCount++;   }
  });

  const workDaySet = new Set();
  monthSessions.forEach(s => { if (!s.cancelled?.whole && !s.cancelled?.general) workDaySet.add(s.date); });
  const workDays       = workDaySet.size;
  const transportTotal = workDays * (settings.transportBonus || 0);
  const totalEarnings  = calcEarnings(privateHours, 'private') + calcEarnings(groupHours, 'group') + calcEarnings(doubleHours, 'double') + calcEarnings(campHours, 'camp') + transportTotal;
  const totalHours     = privateHours + groupHours + doubleHours + campHours;

  const sortedSessions = [...monthSessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );
  const byDay = [];
  sortedSessions.forEach(s => {
    const last = byDay[byDay.length - 1];
    if (last && last.date === s.date) last.sessions.push(s);
    else byDay.push({ date: s.date, sessions: [s] });
  });

  _pdfDirAttr  = lang === 'he' ? 'rtl' : 'ltr';
  _pdfFileName = `summary-${prefix}.pdf`;

  const PDF_FULL_DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  const dayBlocksHtml = byDay.map(({ date, sessions: daySessions }) => {
    const [y, mo, d] = date.split('-').map(Number);
    const dow      = new Date(y, mo - 1, d).getDay();
    const dayLabel = `${t(PDF_FULL_DAY_KEYS[dow])}, ${d} ${t(MONTH_NAMES[mo - 1])}`;

    const dayHours    = daySessions.reduce((sum, s) => sum + sessionHours(s), 0);
    const dayEarnings = daySessions.reduce((sum, s) => {
      if (s.cancelled?.whole || s.cancelled?.general) return sum;
      return sum + calcEarnings(sessionHours(s), s.type);
    }, 0);

    const rows = daySessions.map(s => {
      const h           = sessionHours(s);
      const isCancelled = !!(s.cancelled?.whole || s.cancelled?.general);
      const isPartial   = !!s.cancelled?.from;
      const earnings    = calcEarnings(h, s.type).toFixed(0);
      const timeRange   = isPartial ? `${s.startTime} – ${s.cancelled.from} 🌧` : `${s.startTime} – ${s.endTime}`;
      const hoursColor  = isCancelled ? '#888' : isPartial ? '#fb923c' : '#111';
      return `<tr style="${isCancelled ? 'opacity:0.45;' : ''}">
        <td style="padding:6px 0;font-size:13px;font-weight:500;width:100%">
          ${escH(s.name)}
          <div style="font-size:11px;color:#666;font-weight:400;margin-top:2px">${timeRange}</div>
        </td>
        <td style="padding:6px 0 6px 0;font-size:12px;text-align:end;color:${hoursColor};white-space:nowrap;vertical-align:top">
          ${fmtHoursDecimal(h)}${!isCancelled ? `<br><span style="color:#999;font-size:11px">₪${earnings}</span>` : ''}
        </td>
      </tr>`;
    }).join('');

    const dayTotalHtml = dayHours > 0 ? `
      <tr><td colspan="2" style="padding-top:8px;border-top:0.5px solid #eee">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#555">${escH(fmtHoursDecimal(dayHours))}</span>
          ${dayEarnings > 0 ? `<span style="font-size:11px;font-weight:700;color:#16a34a">₪${dayEarnings.toFixed(0)}</span>` : ''}
        </div>
      </td></tr>` : '';

    return `<div class="pdf-block" style="border:1px solid #ddd;border-radius:8px;padding:10px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid #eee">
        <span style="font-size:24px;font-weight:800;color:#111;line-height:1;letter-spacing:-0.5px">${d}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#111;line-height:1.2">${escH(dayLabel.split(',')[0])}</div>
          <div style="font-size:11px;color:#666">${escH(t(MONTH_NAMES[mo - 1]))} ${year}</div>
        </div>
      </div>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}${dayTotalHtml}</table>
    </div>`;
  }).join('');

  const td  = (txt, extra='') => `<td style="font-size:13px;padding:7px 0;border-bottom:0.5px solid #eee${extra}">${txt}</td>`;
  const tdR = (txt, extra='') => `<td style="font-size:13px;font-weight:500;text-align:end;padding:7px 0;border-bottom:0.5px solid #eee${extra}">${txt}</td>`;
  const privateRow  = privateCount  ? `<tr>${td(escH(t('privateSessions')))}${tdR(`${privateCount}${SEP}${escH(fmtHoursDecimal(privateHours))}`)}</tr>` : '';
  const groupRow    = groupCount    ? `<tr>${td(escH(t('groupSessions')))}${tdR(`${groupCount}${SEP}${escH(fmtHoursDecimal(groupHours))}`)}</tr>` : '';
  const doubleRow   = doubleCount   ? `<tr>${td(escH(t('doubleSessions')))}${tdR(`${doubleCount}${SEP}${escH(fmtHoursDecimal(doubleHours))}`)}</tr>` : '';
  const campRow     = campCount     ? `<tr>${td(escH(t('campSessions')))}${tdR(`${campCount}${SEP}${escH(fmtHoursDecimal(campHours))}`)}</tr>` : '';
  const partialRow      = partialCount      ? `<tr>${td('🌧 '+t('partialSessions'),';color:#fb923c')}${tdR(partialCount,';color:#fb923c')}</tr>` : '';
  const rainCancelRow   = rainCancelled     ? `<tr>${td('🌧 '+t('rainCancelledSessions'),';color:#888')}${tdR(rainCancelled,';color:#888')}</tr>` : '';
  const genCancelRow    = generalCancelled  ? `<tr>${td('✕ '+t('cancelledSessions'),';color:#888')}${tdR(generalCancelled,';color:#888')}</tr>` : '';

  _pdfContentHtml = `
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:4px">${escH(monthName(month))} ${year}</div>
    <div style="font-size:12px;color:#666;margin-bottom:18px">${escH(t('monthlySummary'))}</div>
    <div class="pdf-block" style="border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin-bottom:18px">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        ${privateRow}${groupRow}${doubleRow}${campRow}${partialRow}${rainCancelRow}${genCancelRow}
        ${transportTotal > 0 ? `<tr>${td(escH(t('transportBonus'))+SEP+workDays+' '+escH(t('workDays')))}${tdR('₪'+transportTotal.toFixed(0))}</tr>` : ''}
        <tr><td style="font-size:14px;font-weight:700;padding:9px 0 5px;border-top:1px solid #ccc">${escH(t('totalHours'))}</td><td style="font-size:14px;font-weight:700;text-align:end;padding:9px 0 5px;border-top:1px solid #ccc">${escH(fmtHoursDecimal(totalHours))}</td></tr>
        <tr><td style="font-size:14px;font-weight:600;padding:5px 0">${escH(t('totalEarnings'))}</td><td style="font-size:14px;font-weight:700;text-align:end;padding:5px 0;color:#16a34a">₪${totalEarnings.toFixed(0)}</td></tr>
      </table>
    </div>
    <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">${escH(t('monthlySummary'))}</div>
    ${byDay.length ? dayBlocksHtml : `<div style="color:#888;font-size:13px;padding:12px 0">${escH(t('noSessions'))}</div>`}
  `;

  const canShare = !!navigator.canShare;
  const overlay = document.createElement('div');
  overlay.id = 'pdf-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:var(--bg)';
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:0.5px solid var(--border);flex-shrink:0">
      <button onclick="document.getElementById('pdf-preview-overlay').remove()" style="background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text2);padding:0;font-family:inherit">×</button>
      <span style="font-size:15px;font-weight:600;color:var(--text)">${escH(monthName(month))} ${year}</span>
    </div>
    <div style="flex:1;overflow-y:auto;padding:20px 16px;direction:${_pdfDirAttr};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;background:#fff">
      ${!isSummaryMonthPast() ? `<div style="background:#fff3cd;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#92400e">${lang==='he'?'שים לב: החודש טרם הסתיים — ייתכן שחסרות פגישות.':'Heads up: this month isn\'t over yet — some sessions may still be missing.'}</div>` : ''}
      ${_pdfContentHtml}
    </div>
    <div style="display:flex;gap:10px;padding:12px 16px;border-top:0.5px solid var(--border);flex-shrink:0;background:var(--bg)">
      <button id="pdf-action-download" onclick="_exportPDF('download')" style="flex:1;background:var(--accent);color:#111;border:none;border-radius:var(--radius-sm);padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">↓ ${lang==='he'?'הורד PDF':'Download PDF'}</button>
      ${canShare ? `<button id="pdf-action-share" onclick="_exportPDF('share')" style="flex:1;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;color:var(--text)">${lang==='he'?'שתף':'Share'}</button>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
}

async function _exportPDF(action) {
  const dlBtn    = document.getElementById('pdf-action-download');
  const shareBtn = document.getElementById('pdf-action-share');
  if (dlBtn)    { dlBtn.textContent    = '...'; dlBtn.style.pointerEvents    = 'none'; }
  if (shareBtn) { shareBtn.textContent = '...'; shareBtn.style.pointerEvents = 'none'; }

  const container = document.createElement('div');
  container.style.cssText = `position:fixed;top:0;left:-9999px;width:600px;background:#fff;padding:28px 32px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;direction:${_pdfDirAttr}`;
  container.innerHTML = _pdfContentHtml;
  document.body.appendChild(container);

  // Measure block positions before canvas capture (reading offsetTop forces layout)
  const blocks = Array.from(container.querySelectorAll('.pdf-block'));
  const blockMeasurements = blocks.map(b => ({ top: b.offsetTop, height: b.offsetHeight }));
  const containerCSSWidth = container.offsetWidth || 600;

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    document.body.removeChild(container);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Page geometry (with margins)
    const marginX = 10, marginY = 12;
    const usableW = 210 - marginX * 2;   // mm
    const usableH = 297 - marginY * 2;   // mm

    // Scale: canvas pixels → mm
    const mmPerPx    = usableW / canvas.width;
    const pageHtPx   = usableH / mmPerPx;              // page height in canvas pixels
    const scaleFactor = canvas.width / containerCSSWidth; // CSS px → canvas px

    // Calculate page-break positions that avoid splitting any .pdf-block
    const pageStarts = [0];
    let pageEnd = pageHtPx;

    for (const { top, height } of blockMeasurements) {
      const blockTop = top * scaleFactor;
      const blockBot = (top + height) * scaleFactor;

      if (blockBot <= pageEnd) continue; // fits on current page — no action needed

      if (blockTop >= pageEnd) {
        // Gap between page end and block start — advance pages naturally
        while (blockTop >= pageEnd) { pageStarts.push(pageEnd); pageEnd += pageHtPx; }
      } else {
        // Block straddles the boundary — start a new page at the block's top
        pageStarts.push(blockTop);
        pageEnd = blockTop + pageHtPx;
        // If the block itself is taller than one page, slice through it
        while (blockBot > pageEnd) { pageStarts.push(pageEnd); pageEnd += pageHtPx; }
      }
    }

    // Render each page slice onto the PDF
    for (let i = 0; i < pageStarts.length; i++) {
      if (i > 0) pdf.addPage();
      const startPx  = Math.round(pageStarts[i]);
      const endPx    = i + 1 < pageStarts.length ? Math.round(pageStarts[i + 1]) : canvas.height;
      const sliceHPx = Math.min(endPx - startPx, canvas.height - startPx);
      if (sliceHPx <= 0) continue;

      const slice = document.createElement('canvas');
      slice.width  = canvas.width;
      slice.height = sliceHPx;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, startPx, canvas.width, sliceHPx, 0, 0, canvas.width, sliceHPx);

      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', marginX, marginY, usableW, sliceHPx * mmPerPx);
    }

    const pdfBlob = pdf.output('blob');
    const pdfFile = new File([pdfBlob], _pdfFileName, { type: 'application/pdf' });

    if (action === 'share' && navigator.canShare?.({ files: [pdfFile] })) {
      await navigator.share({ files: [pdfFile], title: _pdfFileName });
    } else {
      const url = URL.createObjectURL(pdfBlob);
      const a   = document.createElement('a');
      a.href = url; a.download = _pdfFileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    document.getElementById('pdf-preview-overlay')?.remove();
  } catch(e) {
    console.error('PDF export error:', e);
    if (container.parentNode) document.body.removeChild(container);
    if (dlBtn)    { dlBtn.textContent    = lang==='he'?'הורד PDF':'Download PDF'; dlBtn.style.pointerEvents    = ''; }
    if (shareBtn) { shareBtn.textContent = lang==='he'?'שתף':'Share';             shareBtn.style.pointerEvents = ''; }
  }
}
