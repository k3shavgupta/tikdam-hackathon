CREATE TABLE IF NOT EXISTS evaluation_campaign (
 id TEXT PRIMARY KEY CHECK(id='tikdam-v1-eval-2026-11-01'),
 cap_microusd INTEGER NOT NULL CHECK(cap_microusd=4000000),
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
 pause_reason TEXT
);
INSERT OR IGNORE INTO evaluation_campaign(id,cap_microusd) VALUES('tikdam-v1-eval-2026-11-01',4000000);
CREATE TABLE IF NOT EXISTS evaluation_providers (
 provider TEXT PRIMARY KEY CHECK(provider IN ('meta','modal','baseten')),
 cap_microusd INTEGER NOT NULL CHECK((provider='meta' AND cap_microusd=3000000) OR (provider IN ('modal','baseten') AND cap_microusd=500000)),
 operating_stop_microusd INTEGER NOT NULL CHECK((provider='meta' AND operating_stop_microusd=2700000) OR (provider IN ('modal','baseten') AND operating_stop_microusd=450000)),
 attempt_cap INTEGER NOT NULL CHECK((provider='meta' AND attempt_cap=1000) OR (provider IN ('modal','baseten') AND attempt_cap=1000)),
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),pause_reason TEXT
);
INSERT OR IGNORE INTO evaluation_providers(provider,cap_microusd,operating_stop_microusd,attempt_cap) VALUES('meta',3000000,2700000,1000);
INSERT OR IGNORE INTO evaluation_providers(provider,cap_microusd,operating_stop_microusd,attempt_cap) VALUES('modal',500000,450000,1000);
INSERT OR IGNORE INTO evaluation_providers(provider,cap_microusd,operating_stop_microusd,attempt_cap) VALUES('baseten',500000,450000,1000);
CREATE TABLE IF NOT EXISTS evaluation_reservations (
 id TEXT PRIMARY KEY,provider TEXT NOT NULL REFERENCES evaluation_providers(provider),operation TEXT NOT NULL,
 fixture_id TEXT NOT NULL,ceiling_microusd INTEGER NOT NULL CHECK(ceiling_microusd>=0),
 max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 1000),price_version TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','succeeded','unbilled','billing_unknown')),
 estimated_microusd INTEGER CHECK(estimated_microusd BETWEEN 0 AND ceiling_microusd),
 input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens>=0),output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens>=0),
 error_code TEXT,created_at TEXT NOT NULL,finished_at TEXT
);
CREATE INDEX IF NOT EXISTS evaluation_reservations_provider ON evaluation_reservations(provider,status);
CREATE TABLE IF NOT EXISTS evaluation_attempts (
 id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL REFERENCES evaluation_reservations(id),
 kind TEXT NOT NULL CHECK(kind IN ('preflight','generation','metadata','compute','cleanup')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evaluation_attempts_reservation ON evaluation_attempts(reservation_id);
