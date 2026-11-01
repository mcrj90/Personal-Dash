// Fetches your Apple calendar's published link on the server (browsers can't read it directly)
// and hands it to the signed-in app. The link lives in a Vercel environment variable, never in the repo.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBjnjrTrBSLCJLSaQYGewpso5cbxuWBSZc';

module.exports = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in first.' });

    // Only a signed-in user of your Firebase project may read the calendar.
    const check = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token })
    });
    if (!check.ok) return res.status(401).json({ error: 'Not signed in.' });
    const info = await check.json();
    const email = ((info.users && info.users[0] && info.users[0].email) || '').toLowerCase();
    const allowed = (process.env.ALLOWED_EMAIL || '').trim().toLowerCase();
    if (allowed && email !== allowed) return res.status(403).json({ error: 'Not allowed.' });

    const urls = (process.env.CALENDAR_ICS_URL || '').split(/[\s,]+/).filter(Boolean).map((u) => u.replace(/^webcal:/i, 'https:'));
    if (!urls.length) return res.status(500).json({ error: 'No calendar link is set yet.' });

    const texts = await Promise.all(urls.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('calendar ' + r.status); return r.text(); }));
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(texts.join('\n'));
  } catch (e) {
    return res.status(500).json({ error: 'Calendar could not be loaded.' });
  }
};
