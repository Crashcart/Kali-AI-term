/**
 * Database Initialization Module
 * Handles SQLite database setup and connection management
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/kalibot.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Initialize the database connection and create tables
 */
function initializeDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Open or create database
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    console.log(`✓ Database initialized at ${DB_PATH}`);
    return db;
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    initializeDatabase();
  }
  return db;
}

/**
 * Clean up old expired sessions
 */
function cleanupExpiredSessions() {
  try {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired sessions`);
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

/**
 * Session management functions
 */

function createSession(sessionId, token, authSecret, expiresAt) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO sessions (id, token, auth_secret, expires_at, last_activity)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  return stmt.run(sessionId, token, authSecret, new Date(expiresAt).toISOString());
}

function getSession(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP');
  return stmt.get(sessionId);
}

function updateSessionActivity(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?');
  return stmt.run(sessionId);
}

function updateSessionNotes(sessionId, notes) {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE sessions SET notes = ? WHERE id = ?');
  return stmt.run(notes, sessionId);
}

function getSessionNotes(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT notes FROM sessions WHERE id = ?');
  const result = stmt.get(sessionId);
  return result ? result.notes : '';
}

function deleteSession(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM sessions WHERE id = ?');
  return stmt.run(sessionId);
}

/**
 * Command history functions
 */

function addCommand(sessionId, command, durationSeconds, output, errorOutput, success = true) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO commands (session_id, command, duration_seconds, output, error_output, success, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  return stmt.run(sessionId, command, durationSeconds, output || '', errorOutput || '', success);
}

function getCommandHistory(sessionId, limit = 100) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, command, executed_at, duration_seconds, success
    FROM commands
    WHERE session_id = ?
    ORDER BY executed_at DESC
    LIMIT ?
  `);
  return stmt.all(sessionId, limit);
}

function getFullCommandOutput(commandId) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT output, error_output FROM commands WHERE id = ?');
  return stmt.get(commandId);
}

/**
 * Findings/vulnerabilities functions
 */

function addFinding(sessionId, severity, description, query, rawData) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO findings (session_id, severity, description, query, raw_data, timestamp)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(sessionId, severity, description, query || '', rawData || '');
  return result.lastInsertRowid;
}

function addCVEToFinding(findingId, cveId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO finding_cves (finding_id, cve_id)
    VALUES (?, ?)
  `);
  return stmt.run(findingId, cveId);
}

function getFindings(sessionId, severity = null) {
  const database = getDatabase();
  let query = 'SELECT * FROM findings WHERE session_id = ?';
  const params = [sessionId];

  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY timestamp DESC LIMIT 100';
  const stmt = database.prepare(query);
  return stmt.all(...params);
}

function getFindingsWithCVEs(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT f.*, GROUP_CONCAT(fc.cve_id, ',') as cves
    FROM findings f
    LEFT JOIN finding_cves fc ON f.id = fc.finding_id
    WHERE f.session_id = ?
    GROUP BY f.id
    ORDER BY f.timestamp DESC
    LIMIT 100
  `);
  const results = stmt.all(sessionId);
  return results.map(row => ({
    ...row,
    cves: row.cves ? row.cves.split(',') : []
  }));
}

function getSeverityCounts(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT severity, COUNT(*) as count
    FROM findings
    WHERE session_id = ?
    GROUP BY severity
  `);
  const results = stmt.all(sessionId);
  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  };
  results.forEach(row => {
    counts[row.severity] = row.count;
  });
  return counts;
}

/**
 * CVE cache functions
 */

function getCVEFromCache(cveId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT cvss_score, severity, description
    FROM cve_cache
    WHERE cve_id = ? AND expires_at > CURRENT_TIMESTAMP
  `);
  return stmt.get(cveId);
}

function cacheCVE(cveId, cvssScore, severity, description, cacheDays = 30) {
  const database = getDatabase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + cacheDays);

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO cve_cache (cve_id, cvss_score, severity, description, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(cveId, cvssScore, severity, description, expiresAt.toISOString());
}

/**
 * IOC (Indicators of Compromise) functions
 */

function addIOC(sessionId, iocType, iocValue, commandId = null, threatContext = null) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO iocs (session_id, ioc_type, ioc_value, found_in_command_id, threat_context, detected_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  return stmt.run(sessionId, iocType, iocValue, commandId || null, threatContext || '');
}

function getIOCs(sessionId, type = null) {
  const database = getDatabase();
  let query = 'SELECT * FROM iocs WHERE session_id = ?';
  const params = [sessionId];

  if (type) {
    query += ' AND ioc_type = ?';
    params.push(type);
  }

  query += ' ORDER BY detected_at DESC LIMIT 500';
  const stmt = database.prepare(query);
  return stmt.all(...params);
}

/**
 * Report functions
 */

function saveReport(sessionId, title, format, content) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO reports (session_id, title, format, content, generated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  return stmt.run(sessionId, title, format, Buffer.from(content));
}

function getReports(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, title, format, generated_at
    FROM reports
    WHERE session_id = ?
    ORDER BY generated_at DESC
  `);
  return stmt.all(sessionId);
}

function getReport(reportId) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT content FROM reports WHERE id = ?');
  const result = stmt.get(reportId);
  return result ? result.content : null;
}

/**
 * Statistics functions
 */

function getSessionStats(sessionId) {
  const database = getDatabase();

  const session = database.prepare('SELECT created_at, expires_at FROM sessions WHERE id = ?').get(sessionId);
  const commandCount = database.prepare('SELECT COUNT(*) as count FROM commands WHERE session_id = ?').get(sessionId);
  const findingCount = database.prepare('SELECT COUNT(*) as count FROM findings WHERE session_id = ?').get(sessionId);
  const severityCounts = getSeverityCounts(sessionId);

  return {
    sessionId,
    createdAt: session?.created_at,
    commandsExecuted: commandCount?.count || 0,
    findingsDiscovered: findingCount?.count || 0,
    severityBreakdown: severityCounts
  };
}

/**
 * Export functions
 */

function exportSessionData(sessionId) {
  const database = getDatabase();

  const session = database.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const commands = database.prepare('SELECT * FROM commands WHERE session_id = ? ORDER BY executed_at').all(sessionId);
  const findings = getFindingsWithCVEs(sessionId);
  const iocs = getIOCs(sessionId);

  return {
    session: session ? {
      id: session.id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      notes: session.notes
    } : null,
    commands: commands.map(cmd => ({
      command: cmd.command,
      timestamp: cmd.executed_at,
      duration: cmd.duration_seconds,
      success: cmd.success
    })),
    findings,
    iocs
  };
}

/**
 * Health check and maintenance
 */

function healthCheck() {
  try {
    const database = getDatabase();
    database.prepare('SELECT 1').get();
    return { status: 'ok', location: DB_PATH };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Close database connection
 */

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Export functions
module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  cleanupExpiredSessions,
  healthCheck,

  // Session functions
  createSession,
  getSession,
  updateSessionActivity,
  updateSessionNotes,
  getSessionNotes,
  deleteSession,

  // Command functions
  addCommand,
  getCommandHistory,
  getFullCommandOutput,

  // Finding functions
  addFinding,
  addCVEToFinding,
  getFindings,
  getFindingsWithCVEs,
  getSeverityCounts,

  // CVE cache functions
  getCVEFromCache,
  cacheCVE,

  // IOC functions
  addIOC,
  getIOCs,

  // Report functions
  saveReport,
  getReports,
  getReport,

  // Statistics and export
  getSessionStats,
  exportSessionData
};
