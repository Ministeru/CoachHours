# CoachHours — Developer Guide

## Architecture

- **Single-file PWA**: All code lives in `index.html`. No build step, no backend, no server.
- **Storage**: Browser `localStorage` only. All user data is scoped per user via namespaced keys (`ch_history_<userId>`, etc.).
- **Multi-user**: Coaches register via the login screen. Admin can view/manage other coaches from Settings.
- **Offline**: Service worker (`sw.js`) caches the app for offline use.
- **Deployment**: GitHub Pages (public repo). No server-side code.

---

## Security Architecture

### What's Implemented

| Mechanism | Where in code |
|---|---|
| Password hash (FNV-1a + salt) | `hashPwd()` ~line 500 |
| First-run setup (no hardcoded credentials) | `submitFirstRun()` |
| Change password form | `changePassword()` in Settings |
| Login rate limiting (5 attempts → 60s lockout) | `loginAttempts`/`loginLockedUntil` in `submitAuth()` |
| Session expiry (24h) | `SESSION_TTL` check at startup |
| Authorization guard | `requireAuth()` — called at top of sensitive functions |
| HTML injection prevention (XSS) | `escH()` — applied to all user-supplied values in `innerHTML` |
| Input length validation | `submitAuth()`, `submitFirstRun()`, `changePassword()` |
| localStorage try/catch | `getUD()` / `setUD()` |
| Global error handler | `window.onerror` / `window.onunhandledrejection` |
| Activity logging | `logActivity()` — visible in admin Settings panel |

### What is N/A (No Backend)

- **CORS**: Not applicable — single-origin static file, no API.
- **Server-side rate limiting**: Not applicable — no server. Client-side throttle is implemented instead.
- **Password reset links with expiry**: Not applicable — no email/server. Users reset passwords via the "Change Password" form in Settings. Admin can remove and re-register a user if needed.
- **Database indexes**: Not applicable — data is in localStorage (flat JSON).
- **HTTPS enforcement**: Enforced by GitHub Pages automatically on the custom domain.

### Password Security Notes

- FNV-1a 32-bit hash with app salt is **not cryptographically secure**. It is suitable for a personal tool where the threat model is casual access, not determined attackers.
- Passwords are stored **only in localStorage** — never in source code. The old `ADMIN_HASH` constant was removed because the repo is public.
- To reset a user's password: they use the "Change Password" form in Settings (requires knowing the old password). For a locked-out admin: manually delete `ch_auth_users` from localStorage via DevTools, then reload — the first-run setup screen will appear.

### XSS Prevention — `escH()` vs `escQ()`

- **`escH(s)`** — HTML-escapes `& < > "`. Use for any user-supplied string going into an `innerHTML` template.
- **`escQ(s)`** — Escapes single-quotes and backslashes. Use for strings going into `onclick="..."` attribute values (e.g., `onclick="removePlayer('${escQ(name)}')`).
- When you add new `innerHTML` template code with user-supplied data, always wrap with `escH()`.

---

## Rollback Strategy

**Git / GitHub Desktop** is the rollback mechanism for code changes.

- Revert commits in GitHub Desktop to restore a previous version of `index.html`.
- User data (in `localStorage`) is **not** stored in git — it lives only in the user's browser. There is no server-side backup of user data.
- For a full restore of user data: users can manually export `localStorage` via DevTools if needed.

---

## Security Checklist for Future Changes

When modifying `index.html`, verify:

1. Any new `innerHTML` template with user data uses `escH()` on each user-supplied variable.
2. Any new onclick attribute with user data uses `escQ()` for string parameters.
3. Any new write to user state calls `requireAuth()` first.
4. Any new auth-sensitive function logs to `logActivity()`.
5. Never hardcode credentials, hashes, or secrets in source (repo is public).

---

## Data Model

```
localStorage keys:
  ch_auth_users          — [{id, username, passwordHash, role, createdAt}]
  ch_session             — {id, username, role, loginTime}
  ch_history_<uid>       — [{dateStr, bossName, sessions, totalMins, totalEarned, msg, ts}]
  ch_deleted_<uid>       — same shape as history (soft-deleted items)
  ch_settings_<uid>      — {ratePrivate, rateGroup, groupKeywords[], privateKeywords[]}
  ch_received_<uid>      — {YYYY-MM: number}  (monthly salary received)
  ch_groups_<uid>        — {id: {id, name, players[]}}
  ch_attendance_<uid>    — (legacy, attendance now stored on session objects)
```

Session attendance is stored directly on each session object:
```javascript
session.attendance = { present: ['Name1', 'Name2'], savedAt: 'HH:MM' }
```
