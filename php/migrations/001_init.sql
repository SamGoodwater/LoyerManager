CREATE TABLE oauth_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL CHECK(provider IN ('google','microsoft')),
  email TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  scopes TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, email)
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','error')),
  summary TEXT NOT NULL,
  metadata_json TEXT,
  error_message TEXT
);

CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_type ON activity_log(event_type);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES ('history_retention_months', '24');
