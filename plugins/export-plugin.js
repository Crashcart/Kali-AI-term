/**
 * Export Plugin - Session data export in multiple formats
 * Collects and exports session data for archival and compliance
 */

class ExportPlugin {
  constructor() {
    this.name = 'export-plugin';
    this.version = '1.0';
    this.enabled = false;
    this.sessionData = {
      commands: [],
      outputs: [],
      aiResponses: []
    };
  }

  /**
   * Collect command execution data
   */
  recordCommand(command, output) {
    this.sessionData.commands.push({
      timestamp: new Date().toISOString(),
      command: command,
      outputLength: output.length
    });

    this.sessionData.outputs.push({
      timestamp: new Date().toISOString(),
      output: output.substring(0, 1000) // Truncate to 1000 chars for memory
    });
  }

  /**
   * Collect AI response data
   */
  recordAIResponse(prompt, response, model) {
    this.sessionData.aiResponses.push({
      timestamp: new Date().toISOString(),
      model: model,
      prompt: prompt.substring(0, 200),
      response: response.substring(0, 1000),
      tokens: response.split(' ').length
    });
  }

  /**
   * Generate CSV format
   */
  generateCSV() {
    let csv = 'Timestamp,Type,Data\n';

    // Export commands
    this.sessionData.commands.forEach(cmd => {
      csv += `"${cmd.timestamp}","COMMAND","${cmd.command}"\n`;
    });

    // Export AI responses
    this.sessionData.aiResponses.forEach(resp => {
      csv += `"${resp.timestamp}","AI_RESPONSE","Model: ${resp.model} | Tokens: ${resp.tokens}"\n`;
    });

    return csv;
  }

  /**
   * Generate JSON format
   */
  generateJSON() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      sessionDuration: this.calculateDuration(),
      statistics: {
        totalCommands: this.sessionData.commands.length,
        totalAIResponses: this.sessionData.aiResponses.length,
        averageResponseTokens: this.calculateAverageTokens()
      },
      data: this.sessionData
    }, null, 2);
  }

  /**
   * Generate HTML report
   */
  generateHTML() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Penetration Test Session Export</title>
  <style>
    body { font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px; }
    .header { border-bottom: 2px solid #00ff00; padding-bottom: 10px; margin-bottom: 20px; }
    .section { margin: 20px 0; padding: 10px; border-left: 3px solid #00ff00; }
    .stat { display: inline-block; margin-right: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #003300; padding: 8px; text-align: left; border-bottom: 1px solid #00ff00; }
    td { padding: 8px; border-bottom: 1px solid #333; }
    .timestamp { color: #0099ff; }
    .command { color: #ffcc00; }
    .response { color: #00ff99; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ KALI HACKER BOT - SESSION EXPORT</h1>
    <p>Exported: ${new Date().toISOString()}</p>
  </div>

  <div class="section">
    <h2>Session Statistics</h2>
    <p class="stat">Commands: ${this.sessionData.commands.length}</p>
    <p class="stat">AI Responses: ${this.sessionData.aiResponses.length}</p>
    <p class="stat">Duration: ${this.calculateDuration()}</p>
  </div>

  <div class="section">
    <h2>Command History</h2>
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Command</th><th>Output Size</th></tr>
      </thead>
      <tbody>
        ${this.sessionData.commands.map(cmd =>
          `<tr><td class="timestamp">${cmd.timestamp}</td><td class="command">${cmd.command}</td><td>${cmd.outputLength} bytes</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>AI Responses</h2>
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Model</th><th>Tokens</th></tr>
      </thead>
      <tbody>
        ${this.sessionData.aiResponses.map(resp =>
          `<tr><td class="timestamp">${resp.timestamp}</td><td>${resp.model}</td><td>${resp.tokens}</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
    return html;
  }

  /**
   * Calculate session duration
   */
  calculateDuration() {
    if (this.sessionData.commands.length === 0) return '0m';
    const first = new Date(this.sessionData.commands[0].timestamp);
    const last = new Date(this.sessionData.commands[this.sessionData.commands.length - 1].timestamp);
    const minutes = Math.round((last - first) / 60000);
    return `${minutes}m`;
  }

  /**
   * Calculate average tokens in responses
   */
  calculateAverageTokens() {
    if (this.sessionData.aiResponses.length === 0) return 0;
    const total = this.sessionData.aiResponses.reduce((sum, r) => sum + r.tokens, 0);
    return Math.round(total / this.sessionData.aiResponses.length);
  }

  /**
   * Hook handler for output:analyze
   */
  onOutputAnalyze(data) {
    if (data.command && data.output) {
      this.recordCommand(data.command, data.output);
    }
    return data;
  }

  /**
   * Export in specified format
   */
  export(format = 'json') {
    switch (format.toLowerCase()) {
      case 'csv':
        return { format: 'csv', data: this.generateCSV() };
      case 'html':
        return { format: 'html', data: this.generateHTML() };
      case 'json':
      default:
        return { format: 'json', data: this.generateJSON() };
    }
  }

  /**
   * Clear collected data
   */
  reset() {
    this.sessionData = {
      commands: [],
      outputs: [],
      aiResponses: []
    };
  }
}

module.exports = new ExportPlugin();
