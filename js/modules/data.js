// ─── FIRESTORE DATA ───────────────────────────────────────
function saveUD(key, val) {
  if (!auth.currentUser) return;
  db.collection('users').doc(activeUid()).collection('data').doc(key)
    .set({ data: val })
    .catch(e => console.error('[CoachHours] Firestore save failed:', e));
}

async function loadUserSettings() {
  const ref = db.collection('users').doc(activeUid()).collection('data');
  const [set] = await Promise.all([ref.doc('ch_settings').get()]);
  settings = Object.assign({ ratePrivate: 80, rateGroup: 50 }, set.exists ? set.data().data : {});
}

function subscribeSessions() {
  if (sessionsUnsub) { sessionsUnsub(); sessionsUnsub = null; }
  let q;
  if (isAdmin()) {
    q = db.collection('sessions');
  } else {
    // Simple where-only query avoids needing a composite index
    q = db.collection('sessions').where('assignedCoachId','==',currentUser.id);
  }
  sessionsUnsub = q.onSnapshot(snap => {
    sessions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    if (document.getElementById('screen-calendar').classList.contains('active')) renderCalendar();
  }, e => console.error('[CoachHours] Sessions listener error:', e));
}

function subscribeGroups() {
  if (groupsUnsub) { groupsUnsub(); groupsUnsub = null; }
  groupsUnsub = db.collection('groups').onSnapshot(snap => {
    groups = {};
    snap.docs.forEach(d => { groups[d.id] = { id: d.id, ...d.data() }; });
    if (document.getElementById('screen-groups').classList.contains('active')) renderGroups();
  }, e => console.error('[CoachHours] Groups listener error:', e));
}

function subscribePlayers() {
  if (playersUnsub) { playersUnsub(); playersUnsub = null; }
  playersUnsub = db.collection('players').onSnapshot(snap => {
    players = {};
    snap.docs.forEach(d => { players[d.id] = { id: d.id, ...d.data() }; });
    if (document.getElementById('screen-groups').classList.contains('active')) renderGroups();
  }, e => console.error('[CoachHours] Players listener error:', e));
}

async function saveIndividualPlayer(id, data) {
  if (!requireAuth() || !isAdmin()) return;
  try { await db.collection('players').doc(id).set(data); }
  catch(e) { console.error('[CoachHours] saveIndividualPlayer error:', e); }
}

async function deleteIndividualPlayer(id) {
  if (!requireAuth() || !isAdmin()) return;
  try { await db.collection('players').doc(id).delete(); logActivity('DELETE_PLAYER', id); }
  catch(e) { console.error('[CoachHours] deleteIndividualPlayer error:', e); }
}

async function loadAllCoaches() {
  if (!isAdmin()) return;
  try {
    const snap = await db.collection('users').get();
    allCoaches = snap.docs
      .filter(d => !d.data().removed)
      .map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error('[CoachHours] loadAllCoaches error:', e); }
}

// Sessions CRUD
async function createSession(data) {
  if (!requireAuth() || !isAdmin()) return;
  try {
    await db.collection('sessions').add({ ...data, createdBy: currentUser.id, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    logActivity('CREATE_SESSION', data.name);
  } catch(e) { console.error('[CoachHours] createSession error:', e); }
}

async function updateSession(id, patch) {
  try {
    await db.collection('sessions').doc(id).update(patch);
  } catch(e) { console.error('[CoachHours] updateSession error:', e); }
}

async function deleteSessionDoc(id) {
  if (!requireAuth() || !isAdmin()) return;
  try {
    await db.collection('sessions').doc(id).delete();
    logActivity('DELETE_SESSION', id);
  } catch(e) { console.error('[CoachHours] deleteSession error:', e); }
}

async function createRecurringSessions(base, freq, until) {
  const untilDate = parseDate(until);
  const dates = [];
  let cur = parseDate(base.date);
  const freqDays = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 30;
  while (cur <= untilDate) {
    dates.push(dateISO(cur));
    if (freq === 'monthly') { cur = new Date(cur.getFullYear(), cur.getMonth()+1, cur.getDate()); }
    else { cur = new Date(cur.getTime() + freqDays*24*60*60*1000); }
  }
  const parentId = 'r' + Date.now();
  const batch = db.batch();
  dates.forEach(d => {
    const ref = db.collection('sessions').doc();
    batch.set(ref, { ...base, date: d, recurring: { freq, until, parentId }, createdBy: currentUser.id, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  logActivity('CREATE_RECURRING', base.name + ' x' + dates.length);
}

// Groups CRUD (admin only)
async function saveGroup(id, data) {
  if (!requireAuth() || !isAdmin()) return;
  await db.collection('groups').doc(id).set(data);
}

async function deleteGroup(id) {
  if (!requireAuth() || !isAdmin()) return;
  await db.collection('groups').doc(id).delete();
}
