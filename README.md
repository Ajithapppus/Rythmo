# APP NAME — Multilingual Music Streaming (starter)

Search and play English, Malayalam, Hindi and Tamil songs. Ad-free, installable PWA.

## Run
```bash
npm install
ADMIN_TOKEN=your-secret npm start   # http://localhost:3000
```

## What's included
- Search (song, artist, album, genre, language; Unicode supported) with instant suggestions
- Persistent player: play/pause/stop, prev/next, seek, volume, mute, shuffle, repeat, queue, like
- Media Session API (lock-screen controls, background playback where the browser allows)
- Auto sync of New Releases every 6 hours (node-cron), duplicate-safe upsert, sync log
- Admin API: `GET /api/admin/status`, `POST /api/admin/sync`, `POST /api/admin/disable/:id` (header `x-admin-token`)
- PWA manifest + service worker (never caches audio or API)

## Important: licensing
The catalog uses the free **iTunes Search API**, which only provides **30-second previews**. For full-length songs,
swap `fetchItunes()` in `server.js` for a licensed provider (e.g. a Spotify/Apple Music SDK with the user's own
subscription, or a licensed distributor). Never scrape YouTube or bypass DRM.

## Roadmap (not yet built)
User accounts, playlists, server-side recommendations, full admin UI, album/artist pages, listening history table.
Favorites and recently played currently live in browser localStorage.

## Put it on GitHub
```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Ajithapppus/REPO-NAME.git
git push -u origin main
```
