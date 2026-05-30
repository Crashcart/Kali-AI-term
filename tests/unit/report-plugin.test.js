/**
 * Report Plugin Unit Tests
 *
 * Exercises the real plugins/report-plugin.js (not a mock) with a focus on
 * the severity-extraction logic, which previously matched bare substrings
 * and mis-rated almost every finding.
 */

const reportPlugin = require('../../plugins/report-plugin');

describe('ReportPlugin.extractSeverity', () => {
  test('prefers an explicit "Severity: X" label', () => {
    expect(reportPlugin.extractSeverity('Analysis. Severity: HIGH. Next step...')).toBe('HIGH');
    expect(reportPlugin.extractSeverity('severity - critical')).toBe('CRITICAL');
  });

  test('does not false-positive on substrings (the original bug)', () => {
    // "highlight" must NOT be read as HIGH
    expect(reportPlugin.extractSeverity('Let me highlight the open ports below.')).toBe('INFO');
    // "allow"/"below"/"flow" must NOT be read as LOW
    expect(reportPlugin.extractSeverity('This will allow traffic to flow below.')).toBe('INFO');
  });

  test('matches whole-word severities when no label is present', () => {
    expect(reportPlugin.extractSeverity('This is a CRITICAL finding')).toBe('CRITICAL');
    expect(reportPlugin.extractSeverity('rated MEDIUM by the scanner')).toBe('MEDIUM');
  });

  test('returns INFO for empty or non-string input', () => {
    expect(reportPlugin.extractSeverity('')).toBe('INFO');
    expect(reportPlugin.extractSeverity(null)).toBe('INFO');
    expect(reportPlugin.extractSeverity(undefined)).toBe('INFO');
  });
});

describe('ReportPlugin.extractVulnerabilities', () => {
  test('captures unique CVE identifiers', () => {
    const v = reportPlugin.extractVulnerabilities(
      'Found CVE-2021-44228 and again CVE-2021-44228 plus CVE-2017-0144. Severity: CRITICAL',
      'scan example.com'
    );
    expect(v.severity).toBe('CRITICAL');
    expect(v.cves.sort()).toEqual(['CVE-2017-0144', 'CVE-2021-44228']);
    expect(v.query).toBe('scan example.com');
  });
});

describe('ReportPlugin findings management', () => {
  beforeEach(() => reportPlugin.resetFindings());

  test('onLLMResponse records a finding and annotates the response', () => {
    const data = reportPlugin.onLLMResponse({
      response: 'Open port 22. Severity: LOW',
      prompt: 'nmap target',
    });
    expect(reportPlugin.getFindings()).toHaveLength(1);
    expect(reportPlugin.getFindings()[0].severity).toBe('LOW');
    expect(data.response).toContain('report-plugin');
  });

  test('onLLMResponse ignores responses with no body', () => {
    reportPlugin.onLLMResponse({ prompt: 'x' });
    expect(reportPlugin.getFindings()).toHaveLength(0);
  });

  test('retained findings are capped at maxFindings', () => {
    reportPlugin.maxFindings = 5;
    for (let i = 0; i < 12; i++) {
      reportPlugin.onLLMResponse({ response: `finding ${i} Severity: INFO`, prompt: 'p' });
    }
    expect(reportPlugin.getFindings()).toHaveLength(5);
    // Oldest entries are discarded first.
    expect(reportPlugin.getFindings()[4].raw).toContain('finding 11');
    reportPlugin.maxFindings = 1000;
  });
});

describe('ReportPlugin.exportReport', () => {
  beforeEach(() => reportPlugin.resetFindings());

  test('markdown export is resilient to findings missing fields', () => {
    reportPlugin.findings = [{ description: 'no severity, no cves', query: 'q' }];
    const md = reportPlugin.generateMarkdownReport(reportPlugin.findings);
    expect(md).toContain('Penetration Testing Report');
    expect(md).toContain('INFO Severity');
  });

  test('json export reports the correct total', () => {
    reportPlugin.onLLMResponse({ response: 'x Severity: HIGH', prompt: 'p' });
    const parsed = JSON.parse(reportPlugin.exportReport('json'));
    expect(parsed.totalFindings).toBe(1);
    expect(parsed.findings[0].severity).toBe('HIGH');
  });
});
