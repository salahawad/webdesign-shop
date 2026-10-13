CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id),
  number INTEGER NOT NULL CHECK (number > 0),
  html TEXT NOT NULL,
  author TEXT NOT NULL,
  role TEXT NOT NULL,
  notes TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In review',
  UNIQUE (design_id, number)
);
CREATE INDEX IF NOT EXISTS versions_design_id_idx ON versions(design_id);
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
