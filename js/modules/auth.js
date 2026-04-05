// ─── AUTH ─────────────────────────────────────────────────
let authMode = 'login';

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const isReg = authMode === 'register';
  document.getElementById('auth-subtitle').textContent = isReg ? t('registerNewCoach') : t('signInContinue');
  document.getElementById('auth-name-row').style.display = isReg ? '' : 'none';
  document.getElementById('auth-submit-btn').textContent = isReg ? t('register') : t('signIn');
  document.getElementById('auth-toggle-btn').textContent = isReg ? t('alreadyHaveAccount') : t('registerNewCoach');
  document.getElementById('auth-forgot-row').style.display = isReg ? 'none' : '';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
  document.getElementById('auth-resend-btn').style.display = 'none';
}

async function forgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  const errEl = document.getElementById('auth-error');
  const sucEl = document.getElementById('auth-success');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';
  if (!email) { errEl.textContent = t('fillAllFields'); errEl.style.display = 'block'; return; }
  try {
    await auth.sendPasswordResetEmail(email);
    sucEl.textContent = t('resetEmailSent');
    sucEl.style.display = 'block';
  } catch(e) {
    errEl.textContent = e.code === 'auth/user-not-found' ? t('errUserNotFound') :
                        e.code === 'auth/invalid-email'  ? t('errInvalidEmail') : t('errGeneric');
    errEl.style.display = 'block';
  }
}

async function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  const sucEl    = document.getElementById('auth-success');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = t('fillAllFields'); errEl.style.display = 'block'; return; }
  if (password.length < 6) { errEl.textContent = t('passwordTooShort'); errEl.style.display = 'block'; return; }
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;
  try {
    if (authMode === 'login') {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      if (!cred.user.emailVerified) {
        await auth.signOut();
        errEl.textContent = t('verifyEmailFirst');
        errEl.style.display = 'block';
        document.getElementById('auth-resend-btn').style.display = '';
        btn.disabled = false;
        return;
      }
      // onAuthStateChanged handles the rest
    } else {
      const name = document.getElementById('auth-fullname').value.trim();
      if (!name) { errEl.textContent = t('fillAllFields'); errEl.style.display = 'block'; btn.disabled = false; return; }
      registering = true;
      const newCred = await auth.createUserWithEmailAndPassword(email, password);
      const metaDoc = await db.collection('meta').doc('firstUser').get();
      const role = !metaDoc.exists ? 'admin' : 'coach';
      await db.collection('users').doc(newCred.user.uid).set({ username: name, email, role, createdAt: Date.now() });
      if (!metaDoc.exists) await db.collection('meta').doc('firstUser').set({ uid: newCred.user.uid });
      await newCred.user.sendEmailVerification();
      registering = false;
      await auth.signOut();
      // Reset form
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-fullname').value = '';
      document.getElementById('auth-name-row').style.display = 'none';
      authMode = 'login';
      document.getElementById('auth-submit-btn').textContent = t('signIn');
      document.getElementById('auth-toggle-btn').textContent = t('registerNewCoach');
      sucEl.textContent = t('accountCreated');
      sucEl.style.display = 'block';
    }
  } catch(e) {
    registering = false;
    errEl.textContent = firebaseAuthError(e.code);
    errEl.style.display = 'block';
  }
  btn.disabled = false;
}

async function resendVerification() {
  try {
    // Need to be signed in to resend — sign in briefly just to send verification
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await cred.user.sendEmailVerification();
    await auth.signOut();
    const sucEl = document.getElementById('auth-success');
    sucEl.textContent = t('verificationSent');
    sucEl.style.display = 'block';
  } catch(e) { console.error('[CoachHours] resendVerification error:', e); }
}

function firebaseAuthError(code) {
  return ({
    'auth/invalid-email': t('errInvalidEmail'),
    'auth/invalid-credential': t('errInvalidCredential'),
    'auth/user-not-found': t('errUserNotFound'),
    'auth/wrong-password': t('errWrongPassword'),
    'auth/email-already-in-use': t('errEmailInUse'),
    'auth/weak-password': t('errWeakPassword'),
    'auth/too-many-requests': t('errTooManyRequests'),
  })[code] || t('errGeneric');
}

function logoutUser() {
  logActivity('LOGOUT', currentUser?.username);
  if (sessionsUnsub) { sessionsUnsub(); sessionsUnsub = null; }
  if (groupsUnsub)   { groupsUnsub();   groupsUnsub = null; }
  if (playersUnsub)  { playersUnsub();  playersUnsub = null; }
  auth.signOut();
}
