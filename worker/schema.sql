-- One row per phone per requested song
CREATE TABLE IF NOT EXISTS votes (
  song_id    INTEGER NOT NULL,
  device     TEXT    NOT NULL,
  ip         TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (song_id, device)
);
CREATE INDEX IF NOT EXISTS votes_ip ON votes (ip, song_id);

-- Carols suggested by the public, waiting for approval
CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  song_key   TEXT    NOT NULL DEFAULT '',
  language   TEXT    NOT NULL,
  lyrics     TEXT    NOT NULL,
  ip         TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_ip ON submissions (ip, created_at);

-- Caroling sign-ups (private: only editors can read them)
--   kind = 'neighbor' (a home someone invited), 'member' (a church member's home)
--          or 'caroler' (someone coming caroling)
CREATE TABLE IF NOT EXISTS signups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL DEFAULT '',
  address       TEXT    NOT NULL DEFAULT '',
  city          TEXT    NOT NULL DEFAULT '',
  day           TEXT    NOT NULL,
  time_pref     TEXT    NOT NULL DEFAULT '',   -- homes: preferred time, HH:MM (24h)
  contact_name  TEXT    NOT NULL DEFAULT '',
  contact_phone TEXT    NOT NULL DEFAULT '',
  transport     TEXT    NOT NULL DEFAULT '',
  seats         INTEGER NOT NULL DEFAULT 0,
  people        INTEGER NOT NULL DEFAULT 1,
  notes         TEXT    NOT NULL DEFAULT '',
  ip            TEXT    NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signups_ip ON signups (ip, created_at);
