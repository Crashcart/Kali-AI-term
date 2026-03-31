'use strict';

/**
 * FileManager
 * Provides sandboxed file I/O for the AI assistant.
 * All operations are strictly scoped to the configured workspace directory.
 * Prevents path traversal, validates extensions and file sizes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurable workspace root - defaults to ./ai-workspace relative to CWD
const BASE_WORKSPACE_DIR = process.env.AI_WORKSPACE_DIR
  ? path.resolve(process.env.AI_WORKSPACE_DIR)
  : path.join(process.cwd(), 'ai-workspace');

// Max file size in bytes (default 10 MB)
const MAX_FILE_SIZE = parseInt(process.env.AI_FILE_MAX_SIZE, 10) || 10 * 1024 * 1024;

// Allowed file extensions — no executables, shared objects, or compiled binaries
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.csv',
  '.log', '.sh', '.py', '.rb', '.pl', '.js', '.ts',
  '.html', '.htm', '.css', '.conf', '.ini', '.cfg', '.toml',
  '.pcap', '.cap', '.nmap', '.gnmap', '.zip', '.tar', '.gz',
  '.env', '.sql', '.sqlite',
]);

// Safe filename characters: alphanumeric, hyphens, underscores, dots, forward slashes (subdirs)
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._\-/ ]+$/;

const LOG_PREFIX = '[FILE-MANAGER]';

/** Structured log helpers */
function logInfo(msg, meta = {}) {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  console.info(`${LOG_PREFIX} [INFO] ${msg}${metaStr ? ' ' + metaStr : ''}`);
}

function logWarn(msg, meta = {}) {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  console.warn(`${LOG_PREFIX} [WARN] ${msg}${metaStr ? ' ' + metaStr : ''}`);
}

function logError(msg, meta = {}) {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  console.error(`${LOG_PREFIX} [ERROR] ${msg}${metaStr ? ' ' + metaStr : ''}`);
}

class FileManager {
  /**
   * @param {string} workspaceRoot - Absolute path for the sandboxed workspace
   */
  constructor(workspaceRoot = BASE_WORKSPACE_DIR) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this._ensureDirectory(this.workspaceRoot);
    logInfo(`Initialized workspace at ${this.workspaceRoot}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Ensure a directory exists, creating it recursively if needed.
   * @param {string} dirPath
   */
  _ensureDirectory(dirPath) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      logError(`Failed to create directory: ${dirPath}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Sanitize session ID to prevent directory injection.
   * @param {string} sessionId
   * @returns {string}
   */
  _sanitizeSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    const cleaned = sessionId.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (cleaned.length === 0) {
      throw new Error('Session ID resolves to empty string after sanitization');
    }
    return cleaned;
  }

  /**
   * Resolve and validate that the given filename stays within the session workspace.
   * Throws if path traversal is detected.
   *
   * @param {string} sessionId
   * @param {string} filename
   * @returns {string} Absolute resolved path
   */
  _resolveSafe(sessionId, filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename must be a non-empty string');
    }

    // Reject null bytes
    if (filename.includes('\0')) {
      throw new Error('Filename contains invalid characters (null byte)');
    }

    // Reject filenames with unsafe characters
    if (!SAFE_FILENAME_REGEX.test(filename)) {
      throw new Error(`Filename contains invalid characters: ${filename}`);
    }

    const sanitizedSession = this._sanitizeSessionId(sessionId);
    const sessionDir = path.join(this.workspaceRoot, sanitizedSession);
    const resolved = path.resolve(sessionDir, filename);

    // Strict sandbox check — resolved path must be inside the session directory
    if (!resolved.startsWith(sessionDir + path.sep) && resolved !== sessionDir) {
      logWarn('Path traversal attempt detected', {
        sessionId: sessionId.slice(0, 8),
        filename,
        resolved,
      });
      throw new Error('Access denied: path traversal detected');
    }

    return resolved;
  }

  /**
   * Validate file extension against the allowlist.
   * @param {string} filename
   */
  _validateExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `File type not allowed: ${ext || '(no extension)'}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`
      );
    }
  }

  /**
   * Validate content size against the configured maximum.
   * @param {Buffer} buffer
   */
  _validateSize(buffer) {
    if (buffer.length > MAX_FILE_SIZE) {
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      throw new Error(`File size ${sizeMB}MB exceeds maximum allowed ${maxMB}MB`);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Write (upload) a file to the session workspace.
   *
   * @param {string} sessionId   - Session identifier (used as subdirectory)
   * @param {string} filename    - Target filename (relative, no traversal)
   * @param {string} content     - File content (base64 or utf-8 string)
   * @param {string} [encoding]  - 'base64' or 'utf8' (default: 'utf8')
   * @returns {{ filename, path, size, checksum, writtenAt }}
   */
  writeFile(sessionId, filename, content, encoding = 'utf8') {
    logInfo('Write request', { sessionId: sessionId.slice(0, 8), filename, encoding });

    this._validateExtension(filename);

    let buffer;
    if (encoding === 'base64') {
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = Buffer.from(content, 'utf8');
    }

    this._validateSize(buffer);

    const resolvedPath = this._resolveSafe(sessionId, filename);
    const parentDir = path.dirname(resolvedPath);
    this._ensureDirectory(parentDir);

    fs.writeFileSync(resolvedPath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    logInfo('File written successfully', {
      sessionId: sessionId.slice(0, 8),
      filename,
      size: buffer.length,
      checksum: checksum.slice(0, 16),
    });

    return {
      filename,
      path: resolvedPath,
      size: buffer.length,
      checksum,
      writtenAt: new Date().toISOString(),
    };
  }

  /**
   * Read (download) a file from the session workspace.
   *
   * @param {string} sessionId  - Session identifier
   * @param {string} filename   - File to read
   * @param {string} [encoding] - 'base64' or 'utf8' (default: 'base64')
   * @returns {{ filename, content, encoding, size, modifiedAt }}
   */
  readFile(sessionId, filename, encoding = 'base64') {
    logInfo('Read request', { sessionId: sessionId.slice(0, 8), filename });

    this._validateExtension(filename);

    const resolvedPath = this._resolveSafe(sessionId, filename);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filename}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a regular file: ${filename}`);
    }

    const buffer = fs.readFileSync(resolvedPath);
    const content = encoding === 'base64'
      ? buffer.toString('base64')
      : buffer.toString('utf8');

    logInfo('File read successfully', {
      sessionId: sessionId.slice(0, 8),
      filename,
      size: buffer.length,
    });

    return {
      filename,
      content,
      encoding,
      size: buffer.length,
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  /**
   * Delete a file from the session workspace.
   *
   * @param {string} sessionId - Session identifier
   * @param {string} filename  - File to remove
   * @returns {{ filename, deletedAt }}
   */
  deleteFile(sessionId, filename) {
    logInfo('Delete request', { sessionId: sessionId.slice(0, 8), filename });

    this._validateExtension(filename);

    const resolvedPath = this._resolveSafe(sessionId, filename);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filename}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a regular file: ${filename}`);
    }

    fs.unlinkSync(resolvedPath);

    logInfo('File deleted', { sessionId: sessionId.slice(0, 8), filename });

    return {
      filename,
      deletedAt: new Date().toISOString(),
    };
  }

  /**
   * List all files in a session's workspace directory.
   *
   * @param {string} sessionId - Session identifier
   * @returns {Array<{ filename, size, modifiedAt }>}
   */
  listFiles(sessionId) {
    logInfo('List request', { sessionId: sessionId.slice(0, 8) });

    const sanitized = this._sanitizeSessionId(sessionId);
    const sessionDir = path.join(this.workspaceRoot, sanitized);

    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const entries = fs.readdirSync(sessionDir, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => {
        try {
          const filePath = path.join(sessionDir, entry.name);
          const stat = fs.statSync(filePath);
          return {
            filename: entry.name,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        } catch (err) {
          logWarn(`Could not stat file: ${entry.name}`, { error: err.message });
          return null;
        }
      })
      .filter(Boolean);

    logInfo(`Listed ${files.length} file(s)`, { sessionId: sessionId.slice(0, 8) });
    return files;
  }

  /**
   * Return workspace configuration for inspection.
   * @returns {{ workspaceRoot, maxFileSizeBytes, allowedExtensions }}
   */
  getConfig() {
    return {
      workspaceRoot: this.workspaceRoot,
      maxFileSizeBytes: MAX_FILE_SIZE,
      allowedExtensions: [...ALLOWED_EXTENSIONS],
    };
  }
}

module.exports = {
  FileManager,
  BASE_WORKSPACE_DIR,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
};
