// Bentley Executive Education: AI ethics in business
// Anonymous live polling across two sessions. No database, no accounts.
// Votes live in server memory and disappear when the service restarts.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const QR = require('qrcode');

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------
// QUESTIONS
// Types:
//   'likert'  -> options rendered as a single agreement scale
//   'choice'  -> options as a vertical list; allowOther adds a free-text box
//   'rank'    -> items the respondent puts in order, most to least
// Optional on any question:
//   compareWith: id of an earlier question. When revealed, both sets of
//                results appear side by side so the shift is visible.
//   note:        text shown only on the instructor screen, behind a button.
// ---------------------------------------------------------------------
const AGREE5 = [
  { id: 'sd', label: 'Strongly disagree' },
  { id: 'd', label: 'Disagree' },
  { id: 'n', label: 'Neutral' },
  { id: 'a', label: 'Agree' },
  { id: 'sa', label: 'Strongly agree' }
];

const WORRIES = [
  { id: 'bias', label: 'Bias and fairness' },
  { id: 'transparency', label: 'Transparency and opacity' },
  { id: 'privacy', label: 'Privacy and surveillance' },
  { id: 'accountability', label: 'Accountability and oversight' },
  { id: 'safety', label: 'Safety and unintended consequences' }
];

const QUESTIONS = [
  {
    id: 'p1',
    session: 1,
    tag: 'Poll 1',
    title: 'Personalized pricing',
    type: 'likert',
    prompt: 'It is ethically acceptable for a company to use AI to personalize prices based on what each customer is willing to pay, provided doing so is legal.',
    options: AGREE5
  },
  {
    id: 'p2a',
    session: 1,
    tag: 'Poll 2a',
    title: 'Worries in general',
    type: 'choice',
    prompt: 'Which AI ethics concern worries you most in general?',
    options: WORRIES,
    allowOther: true
  },
  {
    id: 'p2b',
    session: 1,
    tag: 'Poll 2b',
    title: 'Worries for your business',
    type: 'choice',
    prompt: 'Which AI risk worries you most for your own business specifically?',
    options: WORRIES,
    allowOther: true,
    compareWith: 'p2a'
  },
  {
    id: 'p3a',
    session: 1,
    tag: 'Poll 3, round 1',
    title: 'OptiWork, before discussion',
    type: 'choice',
    prompt: 'OptiWork case: what should the company do?',
    options: [
      { id: 'a', label: 'A. Full deployment' },
      { id: 'b', label: 'B. Limited deployment with added safeguards' },
      { id: 'c', label: 'C. Do not deploy' }
    ]
  },
  {
    id: 'p3b',
    session: 1,
    tag: 'Poll 3, round 2',
    title: 'OptiWork, after discussion',
    type: 'choice',
    prompt: 'OptiWork case: what should the company do?',
    options: [
      { id: 'a', label: 'A. Full deployment' },
      { id: 'b', label: 'B. Limited deployment with added safeguards' },
      { id: 'c', label: 'C. Do not deploy' }
    ],
    compareWith: 'p3a'
  },
  {
    id: 'p4',
    session: 1,
    tag: 'Poll 4, optional',
    title: 'OptiWork variants, ranked',
    type: 'rank',
    prompt: 'Rank these three versions of an OptiWork-style system from most to least ethically problematic.',
    items: [
      { id: 'i1', label: 'Transparent but intrusive', sub: 'Employees know exactly what is monitored and can appeal, but the system collects extensive behavioral data.' },
      { id: 'i2', label: 'Opaque but validated', sub: 'Employees see the factors affecting them, but not the weighting. An independent audit finds high accuracy and no demographic disparity.' },
      { id: 'i3', label: 'Explainable but highly automated', sub: 'Employees can see why they were flagged, but managers normally accept the recommendation unless the employee challenges it.' }
    ]
  },
  {
    id: 'p5a',
    session: 2,
    tag: 'Poll 5, statement 1',
    title: 'Brutal honesty',
    type: 'likert',
    prompt: 'A world where AI business advisors are always brutally honest with executives, even when the feedback is harsh, unsolicited, and undiplomatically delivered, would be worse for business than a world where AI business advisors are always agreeable and validating.',
    options: AGREE5
  },
  {
    id: 'p5b',
    session: 2,
    tag: 'Poll 5, statement 2',
    title: 'Sanity-checking a decision',
    type: 'likert',
    prompt: 'Habitually asking AI to confirm a decision you have already made, before acting on it, is good practice, no different from having a trusted colleague sanity-check you.',
    options: AGREE5
  },
  {
    id: 'p6a',
    session: 2,
    tag: 'Poll 6, statement 3',
    title: 'Giving customers what they want',
    type: 'likert',
    prompt: 'AI companies that design agreeable AI are just giving customers what they want. That is not unethical, it is good business.',
    options: AGREE5
  },
  {
    id: 'p6b',
    session: 2,
    tag: 'Poll 6, statement 4',
    title: 'Complete recall',
    type: 'likert',
    prompt: 'A business partner or longtime colleague remembers maybe ten percent of everything you have discussed over the years. An AI advisor fed all your meeting notes, emails, and past decisions remembers all of it. In a high-stakes decision, the AI is the better advisor to consult, and preferring your partner\'s judgment over the AI\'s complete recall is just sentimentality.',
    options: AGREE5
  }
];

const byId = id => QUESTIONS.find(q => q.id === id);

// ---------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------
const rooms = new Map();

function newCode() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  return code;
}

function makeRoom() {
  const code = newCode();
  const room = {
    code,
    key: crypto.randomBytes(8).toString('hex'),
    openId: null,
    revealed: false,
    noteShown: false,
    votes: {},
    created: Date.now()
  };
  QUESTIONS.forEach(q => { room.votes[q.id] = {}; });
  rooms.set(code, room);
  return room;
}

// Sweep rooms untouched for a day so memory does not creep on a long-lived service.
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  rooms.forEach((r, c) => { if (r.created < cutoff) rooms.delete(c); });
}, 60 * 60 * 1000);

function tally(room, qid) {
  const q = byId(qid);
  const raw = Object.values(room.votes[qid] || {});
  if (q.type === 'rank') {
    const sums = {}, firsts = {};
    q.items.forEach(it => { sums[it.id] = 0; firsts[it.id] = 0; });
    let n = 0;
    raw.forEach(v => {
      if (!v || !Array.isArray(v.order)) return;
      n += 1;
      v.order.forEach((itemId, idx) => {
        if (sums[itemId] === undefined) return;
        sums[itemId] += idx + 1;
        if (idx === 0) firsts[itemId] += 1;
      });
    });
    const means = {};
    q.items.forEach(it => { means[it.id] = n ? sums[it.id] / n : 0; });
    return { count: n, means, firsts };
  }
  const dist = {};
  q.options.forEach(o => { dist[o.id] = 0; });
  if (q.allowOther) dist.other = 0;
  const others = [];
  raw.forEach(v => {
    if (!v || typeof v.c !== 'string') return;
    if (dist[v.c] !== undefined) dist[v.c] += 1;
    if (v.c === 'other' && v.t) others.push(v.t);
  });
  return { count: raw.length, dist, others };
}

function requireRoom(req, res) {
  const room = rooms.get(String(req.params.code));
  if (!room) { res.status(404).json({ error: 'No room with that code.' }); return null; }
  return room;
}

function requireHost(req, res, room) {
  const key = req.body.key || req.query.key;
  if (key !== room.key) { res.status(403).json({ error: 'Not the instructor for this room.' }); return false; }
  return true;
}

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------
app.get('/api/questions', (req, res) => res.json({ questions: QUESTIONS }));

app.post('/api/room', (req, res) => {
  const room = makeRoom();
  res.json({ code: room.code, key: room.key });
});

// QR code for the join URL, as inline SVG.
app.get('/api/qr', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const url = base + '/?code=' + encodeURIComponent(String(req.query.code || ''));
  QR.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    .then(svg => res.json({ url, svg }))
    .catch(() => res.status(500).json({ error: 'Could not build the QR code.' }));
});

app.get('/api/room/:code/host', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  if (!requireHost(req, res, room)) return;
  const results = {};
  QUESTIONS.forEach(q => { results[q.id] = tally(room, q.id); });
  res.json({ code: room.code, openId: room.openId, revealed: room.revealed, noteShown: room.noteShown, results });
});

app.get('/api/room/:code/student', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  const qid = room.openId;
  if (!qid) return res.json({ openId: null });
  const voter = String(req.query.voter || '');
  const mine = room.votes[qid][voter];
  const full = byId(qid);
  const { note, ...safe } = full;              // the note is instructor-only
  const payload = {
    openId: qid,
    question: safe,
    myVote: mine === undefined ? null : mine,
    revealed: room.revealed,
    results: room.revealed ? tally(room, qid) : null
  };
  if (room.revealed && full.compareWith) {
    payload.compare = { question: byId(full.compareWith), results: tally(room, full.compareWith) };
  }
  res.json(payload);
});

app.post('/api/room/:code/open', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  if (!requireHost(req, res, room)) return;
  const qid = req.body.qid;
  if (qid !== null && !byId(qid)) return res.status(400).json({ error: 'Unknown question.' });
  room.openId = qid;
  room.revealed = false;
  room.noteShown = false;
  res.json({ ok: true });
});

app.post('/api/room/:code/reveal', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  if (!requireHost(req, res, room)) return;
  room.revealed = !!req.body.revealed;
  res.json({ ok: true });
});

app.post('/api/room/:code/note', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  if (!requireHost(req, res, room)) return;
  room.noteShown = !!req.body.shown;
  res.json({ ok: true });
});

app.post('/api/room/:code/reset', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  if (!requireHost(req, res, room)) return;
  if (room.votes[req.body.qid]) room.votes[req.body.qid] = {};
  res.json({ ok: true });
});

app.post('/api/room/:code/vote', (req, res) => {
  const room = requireRoom(req, res); if (!room) return;
  const { qid, voter } = req.body;
  if (qid !== room.openId) return res.status(409).json({ error: 'That question is not open.' });
  if (!voter) return res.status(400).json({ error: 'Missing voter token.' });
  const q = byId(qid);

  if (q.type === 'rank') {
    const order = req.body.order;
    if (!Array.isArray(order) || order.length !== q.items.length) return res.status(400).json({ error: 'Incomplete ranking.' });
    const valid = q.items.map(i => i.id);
    if (!order.every(id => valid.includes(id)) || new Set(order).size !== order.length) {
      return res.status(400).json({ error: 'Invalid ranking.' });
    }
    room.votes[qid][String(voter)] = { order };
  } else {
    const c = String(req.body.choice);
    const known = q.options.some(o => o.id === c) || (q.allowOther && c === 'other');
    if (!known) return res.status(400).json({ error: 'Unknown option.' });
    const entry = { c };
    if (c === 'other') {
      const t = String(req.body.text || '').trim().slice(0, 140);
      if (!t) return res.status(400).json({ error: 'Please type your answer.' });
      entry.t = t;
    }
    room.votes[qid][String(voter)] = entry;
  }
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Poll running on ' + PORT));
