'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { FileManager } = require('../../lib/file-manager');

describe('FileManager', () => {
  let fm;
  let tmpDir;
  const SESSION_ID = 'test-session-abc123';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
    fm = new FileManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── writeFile ─────────────────────────────────────────────────────────────

  describe('writeFile()', () => {
    test('writes a utf8 text file and returns metadata', () => {
      const result = fm.writeFile(SESSION_ID, 'output.txt', 'hello world', 'utf8');
      expect(result.filename).toBe('output.txt');
      expect(result.size).toBe(11);
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(result.writtenAt).toBeTruthy();
      const written = fs.readFileSync(path.join(tmpDir, SESSION_ID, 'output.txt'), 'utf8');
      expect(written).toBe('hello world');
    });

    test('writes a base64-encoded file and decodes correctly', () => {
      const original = 'binary content test';
      const b64 = Buffer.from(original).toString('base64');
      const result = fm.writeFile(SESSION_ID, 'data.json', b64, 'base64');
      expect(result.size).toBe(original.length);
    });

    test('creates intermediate directories for nested filenames', () => {
      fm.writeFile(SESSION_ID, 'subdir/output.txt', 'nested', 'utf8');
      const content = fs.readFileSync(
        path.join(tmpDir, SESSION_ID, 'subdir', 'output.txt'),
        'utf8'
      );
      expect(content).toBe('nested');
    });

    test('rejects disallowed extension .exe', () => {
      expect(() => fm.writeFile(SESSION_ID, 'evil.exe', 'data')).toThrow('File type not allowed');
    });

    test('rejects disallowed extension .so', () => {
      expect(() => fm.writeFile(SESSION_ID, 'lib.so', 'data')).toThrow('File type not allowed');
    });

    test('rejects disallowed extension .dll', () => {
      expect(() => fm.writeFile(SESSION_ID, 'lib.dll', 'data')).toThrow('File type not allowed');
    });

    test('rejects filename with no extension', () => {
      expect(() => fm.writeFile(SESSION_ID, 'noext', 'data')).toThrow('File type not allowed');
    });

    test('rejects path traversal via ../ in filename', () => {
      expect(() => fm.writeFile(SESSION_ID, '../etc/passwd', 'data')).toThrow(
        /path traversal|invalid characters/i
      );
    });

    test('rejects filename with null byte', () => {
      expect(() => fm.writeFile(SESSION_ID, 'file\0.txt', 'data')).toThrow(/null byte/i);
    });

    test('rejects oversized content exceeding MAX_FILE_SIZE', () => {
      // 11 MB of data — over the 10 MB default limit
      const oversize = 'x'.repeat(11 * 1024 * 1024);
      expect(() => fm.writeFile(SESSION_ID, 'big.txt', oversize, 'utf8')).toThrow(
        /exceeds maximum/i
      );
    });
  });

  // ── readFile ──────────────────────────────────────────────────────────────

  describe('readFile()', () => {
    beforeEach(() => {
      fm.writeFile(SESSION_ID, 'read-test.txt', 'read content', 'utf8');
    });

    test('reads a file back as utf8', () => {
      const result = fm.readFile(SESSION_ID, 'read-test.txt', 'utf8');
      expect(result.content).toBe('read content');
      expect(result.encoding).toBe('utf8');
      expect(result.size).toBe(12);
      expect(result.modifiedAt).toBeTruthy();
    });

    test('reads a file back as base64 and decodes correctly', () => {
      const result = fm.readFile(SESSION_ID, 'read-test.txt', 'base64');
      const decoded = Buffer.from(result.content, 'base64').toString('utf8');
      expect(decoded).toBe('read content');
    });

    test('throws on missing file', () => {
      expect(() => fm.readFile(SESSION_ID, 'nonexistent.txt')).toThrow('File not found');
    });

    test('throws on path traversal attempt', () => {
      expect(() => fm.readFile(SESSION_ID, '../../../etc/hosts')).toThrow(
        /path traversal|invalid characters/i
      );
    });

    test('throws on disallowed extension', () => {
      expect(() => fm.readFile(SESSION_ID, 'secret.dll')).toThrow('File type not allowed');
    });
  });

  // ── deleteFile ────────────────────────────────────────────────────────────

  describe('deleteFile()', () => {
    beforeEach(() => {
      fm.writeFile(SESSION_ID, 'delete-me.txt', 'bye', 'utf8');
    });

    test('deletes an existing file and returns metadata', () => {
      const result = fm.deleteFile(SESSION_ID, 'delete-me.txt');
      expect(result.filename).toBe('delete-me.txt');
      expect(result.deletedAt).toBeTruthy();
      expect(fs.existsSync(path.join(tmpDir, SESSION_ID, 'delete-me.txt'))).toBe(false);
    });

    test('throws when file does not exist', () => {
      expect(() => fm.deleteFile(SESSION_ID, 'ghost.txt')).toThrow('File not found');
    });

    test('throws on path traversal in delete', () => {
      expect(() => fm.deleteFile(SESSION_ID, '../other-session/secret.txt')).toThrow(
        /path traversal|invalid characters/i
      );
    });

    test('throws on disallowed extension', () => {
      expect(() => fm.deleteFile(SESSION_ID, 'virus.exe')).toThrow('File type not allowed');
    });
  });

  // ── listFiles ─────────────────────────────────────────────────────────────

  describe('listFiles()', () => {
    test('returns empty array when session has no files', () => {
      const files = fm.listFiles('empty-session');
      expect(files).toEqual([]);
    });

    test('lists files with size and modifiedAt metadata', () => {
      fm.writeFile(SESSION_ID, 'a.txt', 'alpha', 'utf8');
      fm.writeFile(SESSION_ID, 'b.json', '{}', 'utf8');
      const files = fm.listFiles(SESSION_ID);
      expect(files).toHaveLength(2);
      const names = files.map((f) => f.filename).sort();
      expect(names).toEqual(['a.txt', 'b.json']);
      files.forEach((f) => {
        expect(f.size).toBeGreaterThan(0);
        expect(f.modifiedAt).toBeTruthy();
      });
    });

    test('does not include subdirectories in listing', () => {
      fm.writeFile(SESSION_ID, 'subdir/nested.txt', 'nested', 'utf8');
      fm.writeFile(SESSION_ID, 'root.txt', 'root', 'utf8');
      const files = fm.listFiles(SESSION_ID);
      const names = files.map((f) => f.filename);
      expect(names).toContain('root.txt');
      expect(names).not.toContain('subdir');
    });
  });

  // ── Session isolation ─────────────────────────────────────────────────────

  describe('Session isolation', () => {
    test('session A cannot traverse to session B files', () => {
      fm.writeFile('session-a', 'private.txt', 'secret-A', 'utf8');
      expect(() => fm.readFile('session-b', '../session-a/private.txt')).toThrow(
        /path traversal|invalid characters/i
      );
    });

    test('two sessions with the same filename hold independent content', () => {
      fm.writeFile('session-a', 'data.txt', 'A data', 'utf8');
      fm.writeFile('session-b', 'data.txt', 'B data', 'utf8');
      const a = fm.readFile('session-a', 'data.txt', 'utf8');
      const b = fm.readFile('session-b', 'data.txt', 'utf8');
      expect(a.content).toBe('A data');
      expect(b.content).toBe('B data');
    });
  });

  // ── getConfig ─────────────────────────────────────────────────────────────

  describe('getConfig()', () => {
    test('returns workspace root, size limit, and allowed extensions', () => {
      const config = fm.getConfig();
      expect(config.workspaceRoot).toBe(tmpDir);
      expect(config.maxFileSizeBytes).toBeGreaterThan(0);
      expect(Array.isArray(config.allowedExtensions)).toBe(true);
      expect(config.allowedExtensions).toContain('.txt');
      expect(config.allowedExtensions).toContain('.json');
    });
  });
});
