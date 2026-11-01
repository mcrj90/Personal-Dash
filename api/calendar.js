import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const $ = (id) => document.getElementById(id);
const money = d3.format('$,.2f'), pct1 = d3.format('.1%'), pct2 = d3.format('.2%'), num = d3.format(',.0f'), dec1 = d3.format(',.1f');
const dayFmt = d3.utcFormat('%a, %b %-d'), monFmt = d3.utcFormat('%b %Y'), shortDay = d3.utcFormat('%a'), isoU = d3.utcFormat('%Y-%m-%d');
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayIso = () => isoLocal(new Date());
const addDaysIso = (iso, k) => isoU(new Date(Date.parse(iso + 'T00:00:00Z') + k * 864e5));
const uDate = (iso) => new Date(iso + 'T00:00:00Z');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Quotes (not personal data) ----------
const VERSES = [
  ['Psalm 46:5', 'God is in the midst of her; she shall not be moved: God shall help her, and that right early.'],
  ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Psalm 30:5', 'Weeping may endure for a night, but joy cometh in the morning.'],
  ['Proverbs 3:5-6', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'],
  ['Joshua 1:9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
  ['Psalm 121:1-2', 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'],
  ['Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Psalm 37:5', 'Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.'],
  ['Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
  ['Nehemiah 8:10', 'The joy of the LORD is your strength.']
];
const THOUGHTS = [
  ['Eleanor Roosevelt (attributed)', 'You must do the thing you think you cannot do.'],
  ['Japanese proverb', 'Fall seven times, stand up eight.'],
  ['Lao Tzu', 'A journey of a thousand miles begins with a single step.'],
  ['Benjamin Franklin', 'Well done is better than well said.'],
  ['Louisa May Alcott', 'I am not afraid of storms, for I am learning how to sail my ship.'],
  ['Arthur Ashe (attributed)', 'Start where you are. Use what you have. Do what you can.'],
  ['Maya Angelou (attributed)', 'Nothing will work unless you do.'],
  ['Theodore Roosevelt (attributed)', 'Do what you can, with what you have, where you are.'],
  ['Steve Jobs', 'The only way to do great work is to love what you do.'],
  ['Henry Ford (attributed)', 'Whether you think you can, or you think you can’t, you’re right.'],
  ['Nelson Mandela (attributed)', 'It always seems impossible until it’s done.'],
  ['Eleanor Roosevelt (attributed)', 'No one can make you feel inferior without your consent.']
];

// ---------- State ----------
const EMPTY = () => ({
  version: 1,
  settings: { tracking_start: todayIso(), paycheck: 0, savings_pct: 0, hys_apy: 0, hys_deposit: 0, hys_goal: 0, hys_goal_date: '2031-08-31', emergency_goal: 0, debt_baseline: 0, weight_start: 0, weight_target: 0, workout_goal: 5, bible_goal: 6, book_goal: 4 },
  savings: [], debts: [], plans: [], books: [], supplements: [],
  workouts: [], weights: [], tasks: [], steps: {}, calendar: [], sidebar: ''
});
let state = null, docRef = null, auth = null, saveTimer = null, ready = false;
const LISTS = ['My day', 'Graphic design', 'To-do'];
const NAV = [['today', 'Today'], ['faith', 'Faith and reading'], ['goals', 'Goals'], ['money', 'Money'], ['health', 'Health'], ['work', 'Work'], ['settings', 'Settings']];
const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  faith: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M12 7v6M9 10h6"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  money: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4"/><circle cx="17" cy="13.5" r="1"/>',
  health: '<path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const COLORS = { R: 'linear-gradient(135deg,#ff5468,#8f1d2c)', S: 'linear-gradient(135deg,#e6e8ec,#7c8190)', D: 'linear-gradient(135deg,#8f1d2c,#3a0f16)' };

// ---------- DOM helpers (text only, never HTML) ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v; else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
const svgIcon = (p, extra) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (extra) for (const [k, v] of Object.entries(extra)) s.setAttribute(k, v); s.innerHTML = p; return s; };
const card = (color, title, note, ...body) => h('div', { class: 'lx-card' }, h('div', { class: 'lx-cardhead' }, h('div', { class: 'lx-icon', style: 'background:' + color }), h('div', {}, h('h3', {}, title), note ? h('p', { class: 'lx-note' }, note) : null)), ...body);
const bar = (p) => h('div', { class: 'lx-bar' }, h('i', { style: 'width:' + Math.round(Math.max(0, Math.min(1, p || 0)) * 100) + '%' }));
function table(cols, rows, fmts, labels) {
  const t = h('table', {}, h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, (labels && labels[c]) || c)))));
  const tb = h('tbody', {});
  rows.forEach((r) => tb.append(h('tr', {}, cols.map((c) => { const v = r[c]; return h('td', {}, v == null ? '' : fmts && fmts[c] ? fmts[c](v) : String(v)); }))));
  t.append(tb); return t;
}

// ---------- Saving ----------
function setStatus(t) { const s = $('lx-save'); if (s) s.textContent = t; const f = $('lx-foot'); if (f) f.textContent = t; }
function save() {
  if (!docRef) return;
  clearTimeout(saveTimer);
  setStatus('Saving…');
  saveTimer = setTimeout(() => {
    setDoc(docRef, state).then(() => setStatus('Saved ❤️'), () => setStatus('Couldn’t save yet. It will sync when you’re back online.'));
  }, 350);
}
const change = () => { save(); render(); };

// ---------- Calculations ----------
const S = () => state.settings;
const totalOf = (a) => a.reduce((t, r) => t + (Number(r.balance) || 0), 0);
function planDone(p) { return new Set((p.done || []).filter((d) => d >= 1 && d <= p.total)).size; }
function weekDays() { const n = new Date(), t = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); const sun = t - new Date(t).getUTCDay() * 864e5; return d3.range(7).map((i) => new Date(sun + i * 864e5)); }
const latestWeight = () => (state.weights.length ? state.weights[state.weights.length - 1].lb : S().weight_start);
function hysPlan() {
  const s = S(), hys = state.savings.find((r) => /hys/i.test(r.account));
  if (!hys || !s.hys_goal) return null;
  const r = Math.pow(1 + (s.hys_apy || 0), 1 / 12) - 1;
  const ts = s.tracking_start, start = Number(ts.slice(0, 4)) * 12 + Number(ts.slice(5, 7)) - 1;
  const gy = Number(s.hys_goal_date.slice(0, 4)), endM = gy * 12 + Number(s.hys_goal_date.slice(5, 7)) - 1;
  const n = endM - start + 1; if (n < 1) return null;
  const bal = Number(hys.balance) || 0, g = Math.pow(1 + r, n);
  const needed = r === 0 ? (s.hys_goal - bal) / n : (s.hys_goal - bal * g) / (((g - 1) / r) * (1 + r));
  const sim = (p, k) => { let b = bal; for (let i = 0; i < k; i++) b = (b + p) * (1 + r); return b; };
  const rows = [];
  for (let y = Number(ts.slice(0, 4)) + 1; y <= gy; y++) { const k = y * 12 + 7 - start + 1; rows.push({ date: y + '-08-31', plan_balance: sim(needed, k), at_current: sim(s.hys_deposit || 0, k) }); }
  return { needed, rounded: Math.ceil(needed), rows };
}
function goalRows() {
  const s = S(), saved = totalOf(state.savings), debt = totalOf(state.debts);
  const wk = weekDays().filter((d) => state.workouts.includes(isoU(d))).length;
  const rows = [
    { label: 'Bible plans finished', kind: 'count', done: state.plans.filter((p) => planDone(p) >= p.total).length, goal: s.bible_goal },
    { label: 'Books finished', kind: 'count', done: state.books.filter((b) => b.status === 'Finished').length, goal: s.book_goal },
    { label: 'Debt paid off', kind: 'money', done: Math.max(0, s.debt_baseline - debt), goal: s.debt_baseline },
    { label: 'Emergency fund', kind: 'money', done: saved, goal: s.emergency_goal },
    { label: 'Pounds lost', kind: 'count', done: Math.max(0, s.weight_start - latestWeight()), goal: s.weight_start - s.weight_target },
    { label: 'Workouts this week', kind: 'count', done: wk, goal: s.workout_goal }
  ];
  return rows.map((r) => ({ ...r, pct: r.goal > 0 ? Math.min(r.done / r.goal, 1) : 0 }));
}

// ---------- Calendar import (.ics) ----------
const unesc = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
function parseDT(val, params) {
  if (/^\d{8}$/.test(val)) return { d: new Date(+val.slice(0, 4), +val.slice(4, 6) - 1, +val.slice(6, 8)), allDay: true };
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/); if (!m) return null;
  const [, y, mo, da, hh, mi, ss, z] = m;
  return { d: z ? new Date(Date.UTC(+y, +mo - 1, +da, +hh, +mi, +ss)) : new Date(+y, +mo - 1, +da, +hh, +mi, +ss), allDay: false };
}
function parseICS(text, days) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const evs = []; let ev = null;
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') ev = {}; else if (ln === 'END:VEVENT') { if (ev && ev.start) evs.push(ev); ev = null; }
    else if (ev) {
      const i = ln.indexOf(':'); if (i < 0) continue;
      const left = ln.slice(0, i), val = ln.slice(i + 1), name = left.split(';')[0], params = left.split(';').slice(1).join(';');
      if (name === 'SUMMARY') ev.title = unesc(val); else if (name === 'LOCATION') ev.location = unesc(val).split('\n')[0];
      else if (name === 'DTSTART') ev.start = parseDT(val, params); else if (name === 'RRULE') ev.rrule = val;
      else if (name === 'EXDATE') (ev.ex = ev.ex || []).push(...val.split(',').map((v) => parseDT(v, params)).filter(Boolean).map((x) => isoLocal(x.d)));
    }
  }
  const w0 = new Date(); w0.setHours(0, 0, 0, 0);
  const w1 = new Date(w0.getTime() + days * 864e5);
  const out = [];
  const fmtT = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const push = (e, d) => out.push({ t: d.getTime(), title: e.title || '(No title)', date: isoLocal(d), start: e.start.allDay ? 'All day' : fmtT(d), location: e.location || '' });
  for (const e of evs) {
    const s0 = e.start.d;
    if (!e.rrule) { if (s0 >= w0 && s0 < w1) push(e, s0); continue; }
    const rule = Object.fromEntries(e.rrule.split(';').map((p) => p.split('=')));
    const freq = rule.FREQ, itv = Number(rule.INTERVAL || 1), cnt = rule.COUNT ? Number(rule.COUNT) : Infinity;
    let until = null; if (rule.UNTIL) { const u = parseDT(rule.UNTIL.length === 8 ? rule.UNTIL : rule.UNTIL, ''); until = u ? u.d : null; }
    const byday = rule.BYDAY ? rule.BYDAY.split(',').map((x) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(x.slice(-2))) : [s0.getDay()];
    const dayStart = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate());
    let n = 0;
    for (let d = new Date(dayStart); d < w1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const diff = Math.round((d - dayStart) / 864e5);
      let hit = false;
      if (freq === 'DAILY') hit = diff % itv === 0;
      else if (freq === 'WEEKLY') { const wk = Math.floor((diff + dayStart.getDay()) / 7); hit = byday.includes(d.getDay()) && wk % itv === 0; }
      else if (freq === 'MONTHLY') hit = d.getDate() === s0.getDate() && ((d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth()) % itv === 0;
      else if (freq === 'YEARLY') hit = d.getDate() === s0.getDate() && d.getMonth() === s0.getMonth();
      if (!hit) continue;
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s0.getHours(), s0.getMinutes());
      if (until && at > until) break;
      if (++n > cnt) break;
      if ((e.ex || []).includes(isoLocal(at))) continue;
      if (at >= w0) push(e, at);
    }
  }
  return out.sort((a, b) => a.t - b.t).map(({ t, ...r }) => r).slice(0, 60);
}


// ---------- Automatic calendar refresh (via /api/calendar) ----------
let lastCal = null, calMsg = '';
async function refreshCalendar() {
  if (!auth || !auth.currentUser || !state) return;
  try {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch('/api/calendar', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (!r.ok) {
      let why = ''; try { why = (await r.json()).error || ''; } catch (e) { /* not JSON */ }
      calMsg = r.status === 404 ? 'The calendar function isn’t on your site yet (no api folder).' : 'Calendar update failed (' + r.status + '): ' + (why || 'unknown reason');
      render(); return;
    }
    const ev = parseICS(await r.text(), 14);
    calMsg = '';
    lastCal = new Date();
    if (JSON.stringify(ev) !== JSON.stringify(state.calendar)) { state.calendar = ev; change(); } else render();
  } catch (e) { calMsg = 'Calendar update failed: could not reach the calendar function.'; render(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshCalendar(); });
setInterval(refreshCalendar, 15 * 60 * 1000);

// ---------- Pieces ----------
function taskPill(due, done) {
  if (!due) return null; const t = todayIso(); let label, late = false;
  if (due < t) { label = done ? 'Was due ' + d3.utcFormat('%b %-d')(uDate(due)) : 'Overdue'; late = !done; }
  else if (due === t) label = 'Due today'; else if (due === addDaysIso(t, 1)) label = 'Due tomorrow'; else label = 'Due ' + d3.utcFormat('%b %-d')(uDate(due));
  return h('span', { class: 'lx-pill' + (late ? ' late' : '') }, label);
}
function taskList(list) {
  const items = state.tasks.filter((t) => t.list === list).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
  if (!items.length) return h('span', { class: 'lx-empty' }, 'Nothing here yet. Add something on the Today page.');
  return h('div', {}, items.map((t) => h('div', { class: 'lx-task', 'data-done': t.done ? 'true' : 'false' },
    h('button', { type: 'button', class: 'lx-circle', 'aria-pressed': t.done ? 'true' : 'false', 'aria-label': 'Mark done', on: { click: () => { t.done = !t.done; change(); } } }),
    h('span', { class: 'lx-task-text' }, t.text), taskPill(t.due, t.done),
    h('button', { type: 'button', class: 'lx-link', on: { click: () => { state.tasks = state.tasks.filter((x) => x.id !== t.id); change(); } } }, 'Remove'))));
}
function addBar() {
  const txt = h('input', { type: 'text', placeholder: 'Add something for today, a follow-up, a design task, or a to-do…', 'aria-label': 'New task' });
  const sel = h('select', { 'aria-label': 'List' }, LISTS.map((l) => h('option', { value: l }, l)));
  const date = h('input', { type: 'date', 'aria-label': 'Due date' });
  const add = () => { const t = txt.value.trim(); if (!t) return; state.tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t.slice(0, 200), list: sel.value, due: date.value || '', done: false }); change(); };
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'lx-addbar', role: 'group', 'aria-label': 'Add a task' }, txt, sel, date, h('button', { type: 'button', class: 'lx-btn', on: { click: add } }, 'Add'));
}
function heartBtn(on, label, click, disabled) { return h('button', { type: 'button', class: 'lx-heart', 'aria-pressed': on ? 'true' : 'false', 'aria-label': label, disabled: disabled || false, on: click ? { click } : {} }, on ? '♥' : '♡'); }

function pToday() {
  const dq = Math.floor((Date.now() - Date.UTC(2026, 0, 0)) / 864e5);
  const v = VERSES[dq % VERSES.length], q = THOUGHTS[(dq * 5 + 3) % THOUGHTS.length];
  const t = todayIso(), tm = addDaysIso(t, 1);
  const open = state.tasks.filter((x) => !x.done);
  const soon = open.filter((x) => x.due && x.due <= tm).length + state.calendar.filter((e) => e.date === t || e.date === tm).length;
  const wk = weekDays().filter((d) => state.workouts.includes(isoU(d))).length;
  const stat = (n, l) => h('div', { class: 'lx-stat' }, h('b', {}, String(n)), h('span', {}, l));
  const cal = state.calendar.filter((e) => e.date >= t);
  const file = h('input', { type: 'file', accept: '.ics,text/calendar', hidden: true, on: { change: async (e) => { const f = e.target.files[0]; if (!f) return; try { state.calendar = parseICS(await f.text(), 14); change(); } catch (err) { setStatus('Couldn’t read that calendar file.'); } } } });
  const sup = state.supplements;
  return h('section', { class: 'lx-panel', id: 'today', 'aria-label': 'Today' },
    h('div', { class: 'lx-hero' },
      h('div', { class: 'lx-quotes' },
        h('div', { class: 'lx-q' }, h('span', { class: 'lx-kicker' }, 'Today’s thought'), h('p', { class: 'lx-quote' }, q[1]), h('span', { class: 'lx-ref' }, q[0])),
        h('div', { class: 'lx-q lx-rule' }, h('span', { class: 'lx-kicker' }, 'Verse of the day'), h('p', { class: 'lx-quote' }, v[1]), h('span', { class: 'lx-ref' }, v[0] + ' (KJV)'))),
      h('div', { class: 'lx-stats' }, stat(soon, 'Due soon'), stat(open.length, 'Open'), stat(wk, 'Workouts'))),
    h('p', { class: 'lx-sub', style: 'margin-top:16px' }, soon === 0 ? 'Nothing is due today or tomorrow.' : soon + (soon === 1 ? ' thing is' : ' things are') + ' due today or tomorrow.'),
    addBar(),
    h('div', { class: 'lx-grid' },
      card(COLORS.R, 'My day', 'Things you’re planning to get to', taskList('My day')),
      h('div', { style: 'display:grid;gap:16px' },
        card(COLORS.S, 'This week', calMsg ? calMsg : lastCal ? 'From your Apple calendar, updated ' + lastCal.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'From your Apple calendar',
          cal.length ? h('div', {}, cal.map((e) => h('div', { class: 'lx-item' }, h('span', { class: 'lx-muted' }, dayFmt(uDate(e.date))), h('span', {}, e.start), h('span', {}, e.title), e.location ? h('span', { class: 'lx-muted' }, e.location) : null))) : h('span', { class: 'lx-empty' }, 'Nothing scheduled. Import your calendar below.'),
          h('div', { class: 'lx-actions' }, h('button', { type: 'button', class: 'lx-btn ghost', on: { click: () => file.click() } }, 'Import calendar (.ics)'), file)),
        card(COLORS.D, 'Supplements', 'Common guidance; follow product labels', sup.length ? table(['item', 'time', 'how'], sup) : h('span', { class: 'lx-empty' }, 'Add them under Settings.')))));
}
function pFaith() {
  return h('section', { class: 'lx-panel', id: 'faith', 'aria-label': 'Faith and reading', hidden: true }, h('div', { class: 'lx-grid' },
    card(COLORS.R, 'Bible plans', 'Tap a heart when you finish that day',
      state.plans.length ? h('div', {}, state.plans.map((p) => {
        const n = planDone(p), done = new Set(p.done || []);
        return h('div', { class: 'lx-row' }, h('div', { class: 'lx-rowhead' }, h('span', {}, p.plan), h('span', { class: 'lx-muted' }, n === 0 ? 'Not started' : 'Day ' + n + ' of ' + p.total + ' · ' + pct1(n / p.total))), bar(n / p.total),
          h('div', { class: 'lx-days' }, d3.range(1, p.total + 1).map((d) => heartBtn(done.has(d), 'Day ' + d, () => { const s = new Set(p.done || []); if (s.has(d)) s.delete(d); else s.add(d); p.done = [...s].sort((a, b) => a - b); change(); }))));
      })) : h('span', { class: 'lx-empty' }, 'Import your data under Settings.'), h('div', { class: 'lx-save', id: 'lx-save', role: 'status' })),
    card(COLORS.S, 'Books (Kindle)', 'What you’ve finished and what’s next', state.books.length ? table(['title', 'status', 'finished', 'pages'], state.books) : h('span', { class: 'lx-empty' }, 'Nothing yet.'))));
}
function pGoals() {
  const rows = goalRows();
  return h('section', { class: 'lx-panel', id: 'goals', 'aria-label': 'Goals', hidden: true }, card(COLORS.R, 'Goals and milestones', 'Quarterly and ongoing', h('div', {}, rows.map((g) => {
    const f = g.kind === 'money' ? money : (v) => (Number.isInteger(v) ? num(v) : dec1(v));
    return h('div', { class: 'lx-row' }, h('div', { class: 'lx-rowhead' }, h('span', {}, g.label), h('span', { class: 'lx-muted' }, f(g.done) + ' of ' + f(g.goal))), bar(g.pct));
  }))));
}
function pMoney() {
  const s = S(), g = goalRows(), hp = hysPlan(), saved = totalOf(state.savings), debt = totalOf(state.debts);
  const monthly = (s.paycheck * s.savings_pct * 26) / 12 + (s.hys_deposit || 0), left = Math.max(s.emergency_goal - saved, 0);
  const gm = monthly > 0 && s.emergency_goal ? new Date(Date.now() + (left / monthly) * 30.4375 * 864e5) : null;
  const tile = (cap, v) => h('div', { class: 'lx-tile lx-card' }, h('span', { class: 'lx-cap' }, cap), h('span', { class: 'lx-big' }, v));
  return h('section', { class: 'lx-panel', id: 'money', 'aria-label': 'Money', hidden: true },
    h('div', { class: 'lx-tiles' }, tile('Total saved', money(saved)), tile('Emergency fund', pct1(g[3].pct)), tile('Total debt', money(debt)), tile('Debt paid since start', money(g[2].done)), tile('HYS deposit to hit goal', hp ? money(hp.needed) : '—'), tile('Weight (lb)', state.weights.length || s.weight_start ? dec1(latestWeight()) : '—')),
    h('div', { class: 'lx-grid' },
      card(COLORS.R, 'HYS goal plan', null,
        hp ? h('p', { class: 'lx-note' }, 'Goal ' + money(s.hys_goal) + ' by ' + d3.utcFormat('%b %Y')(uDate(s.hys_goal_date)) + ' at ' + pct2(s.hys_apy) + ' APY. Deposit about ' + money(hp.needed) + ' a month (round up to ' + money(hp.rounded) + '). Your current ' + money(s.hys_deposit) + ' a month would reach ' + money(hp.rows[hp.rows.length - 1].at_current) + '.') : h('p', { class: 'lx-note' }, 'Add a Synchrony HYS account and a goal under Settings.'),
        h('div', { class: 'lx-chart', id: 'lx-hys-chart' }), hp ? table(['date', 'plan_balance', 'at_current'], hp.rows, { plan_balance: money, at_current: money }, { date: 'By', plan_balance: 'On plan', at_current: 'At current deposit' }) : null),
      card(COLORS.S, 'Savings accounts', gm ? 'Left to reach the emergency fund goal: ' + money(left) + '. At your current pace (about ' + money(monthly) + ' a month) that’s around ' + monFmt(gm) + '.' : null,
        state.savings.length ? h('div', {}, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Account'), h('th', {}, 'Balance'))), h('tbody', {}, state.savings.map((r) => h('tr', {}, h('td', {}, r.account), h('td', {}, h('input', { class: 'lx-bal', type: 'number', step: '0.01', value: String(r.balance), 'aria-label': r.account + ' balance', on: { change: (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { r.balance = v; change(); } } } })))))), h('div', { class: 'lx-item' }, 'Total saved: ' + money(saved))) : h('span', { class: 'lx-empty' }, 'Import your data under Settings.'))),
    h('div', { class: 'lx-grid', style: 'margin-top:16px' },
      card(COLORS.D, 'Debt balances', 'Avalanche order: highest APR first', h('div', { class: 'lx-chart', id: 'lx-debt-chart', style: 'min-height:380px' })),
      card(COLORS.R, 'Debt details', null, state.debts.length ? h('div', { class: 'lx-scroll' }, table(['order', 'account', 'balance', 'apr'], state.debts, { balance: money, apr: pct2 })) : h('span', { class: 'lx-empty' }, 'Import your data under Settings.'))));
}
function pHealth() {
  const s = S(), days = weekDays(), n = days.filter((d) => state.workouts.includes(isoU(d))).length, goal = s.workout_goal || 5;
  const now = latestWeight(), lost = Math.max(0, s.weight_start - now), wg = s.weight_start - s.weight_target;
  const inp = h('input', { class: 'lx-in', type: 'number', step: '0.1', placeholder: 'lb', 'aria-label': 'Weigh-in in pounds' });
  const st = h('input', { class: 'lx-in', type: 'number', step: '1', placeholder: 'steps', 'aria-label': 'Steps today' });
  const steps = state.steps || (state.steps = {});
  const recent = d3.range(6, -1, -1).map((i) => addDaysIso(todayIso(), -i));
  return h('section', { class: 'lx-panel', id: 'health', 'aria-label': 'Health', hidden: true }, h('div', { class: 'lx-grid' },
    card(COLORS.D, 'Workouts this week', 'Tap a heart for each day (Sunday to Saturday)', h('div', { class: 'lx-rowhead' }, h('span', {}, n + ' of ' + goal + ' done')), bar(n / goal),
      h('div', { class: 'lx-wk' }, days.map((d) => h('div', {}, heartBtn(state.workouts.includes(isoU(d)), dayFmt(d), () => { const k = isoU(d), set = new Set(state.workouts); if (set.has(k)) set.delete(k); else set.add(k); state.workouts = [...set].sort().slice(-90); change(); }), shortDay(d))))),
    card(COLORS.R, 'Weight', 'Weigh in Sunday mornings', h('div', { class: 'lx-rowhead' }, h('span', {}, 'Now ' + dec1(now) + ' lb'), h('span', { class: 'lx-muted' }, 'Goal ' + num(s.weight_target) + ' lb')), bar(wg > 0 ? lost / wg : 0), h('p', { class: 'lx-note', style: 'margin-top:8px' }, 'Lost ' + dec1(lost) + ' of ' + dec1(wg) + ' lb'),
      h('div', { class: 'lx-item' }, inp, h('button', { type: 'button', class: 'lx-btn', on: { click: () => { const v = parseFloat(inp.value); if (!(v > 50 && v < 600)) return; state.weights.push({ date: todayIso(), lb: Math.round(v * 10) / 10 }); state.weights = state.weights.slice(-120); change(); } } }, 'Log weigh-in')),
      state.weights.slice(-4).reverse().map((w) => h('div', { class: 'lx-muted' }, dayFmt(uDate(w.date)) + ': ' + dec1(w.lb) + ' lb'))),
    card(COLORS.S, 'Daily steps', 'Type today’s count from your phone’s Health app',
      h('div', { class: 'lx-item' }, st, h('button', { type: 'button', class: 'lx-btn', on: { click: () => { const v = parseInt(st.value, 10); if (!(v >= 0 && v < 200000)) return; steps[todayIso()] = v; change(); } } }, 'Log steps')),
      recent.map((d) => h('div', { class: 'lx-muted' }, dayFmt(uDate(d)) + ': ' + (steps[d] != null ? num(steps[d]) : '—')))),
    card(COLORS.R, 'Weekly self-care', 'One thing for you each week', h('span', { class: 'lx-empty' }, 'Pick two or three ideas and add them as to-dos on the Work page.'))));
}
function pWork() { return h('section', { class: 'lx-panel', id: 'work', 'aria-label': 'Work', hidden: true }, h('div', { class: 'lx-grid' }, card(COLORS.S, 'Graphic design', 'Client work and creative tasks', taskList('Graphic design')), card(COLORS.D, 'To-do', 'Everything else on your plate', taskList('To-do')))); }
function pSettings() {
  const ta = h('textarea', { class: 'lx-json', spellcheck: 'false', 'aria-label': 'Your data as JSON' }); ta.value = JSON.stringify(state, null, 2);
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); state = Object.assign(EMPTY(), d); change(); setStatus('Imported ❤️'); } catch (err) { setStatus('That file isn’t valid JSON.'); } } } });
  const dl = () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })), download: 'my-life-backup-' + todayIso() + '.json' }); document.body.append(a); a.click(); a.remove(); };
  return h('section', { class: 'lx-panel', id: 'settings', 'aria-label': 'Settings', hidden: true }, h('div', { class: 'lx-grid' },
    card(COLORS.R, 'Your data', 'Back it up, restore it, or move it to a new account',
      h('div', { class: 'lx-actions' }, h('button', { type: 'button', class: 'lx-btn', on: { click: dl } }, 'Download backup'), h('button', { type: 'button', class: 'lx-btn ghost', on: { click: () => file.click() } }, 'Import data file'), file),
      h('p', { class: 'lx-note' }, 'Your data syncs between your phone and computer and works offline. A backup file is a good habit before big changes.')),
    card(COLORS.S, 'Account', null, h('div', { class: 'lx-actions' }, h('button', { type: 'button', class: 'lx-btn ghost', on: { click: () => signOut(auth) } }, 'Sign out'))),
    card(COLORS.D, 'Edit data (advanced)', 'Balances, debts, plans, books, supplements and goals live here as JSON', ta, h('div', { class: 'lx-actions' }, h('button', { type: 'button', class: 'lx-btn', on: { click: () => { try { state = Object.assign(EMPTY(), JSON.parse(ta.value)); change(); setStatus('Saved ❤️'); } catch (e) { setStatus('That isn’t valid JSON. Nothing was changed.'); } } } }, 'Save changes')))));
}

// ---------- Charts ----------
const C = { red: '#ff5468', silver: '#c4c8cf', mute: '#5c6070', grid: 'rgba(196,200,207,.12)', text: '#b4b8c2' };
function tipFor(host) { let t = host.querySelector('.lx-tip'); if (!t) { t = h('div', { class: 'lx-tip' }); host.append(t); } return t; }
function showTip(host, t, x, y, lines) { t.replaceChildren(...lines.flatMap((l, i) => [h('span', { class: i === 0 ? 'lx-tip-h' : '' }, l), h('br')]).slice(0, -1)); t.style.opacity = '1'; const w = host.clientWidth, tw = t.offsetWidth; t.style.left = Math.max(4, Math.min(w - tw - 4, x + 12)) + 'px'; t.style.top = Math.max(0, y - 8) + 'px'; }
function drawHys() {
  const host = $('lx-hys-chart'); if (!host || host.closest('[hidden]')) return; host.querySelector('svg')?.remove();
  const hp = hysPlan(); if (!hp) return;
  const rows = hp.rows.map((r) => ({ t: uDate(r.date), plan: r.plan_balance, cur: r.at_current })); if (!rows.length) return;
  const W = host.clientWidth || 520, H = 230, m = { t: 14, r: 92, b: 28, l: 54 };
  const x = d3.scaleUtc([rows[0].t, rows[rows.length - 1].t], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(r.plan, r.cur)) * 1.08], [H - m.b, m.t]).nice();
  const svg = d3.select(host).insert('svg', ':first-child').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Savings balance by August: on the plan versus the current deposit');
  svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).attr('stroke', C.grid);
  svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').attr('fill', C.text).attr('font-size', 11).text((v) => d3.format('$,.0f')(v));
  svg.append('g').selectAll('text').data(rows).join('text').attr('x', (r) => x(r.t)).attr('y', H - 8).attr('text-anchor', 'middle').attr('fill', C.text).attr('font-size', 11).text((r) => d3.utcFormat("%b '%y")(r.t));
  const line = (k) => d3.line().x((r) => x(r.t)).y((r) => y(r[k]))(rows);
  svg.append('path').attr('d', line('cur')).attr('fill', 'none').attr('stroke', C.silver).attr('stroke-width', 2).attr('stroke-dasharray', '5 4').attr('stroke-linecap', 'round');
  svg.append('path').attr('d', line('plan')).attr('fill', 'none').attr('stroke', C.red).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  const last = rows[rows.length - 1];
  svg.append('text').attr('x', x(last.t) + 8).attr('y', y(last.plan)).attr('dy', '0.32em').attr('fill', C.red).attr('font-size', 12).attr('font-weight', 600).text('On plan');
  svg.append('text').attr('x', x(last.t) + 8).attr('y', y(last.cur)).attr('dy', '0.32em').attr('fill', C.silver).attr('font-size', 12).text('Current');
  const dot = svg.append('circle').attr('r', 4.5).attr('fill', C.red).attr('opacity', 0), t = tipFor(host);
  const move = (ev) => { const r = host.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left, k = d3.least(rows, (q) => Math.abs(x(q.t) * (r.width / W) - px)); dot.attr('cx', x(k.t)).attr('cy', y(k.plan)).attr('opacity', 1); showTip(host, t, x(k.t) * (r.width / W), y(k.plan) * (r.width / W), [d3.utcFormat('%B %Y')(k.t), 'On plan: ' + money(k.plan), 'Current deposit: ' + money(k.cur)]); };
  svg.on('mousemove touchstart touchmove', move).on('mouseleave', () => { dot.attr('opacity', 0); t.style.opacity = '0'; });
}
function drawDebt() {
  const host = $('lx-debt-chart'); if (!host || host.closest('[hidden]')) return; host.querySelector('svg')?.remove();
  const rows = state.debts; if (!rows.length) return;
  const W = host.clientWidth || 520, rh = 26, H = rows.length * rh + 6, lw = Math.min(150, W * 0.34), vw = 78;
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.balance)], [0, Math.max(40, W - lw - vw - 8)]);
  const svg = d3.select(host).insert('svg', ':first-child').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Debt balances in avalanche order');
  const g = svg.selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * rh + 3})`), t = tipFor(host);
  g.append('text').attr('x', lw - 8).attr('y', rh / 2).attr('dy', '0.32em').attr('text-anchor', 'end').attr('fill', (r, i) => (i === 0 ? '#f2f2f5' : C.text)).attr('font-size', 12).attr('font-weight', (r, i) => (i === 0 ? 600 : 400)).text((r) => (r.account.length > 20 ? r.account.slice(0, 19) + '…' : r.account));
  g.append('rect').attr('x', lw).attr('y', 4).attr('height', rh - 10).attr('rx', 4).attr('width', (r) => Math.max(2, x(r.balance))).attr('fill', (r, i) => (i === 0 ? C.red : C.mute));
  g.append('text').attr('x', (r) => lw + Math.max(2, x(r.balance)) + 6).attr('y', rh / 2).attr('dy', '0.32em').attr('fill', C.text).attr('font-size', 11).text((r) => d3.format('$,.0f')(r.balance));
  g.append('rect').attr('width', W).attr('height', rh).attr('fill', 'transparent').on('mousemove', (ev, r) => { const b = host.getBoundingClientRect(); showTip(host, t, ev.clientX - b.left, ev.clientY - b.top, [r.account, money(r.balance), pct2(r.apr) + ' APR']); }).on('mouseleave', () => { t.style.opacity = '0'; });
}
const drawCharts = () => { drawHys(); drawDebt(); };

// ---------- Shell, navigation, render ----------
let current = 'today';
function showPanel(id) {
  if (!NAV.some(([k]) => k === id)) id = 'today'; current = id;
  NAV.forEach(([k]) => { const el = $(k); if (el) el.hidden = k !== id; });
  document.querySelectorAll('.lx-nav a').forEach((a) => { if (a.dataset.panel === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const lab = NAV.find(([k]) => k === id); $('lx-pagetitle').textContent = lab ? lab[1] : '';
  drawCharts();
}
function applySidebar() {
  const root = document.querySelector('.lx'); const narrow = root.clientWidth <= 760;
  const collapsed = !narrow && state && state.sidebar === 'collapsed';
  root.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
  const t = $('lx-toggle'); if (t) { t.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); t.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar'); }
}
function shell() {
  const app = $('app'); app.replaceChildren();
  const links = NAV.map(([k, v]) => h('li', {}, h('a', { href: '#' + k, 'data-panel': k, 'data-tip': v, on: { click: (e) => { e.preventDefault(); history.replaceState(null, '', '#' + k); showPanel(k); } } }, svgIcon(ICONS[k]), h('span', { class: 'lx-label' }, v))));
  const toggle = h('button', { type: 'button', class: 'lx-toggle', id: 'lx-toggle', 'aria-expanded': 'true', 'aria-controls': 'lx-nav', 'aria-label': 'Collapse sidebar', on: { click: () => { state.sidebar = document.querySelector('.lx').getAttribute('data-collapsed') === 'true' ? 'open' : 'collapsed'; applySidebar(); save(); setTimeout(drawCharts, 280); } } }, svgIcon('<path d="M15 6l-6 6 6 6"/>', { width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  const nav = h('nav', { class: 'lx-nav', id: 'lx-nav', 'aria-label': 'Sections' }, h('ul', {}, links));
  nav.addEventListener('keydown', (e) => { const as = [...nav.querySelectorAll('a')], i = as.indexOf(document.activeElement); if (i < 0) return; let j = null; if (e.key === 'ArrowDown') j = (i + 1) % as.length; else if (e.key === 'ArrowUp') j = (i - 1 + as.length) % as.length; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = as.length - 1; if (j !== null) { e.preventDefault(); as[j].focus(); } });
  const root = h('div', { class: 'lx', 'data-collapsed': 'false' }, h('a', { class: 'lx-skip', href: '#lx-main' }, 'Skip to content'),
    h('div', { class: 'lx-shell' },
      h('aside', { class: 'lx-side', 'aria-label': 'Dashboard sidebar' }, h('div', { class: 'lx-sidetop' }, h('div', { class: 'lx-brand' }, h('span', { class: 'lx-logo', 'aria-hidden': 'true' }, '♥'), h('span', { class: 'lx-label' }, 'My life')), toggle), nav, h('div', { class: 'lx-sidefoot', id: 'lx-foot' }, 'Synced to your account')),
      h('main', { class: 'lx-content', id: 'lx-main', tabindex: '-1' }, h('div', { class: 'lx-eyebrow', id: 'lx-date' }), h('h1', { id: 'lx-greet' }), h('p', { class: 'lx-pagetitle', id: 'lx-pagetitle' }), h('div', { id: 'lx-panels' }))));
  app.append(root);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { applySidebar(); drawCharts(); }).observe(root);
}
function render() {
  if (!state) return;
  if (!$('lx-panels')) shell();
  const hr = new Date().getHours();
  $('lx-greet').textContent = (hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', Merritt ' + (hr >= 5 && hr < 12 ? '☀️' : hr >= 12 && hr < 17 ? '🌤️' : '🌙');
  $('lx-date').textContent = d3.timeFormat('%A, %B %-d')(new Date()).toUpperCase();
  const keep = document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text';
  if (keep && ready) return; // don't rebuild while typing a task
  const panels = $('lx-panels'); panels.replaceChildren(pToday(), pFaith(), pGoals(), pMoney(), pHealth(), pWork(), pSettings());
  applySidebar();
  const named = (location.hash || '').slice(1); showPanel(ready ? current : NAV.some(([k]) => k === named) ? named : 'today'); ready = true;
}

// ---------- Auth + sync ----------
const missing = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('YOUR');
function start() {
  if (missing) { $('auth').hidden = false; $('setup').hidden = false; return; }
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  const err = (e) => { $('autherr').textContent = (e && e.code ? e.code.replace('auth/', '').replace(/-/g, ' ') : 'Something went wrong') + '.'; console.error(e); };
  $('signin').addEventListener('click', () => signInWithEmailAndPassword(auth, $('email').value, $('pw').value).catch(err));
  $('signup').addEventListener('click', () => createUserWithEmailAndPassword(auth, $('email').value, $('pw').value).catch(err));
  $('google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()).catch(err));
  $('github').addEventListener('click', () => signInWithPopup(auth, new GithubAuthProvider()).catch(err));
  $('diag').textContent = 'Project: ' + firebaseConfig.projectId + ' · Address: ' + location.hostname;
  let unsub = null;
  onAuthStateChanged(auth, (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) { state = null; ready = false; $('app').hidden = true; $('app').replaceChildren(); $('auth').hidden = false; return; }
    $('auth').hidden = true; $('app').hidden = false;
    docRef = doc(db, 'life', user.uid); // one document per person, so FireCMS can list and edit it
    setTimeout(refreshCalendar, 2000);
    unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) { state = EMPTY(); setDoc(docRef, state).catch(() => {}); render(); return; }
      if (snap.metadata.hasPendingWrites && state) return; // our own edit
      state = Object.assign(EMPTY(), snap.data()); render();
    }, () => { if (!state) { state = EMPTY(); render(); } });
  });
}
start();
