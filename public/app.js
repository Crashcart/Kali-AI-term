// ============================================
// KALI HACKER BOT - Frontend Application
// ============================================

class KaliHackerBot {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.sessionId = localStorage.getItem('session_id');
        this.autoPilot = false;
        this.livePipe = false;
        this.targetIP = '192.168.1.100';
        this.localIP = '192.168.1.50';
        this.listeningPort = 4444;

        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthStatus();
        this.initializeSystemStatus();
    }

    initializeElements() {
        // Streams
        this.intelligenceStream = document.getElementById('intelligence-stream');
        this.wireStream = document.getElementById('wire-stream');

        // LEDs
        this.dockerLED = document.getElementById('docker-led');
        this.ollamaLED = document.getElementById('ollama-led');
        this.targetLED = document.getElementById('target-led');

        // HUD
        this.targetIPDisplay = document.getElementById('target-ip');
        this.localIPDisplay = document.getElementById('local-ip');
        this.listeningPortDisplay = document.getElementById('listening-port');
        this.sessionIDDisplay = document.getElementById('session-id');

        // Command
        this.commandInput = document.getElementById('command-input');
        this.sendBtn = document.getElementById('send-btn');
        this.killBtn = document.getElementById('kill-btn');
        this.burnBtn = document.getElementById('burn-btn');
        this.autoPilotBtn = document.getElementById('autopilot-btn');
        this.livePipeBtn = document.getElementById('livepipe-btn');

        // Modals
        this.loginModal = document.getElementById('login-modal');
        this.confirmModal = document.getElementById('confirm-modal');
        this.loginForm = document.getElementById('login-form');
        this.passwordInput = document.getElementById('password-input');

        // Clear buttons
        this.clearIntelBtn = document.getElementById('clear-intel');
        this.clearWireBtn = document.getElementById('clear-wire');

        // User info & settings
        this.userInfo = document.getElementById('user-info');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');

        // Settings form
        this.ollamaUrlInput = document.getElementById('ollama-url');
        this.ollamaModelInput = document.getElementById('ollama-model');
        this.ollmaTempInput = document.getElementById('ollama-temp');
        this.tempValueDisplay = document.getElementById('temp-value');
        this.ollamaStatusBox = document.getElementById('ollama-status');
        this.targetIPInput = document.getElementById('target-ip-input');
        this.localIPInput = document.getElementById('local-ip-input');
        this.listeningPortInput = document.getElementById('listening-port-input');
        this.saveSettingsBtn = document.getElementById('save-settings');
        this.resetSettingsBtn = document.getElementById('reset-settings');
        this.refreshModelsBtn = document.getElementById('refresh-models');
        this.closeSettingsBtn = document.getElementById('close-settings');
    }

    attachEventListeners() {
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeCommand();
        });

        this.sendBtn.addEventListener('click', () => this.executeCommand());
        this.killBtn.addEventListener('click', () => this.killAllProcesses());
        this.burnBtn.addEventListener('click', () => this.burnSession());

        this.autoPilotBtn.addEventListener('click', () => this.toggleAutoPilot());
        this.livePipeBtn.addEventListener('click', () => this.toggleLivePipe());

        this.clearIntelBtn.addEventListener('click', () => {
            this.intelligenceStream.innerHTML = '';
        });

        this.clearWireBtn.addEventListener('click', () => {
            this.wireStream.innerHTML = '';
        });

        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('confirm-btn').addEventListener('click', () => {
            this.executeConfirmedCommand();
        });

        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.closeConfirmModal();
        });

        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettingsToDefaults());
        this.refreshModelsBtn.addEventListener('click', () => this.refreshOllamaModels());

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Temperature slider
        this.ollmaTempInput.addEventListener('input', (e) => {
            this.tempValueDisplay.textContent = (e.target.value / 100).toFixed(2);
        });

        // Close modal on background click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    checkAuthStatus() {
        if (this.token && this.sessionId) {
            this.showMainApp();
            this.updateUserInfo();
            this.loadSettings();
        } else {
            this.showLoginModal();
        }
    }

    async login() {
        const password = this.passwordInput.value;

        try {
            const response = await this.apiCall('POST', '/api/auth/login', {
                password: password
            });

            this.token = response.token;
            this.sessionId = response.sessionId;

            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('session_id', this.sessionId);

            this.passwordInput.value = '';
            this.closeLoginModal();
            this.showMainApp();
            this.updateUserInfo();
            this.addIntelligenceMessage('🔓 Authentication successful!');
        } catch (err) {
            this.addIntelligenceMessage(`❌ Authentication failed: ${err.message}`, 'red');
            this.passwordInput.value = '';
        }
    }

    updateUserInfo() {
        this.userInfo.textContent = `📍 Session: ${this.sessionId.slice(0, 8)}...`;
    }

    // ============================================
    // SYSTEM STATUS
    // ============================================

    initializeSystemStatus() {
        this.checkSystemStatus();
        setInterval(() => this.checkSystemStatus(), 5000);
    }

    async checkSystemStatus() {
        try {
            const response = await this.apiCall('GET', '/api/system/status');

            // Update Docker LED
            if (response.docker.connected && response.docker.containerRunning) {
                this.dockerLED.classList.add('connected');
                this.dockerLED.classList.remove('disconnected');
            } else {
                this.dockerLED.classList.remove('connected');
                this.dockerLED.classList.add('disconnected');
            }

            // Update Ollama LED
            if (response.ollama.connected) {
                this.ollamaLED.classList.add('connected');
                this.ollamaLED.classList.remove('disconnected');
            } else {
                this.ollamaLED.classList.remove('connected');
                this.ollamaLED.classList.add('disconnected');
            }

            // Target LED (always connected for now)
            this.targetLED.classList.add('connected');
        } catch (err) {
            console.error('Status check error:', err);
        }
    }

    // ============================================
    // COMMAND EXECUTION
    // ============================================

    executeCommand() {
        const command = this.commandInput.value.trim();

        if (!command) return;

        this.commandInput.value = '';

        // Check if it looks like a natural language query or a system command
        if (this.isNaturalLanguage(command)) {
            this.processNaturalLanguage(command);
        } else {
            if (this.livePipe) {
                this.executeDockerCommand(command);
            } else {
                this.showConfirmModal(command);
            }
        }
    }

    isNaturalLanguage(input) {
        // Simple heuristic: if it contains common English words, treat as natural language
        const nlPatterns = /^(what|how|why|when|where|can|find|scan|test|check|enumerate|exploit|analyze|search|tell|explain)/i;
        return nlPatterns.test(input);
    }

    async processNaturalLanguage(query) {
        this.addIntelligenceMessage(`🧠 Processing query: "${query}"`, 'cyan');
        this.addIntelligenceMessage('⏳ AI is thinking...', 'cyan');

        try {
            const stream = new EventSource('/api/ollama/stream', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            stream.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.token) {
                        this.addIntelligenceMessage(data.token, 'green', true);
                    }
                    if (data.done) {
                        stream.close();
                        this.addIntelligenceMessage('✓ Done', 'green');
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                }
            };

            stream.onerror = (err) => {
                stream.close();
                this.addIntelligenceMessage(`❌ AI Error: ${err.message}`, 'red');
            };
        } catch (err) {
            this.addIntelligenceMessage(`❌ Error: ${err.message}`, 'red');
        }
    }

    async executeDockerCommand(command) {
        this.addWireMessage(`$ ${command}`, 'green');
        this.addWireMessage('⏳ Executing...', 'grey');

        try {
            const response = await this.apiCall('POST', '/api/docker/exec', {
                command: command
            });

            if (response.success) {
                const output = response.output || '(no output)';
                this.addWireMessage(output, 'grey');
                this.addWireMessage('✓ Command completed', 'green');

                // Also send to intelligence stream for analysis
                if (this.autoPilot) {
                    this.analyzeCommandOutput(command, output);
                }
            }
        } catch (err) {
            this.addWireMessage(`❌ Error: ${err.message}`, 'red');
        }
    }

    async analyzeCommandOutput(command, output) {
        const analysisPrompt = `Analyze this penetration test command output and suggest the next logical step:
Command: ${command}
Output: ${output.slice(0, 500)}...

Provide a concise technical analysis and suggest the next command.`;

        this.addIntelligenceMessage('🤖 Auto-Pilot analyzing...', 'cyan');

        try {
            const response = await this.apiCall('POST', '/api/ollama/generate', {
                prompt: analysisPrompt,
                model: 'dolphin-mixtral'
            });

            this.addIntelligenceMessage(response.response, 'green');
        } catch (err) {
            console.error('Analysis error:', err);
        }
    }

    // ============================================
    // KILL & BURN FUNCTIONS
    // ============================================

    async killAllProcesses() {
        this.addWireMessage('⏹ Killing all processes...', 'red');

        try {
            await this.apiCall('POST', '/api/docker/exec', {
                command: 'pkill -9 -u root'
            });

            this.addWireMessage('✓ All processes terminated', 'red');
            this.targetLED.classList.remove('connected');
        } catch (err) {
            this.addWireMessage(`❌ Kill failed: ${err.message}`, 'red');
        }
    }

    async burnSession() {
        if (!confirm('🔥 Burn entire session? This will reset Docker and clear all data.')) {
            return;
        }

        this.addWireMessage('🔥 BURNING SESSION...', 'warning');
        this.addIntelligenceMessage('🔥 Purging all traces...', 'yellow');

        // Clear localStorage
        localStorage.clear();

        // Clear browser cache (simulated)
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }

        // Wait a moment then reload
        setTimeout(() => {
            location.reload();
        }, 2000);
    }

    // ============================================
    // TOGGLES
    // ============================================

    toggleAutoPilot() {
        this.autoPilot = !this.autoPilot;
        if (this.autoPilot) {
            this.autoPilotBtn.classList.add('active');
            this.addIntelligenceMessage('✓ Auto-Pilot ENABLED', 'green');
        } else {
            this.autoPilotBtn.classList.remove('active');
            this.addIntelligenceMessage('✗ Auto-Pilot DISABLED', 'yellow');
        }
    }

    toggleLivePipe() {
        this.livePipe = !this.livePipe;
        if (this.livePipe) {
            this.livePipeBtn.classList.add('active');
            this.addIntelligenceMessage('✓ Live-Pipe ENABLED (direct execution)', 'green');
        } else {
            this.livePipeBtn.classList.remove('active');
            this.addIntelligenceMessage('✗ Live-Pipe DISABLED (confirmation required)', 'yellow');
        }
    }

    // ============================================
    // MODAL MANAGEMENT
    // ============================================

    showLoginModal() {
        this.loginModal.classList.add('active');
        this.passwordInput.focus();
    }

    closeLoginModal() {
        this.loginModal.classList.remove('active');
    }

    showMainApp() {
        // Hide login modal
        this.loginModal.classList.remove('active');
        this.commandInput.focus();
    }

    showConfirmModal(command) {
        document.getElementById('command-preview').textContent = `$ ${command}`;
        this.confirmModal.classList.add('active');
        this.pendingCommand = command;
    }

    closeConfirmModal() {
        this.confirmModal.classList.remove('active');
        this.pendingCommand = null;
    }

    async executeConfirmedCommand() {
        this.closeConfirmModal();
        if (this.pendingCommand) {
            await this.executeDockerCommand(this.pendingCommand);
            this.pendingCommand = null;
        }
    }

    // ============================================
    // OUTPUT STREAMS
    // ============================================

    addIntelligenceMessage(message, color = 'cyan', append = false) {
        const span = document.createElement('span');
        span.className = color || 'cyan';
        span.textContent = message;

        if (append) {
            const lastElement = this.intelligenceStream.lastChild;
            if (lastElement && lastElement.tagName === 'SPAN') {
                lastElement.textContent += message;
            } else {
                this.intelligenceStream.appendChild(span);
            }
        } else {
            const line = document.createElement('div');
            line.appendChild(span);
            this.intelligenceStream.appendChild(line);
        }

        this.intelligenceStream.scrollTop = this.intelligenceStream.scrollHeight;
    }

    addWireMessage(message, color = 'grey') {
        const span = document.createElement('span');
        span.className = color || 'grey';
        span.textContent = message;

        const line = document.createElement('div');
        line.appendChild(span);
        this.wireStream.appendChild(line);

        this.wireStream.scrollTop = this.wireStream.scrollHeight;
    }

    // ============================================
    // SETTINGS
    // ============================================

    openSettings() {
        this.loadSettings();
        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('settings')) || {};

        this.ollamaUrlInput.value = settings.ollamaUrl || 'http://host.docker.internal:11434';
        this.ollamaModelInput.value = settings.ollamaModel || 'dolphin-mixtral';
        this.ollmaTempInput.value = settings.ollamaTemp || 70;
        this.tempValueDisplay.textContent = (this.ollmaTempInput.value / 100).toFixed(2);

        this.targetIPInput.value = settings.targetIP || this.targetIP;
        this.localIPInput.value = settings.localIP || this.localIP;
        this.listeningPortInput.value = settings.listeningPort || this.listeningPort;

        this.checkOllamaStatus();
    }

    saveSettings() {
        const settings = {
            ollamaUrl: this.ollamaUrlInput.value,
            ollamaModel: this.ollamaModelInput.value,
            ollamaTemp: this.ollmaTempInput.value,
            targetIP: this.targetIPInput.value,
            localIP: this.localIPInput.value,
            listeningPort: this.listeningPortInput.value
        };

        localStorage.setItem('settings', JSON.stringify(settings));

        // Update in-memory values
        this.targetIP = settings.targetIP;
        this.localIP = settings.localIP;
        this.listeningPort = settings.listeningPort;

        // Update HUD
        this.targetIPDisplay.textContent = this.targetIP;
        this.localIPDisplay.textContent = this.localIP;
        this.listeningPortDisplay.textContent = this.listeningPort;

        this.addIntelligenceMessage('✓ Settings saved', 'green');
        this.closeSettings();
    }

    resetSettingsToDefaults() {
        if (!confirm('Reset all settings to defaults?')) return;

        localStorage.removeItem('settings');
        this.loadSettings();
        this.addIntelligenceMessage('✓ Settings reset to defaults', 'green');
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active from all buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`tab-${tabName}`).classList.add('active');

        // Mark button as active
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    async checkOllamaStatus() {
        const ollamaUrl = this.ollamaUrlInput.value;

        try {
            const response = await fetch(`${ollamaUrl}/api/tags`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.ollamaStatusBox.textContent = '✓ Connected - Ollama is healthy';
                this.ollamaStatusBox.classList.add('connected');
                this.ollamaStatusBox.classList.remove('disconnected');
            } else {
                throw new Error('Connection failed');
            }
        } catch (err) {
            this.ollamaStatusBox.textContent = `✗ Disconnected - ${err.message}`;
            this.ollamaStatusBox.classList.remove('connected');
            this.ollamaStatusBox.classList.add('disconnected');
        }
    }

    async refreshOllamaModels() {
        const ollamaUrl = this.ollamaUrlInput.value;
        this.refreshModelsBtn.textContent = '⏳ LOADING...';
        this.refreshModelsBtn.disabled = true;

        try {
            const response = await fetch(`${ollamaUrl}/api/tags`);
            const data = await response.json();

            if (data.models && data.models.length > 0) {
                this.ollamaModelInput.innerHTML = '';
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    this.ollamaModelInput.appendChild(option);
                });
                this.addIntelligenceMessage('✓ Models refreshed from Ollama', 'green');
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to fetch models: ${err.message}`, 'red');
        } finally {
            this.refreshModelsBtn.textContent = '🔄 REFRESH';
            this.refreshModelsBtn.disabled = false;
        }
    }

    // ============================================
    // API CALLS
    // ============================================

    async apiCall(method, endpoint, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, options);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return await response.json();
    }
}

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    window.bot = new KaliHackerBot();

    // Log startup
    console.log('🎯 Kali Hacker Bot initialized');
    console.log('🔐 Authenticate to begin');
});
