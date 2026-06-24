CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local' CHECK(auth_provider IN ('local', 'google', 'microsoft')),
  oauth_sub TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE smtp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host TEXT NOT NULL DEFAULT '',
  port INTEGER NOT NULL DEFAULT 587,
  encryption TEXT NOT NULL DEFAULT 'tls' CHECK(encryption IN ('tls', 'ssl', 'none')),
  username TEXT NOT NULL DEFAULT '',
  password_enc TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  is_configured INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT ''
);

INSERT INTO smtp_settings (id, updated_at) VALUES (1, '');
