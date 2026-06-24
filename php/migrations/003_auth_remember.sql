CREATE TABLE auth_remember_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selector TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX idx_auth_remember_user ON auth_remember_tokens(user_id);
CREATE INDEX idx_auth_remember_expires ON auth_remember_tokens(expires_at);
