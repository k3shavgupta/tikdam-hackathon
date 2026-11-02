CREATE TABLE IF NOT EXISTS settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 ai_enabled INTEGER NOT NULL DEFAULT 0 CHECK(ai_enabled IN (0,1)),
 campaign_cap_microusd INTEGER NOT NULL DEFAULT 5000000 CHECK(campaign_cap_microusd BETWEEN 0 AND 5000000),
 daily_cap_microusd INTEGER NOT NULL DEFAULT 1000000 CHECK(daily_cap_microusd BETWEEN 0 AND 1000000),
 daily_call_cap INTEGER NOT NULL DEFAULT 10 CHECK(daily_call_cap BETWEEN 1 AND 10),
 max_in_flight INTEGER NOT NULL DEFAULT 1 CHECK(max_in_flight=1)
);
INSERT OR IGNORE INTO settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS events (
 id TEXT NOT NULL,session_id TEXT NOT NULL,event TEXT NOT NULL CHECK(event IN ('workflow_started','example_loaded','pack_downloaded')),
 mode TEXT NOT NULL CHECK(mode IN ('before','purchase','client')),country TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(session_id,id)
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY,session_id TEXT,operation TEXT NOT NULL CHECK(operation IN ('plan','assess','extract','chat')),
 mode TEXT CHECK(mode IN ('before','purchase','client')),country TEXT,model TEXT,
 status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','billing_unknown','blocked')),
 created_at TEXT NOT NULL,finished_at TEXT,duration_ms INTEGER,error_code TEXT,
 input_tokens INTEGER NOT NULL DEFAULT 0,output_tokens INTEGER NOT NULL DEFAULT 0,estimated_microusd INTEGER
);
CREATE INDEX IF NOT EXISTS jobs_created ON jobs(created_at);
CREATE INDEX IF NOT EXISTS jobs_filter ON jobs(operation,status,country,created_at);
CREATE TABLE IF NOT EXISTS ai_reservations (
 id TEXT PRIMARY KEY,session_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,payload_hmac TEXT NOT NULL,
 operation TEXT NOT NULL CHECK(operation IN ('extract','chat')),model TEXT NOT NULL,pricing_version TEXT NOT NULL,
 utc_day TEXT NOT NULL,ceiling_microusd INTEGER NOT NULL CHECK(ceiling_microusd>0),
 status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed_before_send','billing_unknown')),
 estimated_microusd INTEGER CHECK(estimated_microusd>=0 AND estimated_microusd<=ceiling_microusd),
 input_tokens INTEGER NOT NULL DEFAULT 0,output_tokens INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,finished_at TEXT,
 UNIQUE(session_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS reservations_day ON ai_reservations(utc_day,status);
CREATE INDEX IF NOT EXISTS reservations_status ON ai_reservations(status);
CREATE TABLE IF NOT EXISTS feedback (
 id TEXT PRIMARY KEY,session_id TEXT NOT NULL,text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 1000),
 mode TEXT CHECK(mode IN ('before','purchase','client')),country TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at);
CREATE TABLE IF NOT EXISTS throttles (
 key TEXT NOT NULL,window_start INTEGER NOT NULL,count INTEGER NOT NULL CHECK(count>0),expires_at TEXT NOT NULL,
 PRIMARY KEY(key,window_start)
);
CREATE INDEX IF NOT EXISTS throttles_expiry ON throttles(expires_at);
CREATE TABLE IF NOT EXISTS admin_audit (id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_created ON admin_audit(created_at);
