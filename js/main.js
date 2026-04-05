// ─── STARTUP ──────────────────────────────────────────────
window.onerror = (msg, src, line) => { console.error('[CoachHours Error]', msg, 'at', src+':'+line); return false; };
window.onunhandledrejection = e => console.error('[CoachHours Promise]', e.reason);

auth.onAuthStateChanged(async (fbUser) => {
  if (registering) return;
  if (fbUser) {
    try {
      // Email must be verified
      if (!fbUser.emailVerified) {
        document.getElementById('loading-overlay').style.display = 'none';
        return;
      }
      let profileDoc;
      try { profileDoc = await db.collection('users').doc(fbUser.uid).get(); }
      catch(netErr) {
        if (netErr.code !== 'unavailable') throw netErr;
        await new Promise(r => setTimeout(r, 2000));
        profileDoc = await db.collection('users').doc(fbUser.uid).get();
      }
      if (!profileDoc.exists || profileDoc.data().removed) { await auth.signOut(); return; }
      const p = profileDoc.data();
      currentUser = { id: fbUser.uid, username: p.username, email: p.email || fbUser.email, role: p.role };
      viewingUserId = null;

      // Load data in parallel
      await Promise.all([loadUserSettings(), loadAllCoaches()]);
      subscribeSessions();
      subscribeGroups();
      subscribePlayers();

      // Apply UI
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('main-nav').style.display = '';
      document.getElementById('sidebar-nav').style.display = '';
      document.getElementById('sidebar-username').textContent = currentUser?.username || '';
      // Show admin nav button
      document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin() ? '' : 'none';
      });
      applyLangStrings();
      showScreen('calendar');
      logActivity('SESSION_RESUME', currentUser.username);
    } catch(e) {
      console.error('[CoachHours] Auth state error:', e);
      document.getElementById('loading-overlay').style.display = 'none';
      if (e.code === 'unavailable' || e.message?.includes('offline')) {
        document.getElementById('auth-error').textContent = t('connectionError');
        document.getElementById('auth-error').style.display = 'block';
      } else {
        await auth.signOut();
      }
    }
  } else {
    currentUser = null;
    if (sessionsUnsub) { sessionsUnsub(); sessionsUnsub = null; }
    if (groupsUnsub)   { groupsUnsub();   groupsUnsub = null; }
    if (playersUnsub)  { playersUnsub();  playersUnsub = null; }
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('main-nav').style.display = 'none';
    document.getElementById('sidebar-nav').style.display = 'none';
    document.getElementById('view-banner')?.remove();
    document.querySelector('.app')?.classList.remove('viewing');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-auth').classList.add('active');
    applyLangStrings();
  }
});

// Apply lang on page load (before auth resolves)
applyLangStrings();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
