/**
 * Threat Intelligence Plugin
 * Detects IOCs (IP addresses, domains, hashes) and provides threat context
 */

class ThreatIntelPlugin {
  constructor() {
    this.name = 'threat-intel-plugin';
    this.version = '1.0';
    this.enabled = true;
    this.iocPatterns = {
      ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi,
      md5: /\b[a-f0-9]{32}\b/gi,
      sha1: /\b[a-f0-9]{40}\b/gi,
      sha256: /\b[a-f0-9]{64}\b/gi,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    };
    this.privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
    ];
  }

  /**
   * Extract all IOCs from text
   */
  extractIOCs(text) {
    const iocs = {
      ips: [],
      domains: [],
      hashes: [],
      emails: [],
    };

    // Extract IPv4 addresses
    const ipMatches = text.match(this.iocPatterns.ipv4) || [];
    iocs.ips = [...new Set(ipMatches.filter((ip) => !this.isPrivateIP(ip)))];

    // Extract domains
    const domainMatches = text.match(this.iocPatterns.domain) || [];
    iocs.domains = [...new Set(domainMatches.filter((d) => !this.isPrivateIP(d)))].slice(0, 10);

    // Extract hashes (MD5, SHA1, SHA256)
    const md5Matches = text.match(this.iocPatterns.md5) || [];
    const sha1Matches = text.match(this.iocPatterns.sha1) || [];
    const sha256Matches = text.match(this.iocPatterns.sha256) || [];
    iocs.hashes = [...new Set([...md5Matches, ...sha1Matches, ...sha256Matches])];

    // Extract emails
    const emailMatches = text.match(this.iocPatterns.email) || [];
    iocs.emails = [...new Set(emailMatches)].slice(0, 5);

    return iocs;
  }

  /**
   * Check if IP is in private range
   */
  isPrivateIP(ip) {
    return this.privateRanges.some((range) => range.test(ip));
  }

  /**
   * Get threat level color coding
   */
  getThreatLevel(iocCount) {
    if (iocCount === 0) return '🟢 LOW';
    if (iocCount <= 3) return '🟡 MEDIUM';
    if (iocCount <= 8) return '🟠 HIGH';
    return '🔴 CRITICAL';
  }

  /**
   * Analyze Docker command output for IOCs
   */
  analyzeOutput(output, command) {
    const iocs = this.extractIOCs(output);
    const totalIOCs = Object.values(iocs).reduce((sum, arr) => sum + arr.length, 0);

    if (totalIOCs === 0) {
      return output;
    }

    let analyzed = output;
    analyzed += '\n\n═══════════════════════════════════════════════\n';
    analyzed += `[ THREAT INTELLIGENCE ] ${this.getThreatLevel(totalIOCs)}\n`;
    analyzed += '═══════════════════════════════════════════════\n\n';

    if (iocs.ips.length > 0) {
      analyzed += `🔍 External IPs Detected (${iocs.ips.length}):\n`;
      iocs.ips.forEach((ip) => {
        analyzed += `   • ${ip}\n`;
      });
      analyzed += '\n';
    }

    if (iocs.domains.length > 0) {
      analyzed += `🔗 Domains Detected (${iocs.domains.length}):\n`;
      iocs.domains.forEach((domain) => {
        analyzed += `   • ${domain}\n`;
      });
      analyzed += '\n';
    }

    if (iocs.hashes.length > 0) {
      analyzed += `#️⃣ File Hashes Detected (${iocs.hashes.length}):\n`;
      iocs.hashes.forEach((hash) => {
        analyzed += `   • ${hash}\n`;
      });
      analyzed += '\n';
    }

    if (iocs.emails.length > 0) {
      analyzed += `📧 Email Addresses Detected (${iocs.emails.length}):\n`;
      iocs.emails.forEach((email) => {
        analyzed += `   • ${email}\n`;
      });
      analyzed += '\n';
    }

    analyzed += '⚠️  Recommendation: Cross-reference IOCs with threat intelligence databases\n';
    analyzed += '   (VirusTotal, AlienVault OTX, MISP, etc.)\n';

    return analyzed;
  }

  /**
   * Hook handler for output:analyze
   */
  onOutputAnalyze(data) {
    if (!data.output) {
      return data;
    }

    data.output = this.analyzeOutput(data.output, data.command);
    return data;
  }
}

module.exports = new ThreatIntelPlugin();
