const express = require('express');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const db = new Database('music.db');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';
db.exec(`
CREATE TABLE IF NOT EXISTS songs(id INTEGER PRIMARY KEY, track_id TEXT UNIQUE, title TEXT, artist TEXT, album TEXT,
 language TEXT, genre TEXT, artwork TEXT, preview_url TEXT, release_date TEXT, available INTEGER DEFAULT 1);
CREATE INDEX IF NOT EXISTS i_title ON songs(title); CREATE INDEX IF NOT EXISTS i_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS i_album ON songs(album); CREATE INDEX IF NOT EXISTS i_rel ON songs(release_date);
CREATE TABLE IF NOT EXISTS sync_logs(id INTEGER PRIMARY KEY, at TEXT, added INTEGER, updated INTEGER, failed INTEGER, status TEXT);`);

const upsert = db.prepare(`INSERT INTO songs(track_id,title,artist,album,language,genre,artwork,preview_url,release_date)
 VALUES(@track_id,@title,@artist,@album,@language,@genre,@artwork,@preview_url,@release_date)
 ON CONFLICT(track_id) DO UPDATE SET title=excluded.title,artist=excluded.artist,album=excluded.album,
 artwork=excluded.artwork,preview_url=excluded.preview_url,release_date=excluded.release_date`);
const exists = db.prepare('SELECT 1 FROM songs WHERE track_id=?');

async function fetchItunes(term, language, limit = 50) {
  const u = `https://itunes.apple.com/search?media=music&entity=song&country=IN&limit=${limit}&term=${encodeURIComponent(term)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('API ' + r.status);
  const { results } = await r.json();
  let added = 0, updated = 0;
  for (const t of results) {
    if (!t.previewUrl) continue;
    const row = { track_id: String(t.trackId), title: t.trackName, artist: t.artistName, album: t.collectionName || '',
      language: language || detectLang(t.trackName + t.artistName), genre: t.primaryGenreName || '',
      artwork: (t.artworkUrl100 || '').replace('100x100', '400x400'), preview_url: t.previewUrl, release_date: (t.releaseDate || '').slice(0, 10) };
    exists.get(row.track_id) ? updated++ : added++;
    upsert.run(row);
  }
  return { added, updated };
}
function detectLang(s) {
  if (/[\u0D00-\u0D7F]/.test(s)) return 'Malayalam';
  if (/[\u0B80-\u0BFF]/.test(s)) return 'Tamil';
  if (/[\u0900-\u097F]/.test(s)) return 'Hindi';
  return 'English';
}
async function sync() {
  let added = 0, updated = 0, failed = 0;
  for (const l of ['Malayalam', 'Tamil', 'Hindi', 'English']) {
    try { const r = await fetchItunes(l + ' new songs', l); added += r.added; updated += r.updated; }
    catch (e) { failed++; console.error('sync failed', l, e.message); }
  }
  db.prepare('INSERT INTO sync_logs(at,added,updated,failed,status) VALUES(?,?,?,?,?)')
    .run(new Date().toISOString(), added, updated, failed, failed ? 'partial' : 'ok');
  return { added, updated, failed };
}
cron.schedule('0 */6 * * *', sync); // every 6 hours; respect provider limits

const app = express();
app.use(express.json());
app.use(express.static('public'));
const COLS = 'id,title,artist,album,language,genre,artwork,preview_url,release_date';

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const find = () => db.prepare(`SELECT ${COLS} FROM songs WHERE available=1 AND (title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ? OR language LIKE ?) ORDER BY release_date DESC LIMIT 30`).all(like, like, like, like, like);
  let rows = find();
  if (rows.length < 5) { try { await fetchItunes(q, null, 25); rows = find(); } catch (e) {} }
  res.json(rows);
});
app.get('/api/new', (req, res) => {
  const l = req.query.lang;
  res.json(db.prepare(`SELECT ${COLS} FROM songs WHERE available=1 ${l ? 'AND language=?' : ''} ORDER BY release_date DESC LIMIT 20`).all(...(l ? [l] : [])));
});
const admin = (req, res, next) => req.get('x-admin-token') === ADMIN_TOKEN ? next() : res.status(401).json({ error: 'unauthorized' });
app.get('/api/admin/status', admin, (req, res) => res.json({
  last: db.prepare('SELECT * FROM sync_logs ORDER BY id DESC LIMIT 1').get(),
  songs: db.prepare('SELECT COUNT(*) c FROM songs').get().c }));
app.post('/api/admin/sync', admin, async (req, res) => res.json(await sync()));
app.post('/api/admin/disable/:id', admin, (req, res) => { db.prepare('UPDATE songs SET available=0 WHERE id=?').run(req.params.id); res.json({ ok: true }); });

const port = process.env.PORT || 3000;
app.listen(port, async () => { console.log('http://localhost:' + port); if (!db.prepare('SELECT 1 FROM songs').get()) await sync(); });
