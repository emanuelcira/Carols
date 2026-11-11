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
