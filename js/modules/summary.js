// ─── SUMMARY ──────────────────────────────────────────────
let summaryDate = new Date();

function sessionHours(s) {
  if (s.cancelled?.whole || s.cancelled?.general) return 0;
  if (s.cancelled?.from) {
    const played = timeToMins(s.cancelled.from) - timeToMins(s.startTime);
    return Math.max(0, played) / 60;
  }
  return (timeToMins(s.endTime) - timeToMins(s.startTime)) / 60;
}

function renderSummary() {
  const year = summaryDate.getFullYear();
  const month = summaryDate.getMonth();
  const monthStr = String(month+1).padStart(2,'0');
  const prefix = `${year}-${monthStr}`;

  document.getElementById('summary-h1').textContent = t('summary');
  document.getElementById('summary-subtitle').textContent = t('summarySubtitle');

  // Filter sessions for this month visible to the current user
  const monthSessions = getCalendarSessions().filter(s => s.date.startsWith(prefix));

  // Salary calc
  let privateHours = 0, groupHours = 0, privateCount = 0, groupCount = 0;
  let cancelledWhole = 0, partialCount = 0;
  monthSessions.forEach(s => {
    const h = sessionHours(s);
    if (s.cancelled?.whole || s.cancelled?.general) { cancelledWhole++; return; }
    if (s.cancelled?.from) partialCount++;
    if (s.type === 'private') { privateHours += h; privateCount++; }
    else { groupHours += h; groupCount++; }
  });

  const rate = (type) => type === 'private' ? (settings.ratePrivate||0) : (settings.rateGroup||0);
  const privateEarnings = privateHours * rate('private');
  const groupEarnings   = groupHours   * rate('group');
  const totalEarnings   = privateEarnings + groupEarnings;
  const totalHours      = privateHours + groupHours;

  const navPrev = '‹';
  const navNext = '›';
  const nav = `<div style="display:flex;align-items:center;padding:0 16px 12px">
    <div style="flex:1;display:flex;justify-content:center;align-items:center;gap:2px">
      <button onclick="summaryPrev()" style="background:none;border:none;color:var(--text2);font-size:26px;cursor:pointer;padding:8px 12px;line-height:1;font-family:inherit">${navPrev}</button>
      <div style="font-size:16px;font-weight:600;width:180px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${monthName(month)} ${year}</div>
      <button onclick="summaryNext()" style="background:none;border:none;color:var(--text2);font-size:26px;cursor:pointer;padding:8px 12px;line-height:1;font-family:inherit">${navNext}</button>
    </div>
    <button id="summary-share-btn" onclick="shareMonthlySummary()" style="background:none;border:0.5px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:500;color:var(--text2);cursor:pointer;font-family:inherit;transition:opacity 0.15s;line-height:1;flex-shrink:0">${t('shareMonth')}</button>
  </div>`;

  const statsCard = `<div class="card">
    <div class="breakdown-row">
      <span class="breakdown-label">${t('privateSessions')}</span>
      <span class="breakdown-val">${privateCount} · ${fmtHoursDecimal(privateHours)}</span>
    </div>
    <div class="breakdown-row">
      <span class="breakdown-label">${t('groupSessions')}</span>
      <span class="breakdown-val">${groupCount} · ${fmtHoursDecimal(groupHours)}</span>
    </div>
    ${partialCount ? `<div class="breakdown-row">
      <span class="breakdown-label" style="color:var(--orange)">🌧 ${t('partialSessions')}</span>
      <span class="breakdown-val" style="color:var(--orange)">${partialCount}</span>
    </div>` : ''}
    ${cancelledWhole ? `<div class="breakdown-row">
      <span class="breakdown-label" style="color:var(--text3)">🌧 ${t('cancelledSessions')}</span>
      <span class="breakdown-val" style="color:var(--text3)">${cancelledWhole}</span>
    </div>` : ''}
    <div class="breakdown-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:12px">
      <span class="breakdown-label" style="font-weight:600">${t('totalHours')}</span>
      <span class="breakdown-val" style="font-weight:700">${fmtHoursDecimal(totalHours)}</span>
    </div>
    <div class="breakdown-row">
      <span class="breakdown-label" style="font-weight:600">${t('totalEarnings')}</span>
      <span class="breakdown-val" style="font-weight:700;color:var(--green)">₪${totalEarnings.toFixed(0)}</span>
    </div>
  </div>`;

  // Session list grouped by day
  const sortedSessions = [...monthSessions].sort((a,b) => a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));

  // Group by date
  const byDay = [];
  sortedSessions.forEach(s => {
    const last = byDay[byDay.length - 1];
    if (last && last.date === s.date) last.sessions.push(s);
    else byDay.push({ date: s.date, sessions: [s] });
  });

  const dayBlocks = byDay.map(({ date, sessions: daySessions }) => {
    const [y, mo, d] = date.split('-').map(Number);
    const dow = new Date(y, mo-1, d).getDay();
    const dayLabel = `${t(DAY_KEYS[dow])}, ${d} ${t(MONTH_NAMES[mo-1])}`;

    const rows = daySessions.map((s, i) => {
      const h = sessionHours(s);
      const isCancelled = s.cancelled?.whole;
      const isPartial = !!s.cancelled?.from;
      const coachName = allCoaches.find(c => c.id === s.assignedCoachId)?.username || '';
      const earnings = (h * rate(s.type)).toFixed(0);
      const isLast = i === daySessions.length - 1;
      const rowClick = isAdmin()
        ? `onclick="openSummarySession('${escQ(s.id)}')" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;${isLast?'':'border-bottom:0.5px solid var(--border);'}${isCancelled?'opacity:0.4;':''}"`
        : `onclick="goToCalendarDay('${date}')" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;${isLast?'':'border-bottom:0.5px solid var(--border);'}${isCancelled?'opacity:0.4;':''}"`;
      return `<div ${rowClick}>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(s.name)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${s.startTime}${isPartial?' – '+s.cancelled.from+' 🌧':' – '+s.endTime}${coachName?' · '+escH(coachName):''}</div>
        </div>
        <div style="text-align:${lang==='he'?'left':'right'};flex-shrink:0">
          <div style="font-size:13px;font-weight:500;color:${isCancelled?'var(--text3)':isPartial?'var(--orange)':'var(--text)'}">${fmtHoursDecimal(h)}</div>
          ${!isCancelled?`<div style="font-size:11px;color:var(--text2)">₪${earnings}</div>`:''}
        </div>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-bottom:8px">
      <div onclick="goToCalendarDay('${date}')" style="font-size:12px;font-weight:600;color:var(--text2);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;cursor:pointer">${escH(dayLabel)}</div>
      ${rows}
    </div>`;
  }).join('');

  const listCard = byDay.length ? dayBlocks : `<div class="empty">${t('noSessions')}</div>`;

  document.getElementById('summary-body').innerHTML = nav + `<div class="section-divider">${t('monthlySummary')}</div>` + statsCard + listCard;
}

function summaryPrev() {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth()-1, 1);
  renderSummary();
}
function summaryNext() {
  summaryDate = new Date(summaryDate.getFullYear(), summaryDate.getMonth()+1, 1);
  renderSummary();
}

async function shareMonthlySummary() {
  const year = summaryDate.getFullYear();
  const month = summaryDate.getMonth();
  const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
  const monthSessions = getCalendarSessions().filter(s => s.date.startsWith(prefix));

  let privateHours = 0, groupHours = 0, privateCount = 0, groupCount = 0;
  monthSessions.forEach(s => {
    const h = sessionHours(s);
    if (s.cancelled?.whole || s.cancelled?.general) return;
    if (s.type === 'private') { privateHours += h; privateCount++; }
    else { groupHours += h; groupCount++; }
  });
  const totalHours = privateHours + groupHours;
  const totalEarnings = privateHours * (settings.ratePrivate||0) + groupHours * (settings.rateGroup||0);

  const isHe = lang === 'he';
  const lines = [
    `📅 ${monthName(month)} ${year}`,
    ``,
    `${isHe ? 'פרטיים' : 'Private'}: ${privateCount} (${fmtHoursDecimal(privateHours)})`,
    `${isHe ? 'קבוצתיים' : 'Group'}: ${groupCount} (${fmtHoursDecimal(groupHours)})`,
    ``,
    `${t('totalHours')}: ${fmtHoursDecimal(totalHours)}`,
    `${t('totalEarnings')}: ₪${Math.round(totalEarnings)}`,
  ].join('\n');

  const btn = document.getElementById('summary-share-btn');
  const flash = (msg) => {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1800);
  };

  if (navigator.share) {
    try { await navigator.share({ text: lines }); } catch(e) { /* dismissed */ }
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(lines);
    flash(t('copiedToClipboard'));
  }
}
