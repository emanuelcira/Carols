// API for emanuelcira.github.io/Carols
//
// Public:
//   GET    /requests                 -> { counts: { songId: n } }
//   POST   /requests                 { song, device, on } -> { count }
//   GET    /submissions              -> { submissions: [...] }  carols added by anyone
//   POST   /submissions              { title, key, language, lyrics } -> { song }
// Editors (Authorization: Bearer <GitHub token with push access to the repo>):
//   DELETE /submissions/:id          remove an added carol (or after moving it into data.json)
//   DELETE /requests/:songId         clear the stars of one song
//   DELETE /requests                 clear all stars (new season)

const REPO = 'emanuelcira/Carols';
const ORIGINS = ['https://emanuelcira.github.io', 'http://localhost:4620', 'http://127.0.0.1:4620'];

const MAX_VOTES_PER_IP_PER_SONG = 6;   // a family on one wifi can still star
const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5;
const MAX_PENDING = 200;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

    try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean);
      const ip = await hashIp(request.headers.get('CF-Connecting-IP') || '');

      // ----- Requests (stars) -----
      if (parts[0] === 'requests') {
        if (request.method === 'GET' && parts.length === 1) {
          const { results } = await env.DB.prepare('SELECT song_id, COUNT(*) AS n FROM votes GROUP BY song_id').all();
          const counts = {};
          results.forEach(r => { counts[r.song_id] = r.n; });
          return json({ counts });
        }

        if (request.method === 'POST' && parts.length === 1) {
          const body = await readJson(request);
          const song = Number(body.song);
          const device = String(body.device || '');
          if (!Number.isInteger(song) || song < 1 || song > 2000000 || !/^[a-z0-9-]{8,64}$/i.test(device)) {
            return json({ error: 'Bad request' }, 400);
          }
          if (body.on) {
            const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE ip = ? AND song_id = ?').bind(ip, song).first();
            if (n >= MAX_VOTES_PER_IP_PER_SONG) return json({ error: 'Too many requests for this song from this network' }, 429);
            await env.DB.prepare('INSERT OR IGNORE INTO votes (song_id, device, ip, created_at) VALUES (?, ?, ?, ?)')
              .bind(song, device, ip, Date.now()).run();
          } else {
            await env.DB.prepare('DELETE FROM votes WHERE song_id = ? AND device = ?').bind(song, device).run();
          }
          const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE song_id = ?').bind(song).first();
          return json({ count: n });
        }

        if (request.method === 'DELETE') {
          if (!(await isEditor(request))) return json({ error: 'Not allowed' }, 401);
          if (parts[1]) await env.DB.prepare('DELETE FROM votes WHERE song_id = ?').bind(Number(parts[1])).run();
          else await env.DB.prepare('DELETE FROM votes').run();
          return json({ ok: true });
        }
      }

      // ----- Suggested carols -----
      if (parts[0] === 'submissions') {
        if (request.method === 'POST' && parts.length === 1) {
          const body = await readJson(request);
          const title = clean(body.title, 120);
          const key = clean(body.key, 6);
          const language = body.language === 'english' ? 'english' : 'romanian';
          const lyrics = String(body.lyrics || '').replace(/\r\n/g, '\n').replace(/\s+$/, '').slice(0, 12000);
          if (!title || lyrics.trim().length < 10) return json({ error: 'Add a title and the lyrics' }, 400);

          const since = Date.now() - 3600_000;
          const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip = ? AND created_at > ?').bind(ip, since).first();
          if (n >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) return json({ error: 'Too many carols sent. Try again in an hour.' }, 429);
          const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions').first();
          if (total.n >= MAX_PENDING) return json({ error: 'The list of added carols is full right now. Try again later.' }, 429);

          const row = await env.DB.prepare('INSERT INTO submissions (title, song_key, language, lyrics, ip, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
            .bind(title, key, language, lyrics, ip, Date.now()).first();
          return json({ song: { id: row.id, title, key, language, lyrics } });
        }

        if (request.method === 'GET' && parts.length === 1) {
          const { results } = await env.DB.prepare(
            'SELECT id, title, song_key AS key, language, lyrics, created_at FROM submissions ORDER BY created_at'
          ).all();
          return json({ submissions: results });
        }

        if (request.method === 'DELETE' && parts[1]) {
          if (!(await isEditor(request))) return json({ error: 'Not allowed' }, 401);
          await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(Number(parts[1])).run();
          return json({ ok: true });
        }
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error' }, 500);
    }
  }
};

function clean(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 20000) throw new Error('Body too large');
  try { return JSON.parse(text) || {}; } catch { return {}; }
}

// Only a short hash of the IP is stored, for rate limits
async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rbcsf-carols:' + ip));
  return [...new Uint8Array(buf).slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Editors are people whose GitHub token can push to the Carols repo, the same
// token the site already uses to save data.json. Results are cached briefly.
const editorCache = new Map();
async function isEditor(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^(Bearer|token)\s+/i, '').trim();
  if (!token) return false;
  const cacheKey = await hashIp(token);
  const hit = editorCache.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.ok;

  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'rbcsf-carols-api' }
  });
  let ok = false;
  if (res.ok) {
    const repo = await res.json();
    ok = !!(repo.permissions && (repo.permissions.push || repo.permissions.admin));
  }
  editorCache.set(cacheKey, { ok, until: Date.now() + 10 * 60_000 });
  return ok;
}
