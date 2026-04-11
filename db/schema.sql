-- Kali Hacker Bot Database Schema
-- SQLite database for persistent session and finding storage

-- ============================================================
-- HOSTS (CORE FEATURE — processed first, 3-day retention rule)
-- Host records are kept for 3 days since last_seen, then purged.
-- ============================================================

CREATE TABLE IF NOT EXISTS hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL UNIQUE,
  hostname TEXT,
  os TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  notes TEXT DEFAULT '',
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_ports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  state TEXT NOT NULL DEFAULT 'open',
  service TEXT,
  version TEXT,
  discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(host_id, port, protocol),
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hosts_last_seen ON hosts(last_seen);
CREATE INDEX IF NOT EXISTS idx_host_ports_host ON host_ports(host_id);

-- ============================================================


CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  auth_secret TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  notes TEXT DEFAULT '',
  last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Command execution history table
CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  command TEXT NOT NULL,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER,
  output TEXT,
  error_output TEXT,
  success BOOLEAN DEFAULT true,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Findings/vulnerabilities table
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  query TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  description TEXT NOT NULL,
  raw_data TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- CVE references table
CREATE TABLE IF NOT EXISTS finding_cves (
  finding_id INTEGER NOT NULL,
  cve_id TEXT NOT NULL,
  PRIMARY KEY (finding_id, cve_id),
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

-- CVE cache table (to avoid repeated API calls)
CREATE TABLE IF NOT EXISTS cve_cache (
  cve_id TEXT PRIMARY KEY,
  cvss_score REAL,
  severity TEXT,
  description TEXT,
  cached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- IOC (Indicators of Compromise) table for threat intel
CREATE TABLE IF NOT EXISTS iocs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ioc_type TEXT NOT NULL CHECK(ioc_type IN ('IP', 'DOMAIN', 'EMAIL', 'HASH')),
  ioc_value TEXT NOT NULL,
  found_in_command_id INTEGER,
  threat_context TEXT,
  detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (found_in_command_id) REFERENCES commands(id) ON DELETE SET NULL
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'html',
  content BLOB NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commands_session ON commands(session_id);
CREATE INDEX IF NOT EXISTS idx_commands_executed ON commands(executed_at);
CREATE INDEX IF NOT EXISTS idx_findings_session ON findings(session_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_iocs_session ON iocs(session_id);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(ioc_type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
