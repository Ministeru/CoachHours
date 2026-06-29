// ─── DAY PICKER ───────────────────────────────────────────
// Reusable, instance-based day selector keyed by container id. Replaces the
// boring native <input type="date"> with a tap/drag month grid.
//   dpInit('my-id', ['2026-07-01', ...], { single:false });
//   dpRender('my-id');   dpGetDates('my-id');
// single:true  → exactly one day (tap replaces); used by the session creator.
// single:false → multi-select with drag-paint; used by events.

const _dpState = {};

function dpInit(id, dates, opts) {
  const sorted = [...(dates || [])].sort();
  _dpState[id] = {
    selected: new Set(dates || []),
    month: sorted.length ? parseDate(sorted[0]) : new Date(),
    single: !!(opts && opts.single),
    paint: null,
  };
}

function dpGetDates(id) { return _dpState[id] ? [..._dpState[id].selected].sort() : []; }

function dpRender(id) {
  const st = _dpState[id];
  const c = document.getElementById(id);
  if (!st || !c) return;
  const year = st.month.getFullYear(), month = st.month.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const todayStr = dateISO(new Date());

  const headers = DAY_KEYS.map(k => `<div class="dp-head">${t(k)}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="dp-cell"></div>`;
  for (let d = 1; d <= lastDay; d++) {
    const ds  = dateISO(new Date(year, month, d));
    const sel = st.selected.has(ds) ? ' dp-sel' : '';
    const tod = ds === todayStr ? ' dp-today' : '';
    cells += `<div class="dp-cell dp-day${sel}${tod}" data-date="${ds}">${d}</div>`;
  }
  const countHtml = st.single ? '' : `<div class="dp-count" data-dp-count="${id}">${st.selected.size} ${t('day')}</div>`;

  c.innerHTML = `
    <div class="dp-toolbar">
      <button type="button" class="dp-nav" onclick="dpShift('${id}',-1)">‹</button>
      <span class="dp-title">${monthName(month)} ${year}</span>
      <button type="button" class="dp-nav" onclick="dpShift('${id}',1)">›</button>
    </div>
    <div class="dp-weekhead">${headers}</div>
    <div class="dp-grid">${cells}</div>
    ${countHtml}`;

  const grid = c.querySelector('.dp-grid');
  grid.addEventListener('pointerdown', e => dpDown(id, e));
  grid.addEventListener('pointerover', e => dpOver(id, e));
}

function dpShift(id, dir) {
  const st = _dpState[id]; if (!st) return;
  st.month = new Date(st.month.getFullYear(), st.month.getMonth() + dir, 1);
  dpRender(id);
}

function dpDown(id, e) {
  const st = _dpState[id]; if (!st) return;
  const cell = e.target.closest('.dp-day'); if (!cell) return;
  e.preventDefault();
  // Touch pointers get implicit capture to the pressed cell — release it so
  // pointerover can fire on the other cells during a drag.
  try { cell.releasePointerCapture(e.pointerId); } catch (_) {}
  if (st.single) { st.selected = new Set([cell.dataset.date]); dpRender(id); return; }
  st.paint = st.selected.has(cell.dataset.date) ? 'remove' : 'add';
  dpToggle(id, cell);
}

function dpOver(id, e) {
  const st = _dpState[id]; if (!st || !st.paint) return;
  const cell = e.target.closest('.dp-day');
  if (cell) dpToggle(id, cell);
}

function dpToggle(id, cell) {
  const st = _dpState[id];
  const ds = cell.dataset.date;
  if (st.paint === 'remove') { st.selected.delete(ds); cell.classList.remove('dp-sel'); }
  else                       { st.selected.add(ds);    cell.classList.add('dp-sel'); }
  const cnt = document.querySelector(`[data-dp-count="${id}"]`);
  if (cnt) cnt.textContent = `${st.selected.size} ${t('day')}`;
}

document.addEventListener('pointerup', () => {
  Object.values(_dpState).forEach(s => { s.paint = null; });
});
