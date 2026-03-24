# CoachHours — Developer Guide

## Git / Workflow Rules

- **Do not push to GitHub after every change.** Only push when the user explicitly asks to push. The user decides when changes are ready to go live.

---

## Architecture

- **Single-file PWA**: All code lives in `index.html`. No build step, no backend server.
- **Storage**: Firebase Firestore (database) + Firebase Auth. Data is shared across all origins — GitHub Pages and Live Server both read/write the same cloud data.
- **Multi-user**: Coaches register via the login screen (email + password). Admin can view/manage other coaches from Settings.
- **Offline**: Service worker (`sw.js`) caches the app shell. Firestore offline persistence (`db.enablePersistence()`) caches data for offline reads.
- **Deployment**: GitHub Pages (public repo). No server-side code.

---

## Firebase Setup

- **Project**: `coachhours-49524` — Firebase Console at https://console.firebase.google.com
- **Auth**: Email/Password sign-in enabled
- **Firestore**: Production mode, security rules enforce per-user data isolation
- **Authorized domains**: `ministeru.github.io` + `localhost` (added in Auth → Settings)
- **firebaseConfig** is embedded directly in `index.html` (safe — it is a public API key, security is enforced by Firestore rules and authorized domains)

---

## Firestore Data Structure

```
/users/{uid}                        — profile: { username, email, role, createdAt, removed? }
/users/{uid}/data/ch_history        — { data: [...] }
/users/{uid}/data/ch_deleted        — { data: [...] }
/users/{uid}/data/ch_settings       — { data: {...} }
/users/{uid}/data/ch_received       — { data: {...} }
/users/{uid}/data/ch_groups         — { data: {...} }
```

All data documents use a `{ data: value }` wrapper to keep the shape consistent.

Session attendance is stored directly on each session object (not in a separate Firestore document):
```javascript
session.attendance = { present: ['Name1', 'Name2'], savedAt: 'HH:MM' }
```

---

## Security Architecture

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /users/{uid} {
      allow read: if request.auth.uid == uid || isAdmin();
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid || isAdmin();
      allow delete: if isAdmin();
    }
    match /users/{uid}/data/{doc} {
      allow read, write: if request.auth.uid == uid;
      allow read: if isAdmin();
    }
  }
}
```

**Note**: Admins can READ another coach's data subcollection but not write it. Admin "View" mode is read-only for saves; in-memory edits still work but will not persist to the viewed coach's Firestore.

### What's Implemented

| Mechanism | Where in code |
|---|---|
| Firebase Auth (email + password) | `submitAuth()` |
| Per-user Firestore data isolation | Firestore rules + `activeUid()` |
| Authorization guard | `requireAuth()` — called at top of sensitive functions |
| HTML injection prevention (XSS) | `escH()` — applied to all user-supplied values in `innerHTML` |
| Global error handler | `window.onerror` / `window.onunhandledrejection` |
| Activity logging | `logActivity()` — visible in admin Settings panel |
| Removed user check | `onAuthStateChanged` checks `removed` flag — blocks login |

### What is N/A

- **CORS**: Not applicable — single-origin static file, no custom API.
- **Server-side rate limiting**: Firebase Auth has built-in brute-force protection.
- **Password hashing**: Handled by Firebase Auth internally. The old FNV-1a `hashPwd()` is removed.
- **Session TTL**: Managed by Firebase Auth. No manual TTL check needed.
- **Database indexes**: Not applicable — Firestore queries are simple per-user reads.

### XSS Prevention — `escH()` vs `escQ()`

- **`escH(s)`** — HTML-escapes `& < > "`. Use for any user-supplied string going into an `innerHTML` template.
- **`escQ(s)`** — Escapes single-quotes and backslashes. Use for strings going into `onclick="..."` attribute values.
- When you add new `innerHTML` template code with user-supplied data, always wrap with `escH()`.

---

## Key Functions

| Function | Description |
|---|---|
| `saveUD(key, val)` | Fire-and-forget Firestore write to `/users/{activeUid()}/data/{key}` |
| `loadUserState()` | **async** — loads all 5 data docs in parallel via `Promise.all` |
| `activeUid()` | Returns `viewingUserId || currentUser?.id` — admin view override |
| `auth.onAuthStateChanged` | Startup entry point — fires on page load and on login/logout |
| `submitAuth()` | **async** — handles login and registration via Firebase Auth |
| `renderAdminPanel()` | **async** — reads all users from Firestore |
| `adminView(userId)` | **async** — sets `viewingUserId`, loads coach's data |
| `adminExitView()` | **async** — clears `viewingUserId`, reloads own data |

---

## Rollback Strategy

**Git / GitHub Desktop** is the rollback mechanism for code changes.

- Revert commits in GitHub Desktop to restore a previous version of `index.html`.
- User data is in **Firestore** (not git). To recover data, use the Firebase Console or the in-app Export feature.
- Export/Import JSON is available in Settings — backs up all data keys to a `.json` file.

---

## Security Checklist for Future Changes

When modifying `index.html`, verify:

1. Any new `innerHTML` template with user data uses `escH()` on each user-supplied variable.
2. Any new onclick attribute with user data uses `escQ()` for string parameters.
3. Any new write to user state calls `requireAuth()` first.
4. Any new auth-sensitive function logs to `logActivity()`.
5. Never hardcode credentials, hashes, or secrets in source (repo is public).
6. The `firebaseConfig` API key is safe to be public — it is locked down by Firestore rules and authorized domains.
