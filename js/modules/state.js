// ─── STATE ────────────────────────────────────────────────
let currentUser    = null;   // { id, username, role }
let viewingUserId  = null;   // admin "view-as" override
let registering    = false;

let sessions       = [];     // real-time from /sessions/
let groups         = {};     // { id: { id, name, players } }
let players        = {};     // { id: { id, name } } — individual private players
let allCoaches     = [];     // cached for session-assignment dropdown
let settings       = { ratePrivate: 80, rateGroup: 50 };

let sessionsUnsub  = null;
let groupsUnsub    = null;
let playersUnsub   = null;

let calView = 'month';
let calDate = new Date();
