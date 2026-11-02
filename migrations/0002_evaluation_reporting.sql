CREATE TABLE IF NOT EXISTS evaluation_report_snapshots (
 campaign_id TEXT PRIMARY KEY CHECK(campaign_id='tikdam-v1-eval-2026-11-01'),
 generated_at TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
