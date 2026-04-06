// ─── i18n ─────────────────────────────────────────────────
let lang = localStorage.getItem('ch_lang') || 'he';

const STRINGS = {
  he: {
    appTitle: 'שעות אימון', calendar: 'לוח שנה', groups: 'קבוצות', playersTab: 'שחקנים', groupsSection: 'קבוצות',
    settings: 'הגדרות', admin: 'ניהול', month: 'חודש', week: 'שבוע', day: 'יום',
    addSession: '+ אימון', save: 'שמור', cancel: 'ביטול', delete: 'מחק',
    attendance: 'נוכחות', cancelled: 'מבוטל - גשם', confirm: 'אישור',
    sessionName: 'שם האימון', startTime: 'התחלה', endTime: 'סיום',
    assignCoach: 'שיבוץ מאמן', group: 'קבוצה', private: 'פרטי',
    recurring: 'חוזר', recurringNone: 'אין', recurringWeekly: 'שבועי',
    recurringBiweekly: 'דו-שבועי', recurringMonthly: 'חודשי', until: 'עד תאריך',
    rainCancel: 'ביטול', rainWhole: 'גשם - כל היום', rainFrom: 'גשם - מהשעה',
    cancelGeneral: 'ביטול כללי', uncancel: 'פעיל', editSession: 'עריכת אימון', newSession: 'אימון חדש',
    deleteSession: 'מחק אימון', signIn: 'התחבר', register: 'הרשמה',
    signOut: 'התנתק', fullName: 'שם מלא', email: 'אימייל', password: 'סיסמה',
    newPassword: 'סיסמה חדשה', confirmPassword: 'אשר סיסמה', updatePassword: 'עדכן סיסמה',
    changePassword: 'שינוי סיסמה', account: 'חשבון', language: 'שפה',
    rates: 'תעריפים', ratePrivate: 'שיעור פרטי', rateGroup: 'שיעור קבוצתי',
    perHour: '₪ / שעה', per45min: '₪ / 45 דק׳', perDay: '₪ / יום',
    transportBonus: 'נסיעות', workDays: 'ימי עבודה', noSessions: 'אין אימונים', noGroups: 'אין קבוצות עדיין',
    players: 'שחקנים', addPlayer: '+ הוסף', deleteGroup: 'מחק קבוצה',
    newGroup: 'קבוצה חדשה', groupName: 'שם הקבוצה', coaches: 'מאמנים',
    noCoaches: 'אין מאמנים נוספים', activityLog: 'יומן פעילות',
    viewCoach: 'צפייה', makeAdmin: 'הפוך למנהל', revokeAdmin: 'בטל הרשאת מנהל',
    removeCoach: 'הסר', exitView: '✕ סיום צפייה', viewing: 'צופה בפרופיל',
    sessionType: 'סוג אימון', selectGroup: 'בחר קבוצה', selectCoach: 'בחר מאמן',
    today: 'היום', sun: 'א׳', mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳',
    janShort: 'ינו', febShort: 'פבר', marShort: 'מרץ', aprShort: 'אפר',
    mayShort: 'מאי', junShort: 'יונ', julShort: 'יול', augShort: 'אוג',
    sepShort: 'ספט', octShort: 'אוק', novShort: 'נוב', decShort: 'דצמ',
    january: 'ינואר', february: 'פברואר', march: 'מרץ', april: 'אפריל',
    may: 'מאי', june: 'יוני', july: 'יולי', august: 'אוגוסט',
    september: 'ספטמבר', october: 'אוקטובר', november: 'נובמבר', december: 'דצמבר',
    sunday: 'ראשון', monday: 'שני', tuesday: 'שלישי', wednesday: 'רביעי',
    thursday: 'חמישי', friday: 'שישי', saturday: 'שבת',
    signInContinue: 'התחבר כדי להמשיך', registerNewCoach: 'הרשמה כמאמן חדש',
    alreadyHaveAccount: 'כבר יש לך חשבון? התחבר', accountCreated: 'החשבון נוצר! אמת את האימייל לפני הכניסה.',
    verifyEmailFirst: 'יש לאמת את כתובת האימייל תחילה. בדוק את תיבת הדואר שלך.',
    resendVerification: 'שלח שוב אימייל אימות', fillAllFields: 'אנא מלא את כל השדות.',
    passwordTooShort: 'הסיסמה חייבת להיות לפחות 6 תווים.',
    passwordMismatch: 'הסיסמאות אינן תואמות.', passwordUpdated: 'הסיסמה עודכנה',
    connectionError: 'שגיאת חיבור. בדוק את האינטרנט ונסה שוב.',
    attendanceWindow: 'הנוכחות נפתחת לאחר סיום האימון עד 10:00 למחרת.',
    saveAttendance: 'שמור נוכחות', noPlayers: 'אין שחקנים בקבוצה זו.',
    matchingGroupNotFound: 'לא נמצאה קבוצה מתאימה לאימון זה.',
    confirmDelete: 'אישור מחיקה', confirmDeleteMsg: 'פעולה זו אינה הפיכה.',
    adminCoach: 'מנהל · מאמן', coach: 'מאמן', loading: 'טוען…',
    date: 'תאריך', playerLabel: 'שחקן / תלמיד', playerPlaceholder: 'בחר או הקלד שם',
    sessionsCount: 'אימונים', noActivity: 'אין פעילות',
    verificationSent: 'אימייל אימות נשלח. בדוק את תיבת הדואר שלך.',
    groupsSubtitle: 'רשימות ונוכחות', playersTabSubtitle: 'קבוצות ושחקנים פרטיים', adminSubtitle: 'מאמנים ופעילות',
    recentLoginRequired: 'התנתק והתחבר מחדש ואז נסה שוב.',
    passwordUpdateError: 'שגיאה בעדכון הסיסמה.',
    fullnamePlaceholder: 'השם המלא שלך', emailPlaceholder: 'כתובת אימייל',
    errInvalidEmail: 'כתובת אימייל לא תקינה.', errInvalidCredential: 'אימייל או סיסמה שגויים.',
    errUserNotFound: 'אין חשבון עם כתובת אימייל זו.', errWrongPassword: 'סיסמה שגויה.',
    errEmailInUse: 'חשבון עם אימייל זה כבר קיים.', errWeakPassword: 'הסיסמה חייבת להיות לפחות 6 תווים.',
    errTooManyRequests: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.', errGeneric: 'שגיאה. נסה שוב.',
    forgotPassword: 'שכחת סיסמה?', resetEmailSent: 'קישור לאיפוס נשלח לאימייל שלך.',
    errEndBeforeStart: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.',
    notes: 'הערות', summary: 'סיכום', monthlySummary: 'סיכום חודשי',
    totalHours: 'סה״כ שעות', totalEarnings: 'הכנסה משוערת',
    privateSessions: 'שיעורים פרטיים', groupSessions: 'שיעורים קבוצתיים',
    hr: ' שע׳', hrs: ' שע׳', min: ' דק׳', duration: 'משך',
    individualPlayers: 'שחקנים פרטיים', addIndividualPlayer: '+ שחקן חדש',
    noIndividualPlayers: 'אין שחקנים פרטיים עדיין',
    scheduleGroupSession: '📅 תזמן אימון קבוצתי',
    typeConfirmToDelete: 'הקלד "confirm" לאישור המחיקה',
    editPlayers: 'עריכה', donePlayers: 'סיום',
    nextSessionFrom: '+ אימון מהשעה',
    cancelledSessions: 'מבוטלים', partialSessions: 'חלקיים', rainCancelledSessions: 'מבוטל - גשם',
    summarySubtitle: 'שעות והכנסה',
    exportPDF: 'PDF', copiedToClipboard: 'הועתק!',
    todaySessionsLabel: 'אימוני היום',
    double: 'זוגי', camp: 'קייטנה',
    rateDouble: 'שיעור זוגי', rateCamp: 'קייטנה',
    doubleSessions: 'שיעורים זוגיים', campSessions: 'אימוני קייטנה',
  },
  en: {
    appTitle: 'CoachHours', calendar: 'Calendar', groups: 'Groups', playersTab: 'Players', groupsSection: 'Groups',
    settings: 'Settings', admin: 'Admin', month: 'Month', week: 'Week', day: 'Day',
    addSession: '+ Session', save: 'Save', cancel: 'Cancel', delete: 'Delete',
    attendance: 'Attendance', cancelled: 'Cancelled - Rain', confirm: 'Confirm',
    sessionName: 'Session Name', startTime: 'Start', endTime: 'End',
    assignCoach: 'Assign Coach', group: 'Group', private: 'Private',
    recurring: 'Recurring', recurringNone: 'None', recurringWeekly: 'Weekly',
    recurringBiweekly: 'Bi-weekly', recurringMonthly: 'Monthly', until: 'Until',
    rainCancel: 'Cancellation', rainWhole: 'Rain – Whole Day', rainFrom: 'Rain – From Time',
    cancelGeneral: 'General Cancel', uncancel: 'Active', editSession: 'Edit Session', newSession: 'New Session',
    deleteSession: 'Delete Session', signIn: 'Sign In', register: 'Register',
    signOut: 'Sign Out', fullName: 'Full Name', email: 'Email', password: 'Password',
    newPassword: 'New Password', confirmPassword: 'Confirm Password', updatePassword: 'Update Password',
    changePassword: 'Change Password', account: 'Account', language: 'Language',
    rates: 'Rates', ratePrivate: 'Private lesson', rateGroup: 'Group lesson',
    perHour: '₪ / hour', per45min: '₪ / 45 min', perDay: '₪ / day',
    transportBonus: 'Transport', workDays: 'work days', noSessions: 'No sessions', noGroups: 'No groups yet',
    players: 'Players', addPlayer: '+ Add', deleteGroup: 'Delete group',
    newGroup: 'New Group', groupName: 'Group name', coaches: 'Coaches',
    noCoaches: 'No other coaches registered yet.', activityLog: 'Activity log',
    viewCoach: 'View', makeAdmin: 'Make admin', revokeAdmin: 'Revoke admin',
    removeCoach: '✕', exitView: '✕ Exit view', viewing: 'Viewing',
    sessionType: 'Session Type', selectGroup: 'Select group', selectCoach: 'Select coach',
    today: 'Today', sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    janShort: 'Jan', febShort: 'Feb', marShort: 'Mar', aprShort: 'Apr',
    mayShort: 'May', junShort: 'Jun', julShort: 'Jul', augShort: 'Aug',
    sepShort: 'Sep', octShort: 'Oct', novShort: 'Nov', decShort: 'Dec',
    january: 'January', february: 'February', march: 'March', april: 'April',
    may: 'May', june: 'June', july: 'July', august: 'August',
    september: 'September', october: 'October', november: 'November', december: 'December',
    sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
    signInContinue: 'Sign in to continue', registerNewCoach: 'Register as new coach',
    alreadyHaveAccount: 'Already have an account? Sign in', accountCreated: 'Account created! Verify your email before signing in.',
    verifyEmailFirst: 'Please verify your email first. Check your inbox.',
    resendVerification: 'Resend verification email', fillAllFields: 'Please fill in all fields.',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordMismatch: 'Passwords do not match.', passwordUpdated: 'Password updated',
    connectionError: 'Connection error. Check your internet and try again.',
    attendanceWindow: 'Attendance opens after the session ends until 10:00 AM next day.',
    saveAttendance: 'Save attendance', noPlayers: 'No players in this group.',
    matchingGroupNotFound: 'No matching group found for this session.',
    confirmDelete: 'Confirm Delete', confirmDeleteMsg: 'This action cannot be undone.',
    adminCoach: 'Admin · Coach', coach: 'Coach', loading: 'Loading…',
    date: 'Date', playerLabel: 'Player / Student', playerPlaceholder: 'Choose or type name',
    sessionsCount: 'sessions', noActivity: 'No activity',
    verificationSent: 'Verification email sent. Check your inbox.',
    groupsSubtitle: 'Rosters & Attendance', playersTabSubtitle: 'Groups & Individual Players', adminSubtitle: 'Coaches & Activity',
    recentLoginRequired: 'Sign out and back in, then try again.',
    passwordUpdateError: 'Error updating password.',
    fullnamePlaceholder: 'Your full name', emailPlaceholder: 'Email address',
    errInvalidEmail: 'Invalid email address.', errInvalidCredential: 'Incorrect email or password.',
    errUserNotFound: 'No account with this email.', errWrongPassword: 'Wrong password.',
    errEmailInUse: 'An account with this email already exists.', errWeakPassword: 'Password must be at least 6 characters.',
    errTooManyRequests: 'Too many attempts. Try again later.', errGeneric: 'An error occurred. Try again.',
    forgotPassword: 'Forgot password?', resetEmailSent: 'Password reset link sent to your email.',
    errEndBeforeStart: 'End time must be after start time.',
    notes: 'Notes', summary: 'Summary', monthlySummary: 'Monthly Summary',
    totalHours: 'Total Hours', totalEarnings: 'Estimated Earnings',
    privateSessions: 'Private Sessions', groupSessions: 'Group Sessions',
    hr: 'hr', hrs: 'hr', min: 'min', duration: 'Duration',
    individualPlayers: 'Individual Players', addIndividualPlayer: '+ New player',
    noIndividualPlayers: 'No individual players yet',
    scheduleGroupSession: '📅 Schedule group session',
    typeConfirmToDelete: 'Type "confirm" to confirm deletion',
    editPlayers: 'Edit', donePlayers: 'Done',
    nextSessionFrom: '+ Session from',
    cancelledSessions: 'Cancelled', partialSessions: 'Partial', rainCancelledSessions: 'Rain - Cancelled',
    summarySubtitle: 'Hours & Earnings',
    exportPDF: 'PDF', copiedToClipboard: 'Copied!',
    todaySessionsLabel: "Today's sessions",
    double: 'Duo', camp: 'Camp',
    rateDouble: 'Duo session', rateCamp: 'Camp session',
    doubleSessions: 'Duo Sessions', campSessions: 'Camp Sessions',
  }
};

function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key; }

function setLang(newLang) {
  lang = newLang;
  localStorage.setItem('ch_lang', lang);
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'he' ? 'rtl' : 'ltr';
  applyLangStrings();
  // Re-render active screen
  const active = document.querySelector('.screen.active');
  if (active) {
    const id = active.id.replace('screen-', '');
    if (id === 'calendar') renderCalendar();
    else if (id === 'groups') renderGroups();
    else if (id === 'summary') renderSummary();
    else if (id === 'settings') renderSettings();
    else if (id === 'admin') renderAdminPanel();
  }
}

function applyLangStrings() {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.title = t('appTitle');
  // Auth
  const atitle = document.getElementById('auth-title'); if (atitle) atitle.textContent = t('appTitle');
  const sub = document.getElementById('auth-subtitle');
  if (sub) sub.textContent = authMode === 'register' ? t('registerNewCoach') : t('signInContinue');
  const lbl_fn = document.getElementById('lbl-fullname'); if (lbl_fn) lbl_fn.textContent = t('fullName');
  const lbl_em = document.getElementById('lbl-email'); if (lbl_em) lbl_em.textContent = t('email');
  const lbl_pw = document.getElementById('lbl-password'); if (lbl_pw) lbl_pw.textContent = t('password');
  const inp_fn = document.getElementById('auth-fullname'); if (inp_fn) inp_fn.placeholder = t('fullnamePlaceholder');
  const inp_em = document.getElementById('auth-email'); if (inp_em) inp_em.placeholder = t('emailPlaceholder');
  const inp_pw = document.getElementById('auth-password'); if (inp_pw) inp_pw.placeholder = t('password');
  const fbtn = document.getElementById('auth-forgot-btn'); if (fbtn) fbtn.textContent = t('forgotPassword');
  const sbtn = document.getElementById('auth-submit-btn'); if (sbtn) sbtn.textContent = authMode === 'register' ? t('register') : t('signIn');
  const tbtn = document.getElementById('auth-toggle-btn'); if (tbtn) tbtn.textContent = authMode === 'register' ? t('alreadyHaveAccount') : t('registerNewCoach');
  const rbtn = document.getElementById('auth-resend-btn'); if (rbtn) rbtn.textContent = t('resendVerification');
  // Cal view buttons
  const cvbM = document.getElementById('cvb-month'); if (cvbM) cvbM.textContent = t('month');
  const cvbW = document.getElementById('cvb-week'); if (cvbW) cvbW.textContent = t('week');
  const cvbD = document.getElementById('cvb-day'); if (cvbD) cvbD.textContent = t('day');
  // Nav labels (bottom nav + sidebar)
  const nlc = document.getElementById('nav-lbl-calendar'); if (nlc) nlc.textContent = t('calendar');
  const nlg = document.getElementById('nav-lbl-groups'); if (nlg) nlg.textContent = t('playersTab');
  const nlsum = document.getElementById('nav-lbl-summary'); if (nlsum) nlsum.textContent = t('summary');
  const nls = document.getElementById('nav-lbl-settings'); if (nls) nls.textContent = t('settings');
  const nla = document.getElementById('nav-lbl-admin'); if (nla) nla.textContent = t('admin');
  const snc = document.getElementById('snav-lbl-calendar'); if (snc) snc.textContent = t('calendar');
  const sng = document.getElementById('snav-lbl-groups'); if (sng) sng.textContent = t('playersTab');
  const snsum = document.getElementById('snav-lbl-summary'); if (snsum) snsum.textContent = t('summary');
  const sns = document.getElementById('snav-lbl-settings'); if (sns) sns.textContent = t('settings');
  const sna = document.getElementById('snav-lbl-admin'); if (sna) sna.textContent = t('admin');
  const san = document.getElementById('sidebar-app-name'); if (san) san.textContent = t('appTitle');
  // Headers
  const hdr = document.getElementById('app-header-title'); if (hdr) hdr.textContent = t('appTitle');
  const gh = document.getElementById('groups-h1'); if (gh) gh.textContent = t('playersTab');
  const gsd = document.getElementById('groups-section-divider'); if (gsd) gsd.textContent = t('groupsSection');
  const gs = document.getElementById('groups-subtitle'); if (gs) gs.textContent = t('playersTabSubtitle');
  const sumh = document.getElementById('summary-h1'); if (sumh) sumh.textContent = t('summary');
  const sums = document.getElementById('summary-subtitle'); if (sums) sums.textContent = t('summarySubtitle');
  const sh = document.getElementById('settings-h1'); if (sh) sh.textContent = t('settings');
  const ah = document.getElementById('admin-h1'); if (ah) ah.textContent = t('admin');
  const as2 = document.getElementById('admin-subtitle'); if (as2) as2.textContent = t('adminSubtitle');
  const cadd = document.getElementById('cal-add-btn'); if (cadd) cadd.textContent = t('addSession');
  const gadd = document.getElementById('groups-add-btn'); if (gadd) gadd.textContent = '+ ' + t('newGroup');
  const iadd = document.getElementById('individual-add-btn'); if (iadd) iadd.textContent = t('addIndividualPlayer');
  const ipd = document.getElementById('individual-players-divider'); if (ipd) ipd.textContent = t('individualPlayers');
  const ldng = document.getElementById('loading-text'); if (ldng) ldng.textContent = t('loading');
  const navBtns = document.querySelectorAll('.cal-nav');
  if (navBtns.length >= 2) { navBtns[0].textContent = '‹'; navBtns[1].textContent = '›'; }
}
