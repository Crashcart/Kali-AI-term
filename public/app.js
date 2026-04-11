// ============================================
// KALI HACKER BOT - Frontend Application v2.0
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
        this.commandHistory = [];
        this.historyIndex = -1;
        this.showTimestamps = true;
        this.soundEnabled = true;
        this.ollamaUrl = 'http://localhost:11434';
        this.ollamaModel = 'dolphin-mixtral';
        this.ollamaTemp = 0.7;
        this.aiProvider = 'auto';
        this.aiTaskType = 'default';
        this.panelSplitRatio = 0.5;
        this.quickCmdsCollapsed = false;

        // Plugin system
        this.plugins = new Map();
        this.enabledPlugins = [];
        this.defaultModels = [
            { id: 'dolphin-mixtral', name: 'Dolphin Mixtral', recommended: true },
            { id: 'neural-chat:7b', name: 'Neural Chat 7B', recommended: true }
        ];

        this.initializeElements();
        this.attachEventListeners();
        this.loadUserSettings();
        this.bootSequence();
    }

    initializeElements() {
        // Boot
        this.bootOverlay = document.getElementById('boot-overlay');
        this.bootLogo = document.getElementById('boot-logo');
        this.bootLog = document.getElementById('boot-log');
        this.bootProgressBar = document.getElementById('boot-progress-bar');

        // Streams
        this.intelligenceStream = document.getElementById('intelligence-stream');
        this.wireStream = document.getElementById('wire-stream');
        this.intelPanel = document.getElementById('intel-panel');
        this.wirePanel = document.getElementById('wire-panel');
        this.panelResizer = document.getElementById('panel-resizer');

        // Search
        this.intelSearch = document.getElementById('intel-search');
        this.wireSearch = document.getElementById('wire-search');

        // LEDs
        this.dockerLED = document.getElementById('docker-led');
        this.ollamaLED = document.getElementById('ollama-led');
        this.targetLED = document.getElementById('target-led');
        this.uptimeValue = document.getElementById('uptime-value');

        // HUD
        this.targetIPDisplay = document.getElementById('target-ip');
        this.localIPDisplay = document.getElementById('local-ip');
        this.listeningPortDisplay = document.getElementById('listening-port');
        this.sessionIDDisplay = document.getElementById('session-id');
        this.activeModelDisplay = document.getElementById('active-model');

        // Command
        this.commandInput = document.getElementById('command-input');
        this.commandWrapper = document.getElementById('command-wrapper');
        this.modeIndicator = document.getElementById('mode-indicator');
        this.sendBtn = document.getElementById('send-btn');
        this.killBtn = document.getElementById('kill-btn');
        this.burnBtn = document.getElementById('burn-btn');
        this.autoPilotBtn = document.getElementById('autopilot-btn');
        this.livePipeBtn = document.getElementById('livepipe-btn');

        // Top actions
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.notepadBtn = document.getElementById('notepad-btn');
        this.reportBtn = document.getElementById('report-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.settingsBtn = document.getElementById('settings-btn');

        // Copy buttons
        this.copyIntelBtn = document.getElementById('copy-intel');
        this.copyWireBtn = document.getElementById('copy-wire');

        // Clear buttons
        this.clearIntelBtn = document.getElementById('clear-intel');
        this.clearWireBtn = document.getElementById('clear-wire');

        // Quick commands
        this.quickCommands = document.getElementById('quick-commands');
        this.toggleQcBtn = document.getElementById('toggle-qc');
        this.qcBody = document.getElementById('qc-body');

        // Modals
        this.loginModal = document.getElementById('login-modal');
        this.confirmModal = document.getElementById('confirm-modal');
        this.settingsModal = document.getElementById('settings-modal');
        this.notepadModal = document.getElementById('notepad-modal');

        // Login
        this.loginForm = document.getElementById('login-form');
        this.passwordInput = document.getElementById('password-input');

        // Confirm
        this.commandPreview = document.getElementById('command-preview');
        this.confirmBtn = document.getElementById('confirm-btn');
        this.cancelBtn = document.getElementById('cancel-btn');

        // Settings
        this.ollamaUrlInput = document.getElementById('ollama-url');
        this.ollamaModelInput = document.getElementById('ollama-model');
        this.ollmaTempInput = document.getElementById('ollama-temp');
        this.tempValueDisplay = document.getElementById('temp-value');
        this.ollamaStatusBox = document.getElementById('ollama-status');
        this.geminiStatusBox = document.getElementById('gemini-status');
        this.refreshModelsBtn = document.getElementById('refresh-models');
        this.testOllamaBtn = document.getElementById('test-ollama');
        this.pullModelName = document.getElementById('pull-model-name');
        this.pullModelBtn = document.getElementById('pull-model-btn');
        this.pullProgress = document.getElementById('pull-progress');
        this.systemPromptInput = document.getElementById('system-prompt');
        this.aiProviderSelect = document.getElementById('ai-provider');
        this.aiTaskTypeSelect = document.getElementById('ai-task-type');

        this.targetIPInput = document.getElementById('target-ip-input');
        this.localIPInput = document.getElementById('local-ip-input');
        this.listeningPortInput = document.getElementById('listening-port-input');
        this.targetStatusBox = document.getElementById('target-status');
        this.pingTargetBtn = document.getElementById('ping-target');

        this.installPackages = document.getElementById('install-packages');
        this.installBtn = document.getElementById('install-btn');
        this.installOutput = document.getElementById('install-output');
        this.restartContainerBtn = document.getElementById('restart-container');
        this.resetContainerBtn = document.getElementById('reset-container');
        this.containerInfo = document.getElementById('container-info');

        this.themeSelect = document.getElementById('theme-select');
        this.timestampToggle = document.getElementById('timestamp-toggle');
        this.soundToggle = document.getElementById('sound-toggle');

        // Proxy settings
        this.proxyEnabled = document.getElementById('proxy-enabled');
        this.proxyProtocol = document.getElementById('proxy-protocol');
        this.proxyHost = document.getElementById('proxy-host');
        this.proxyPort = document.getElementById('proxy-port');
        this.proxyUsername = document.getElementById('proxy-username');
        this.proxyPassword = document.getElementById('proxy-password');
        this.proxyBypass = document.getElementById('proxy-bypass');
        this.proxyStatusBox = document.getElementById('proxy-status');
        this.testProxyBtn = document.getElementById('test-proxy');

        this.closeSettingsBtn = document.getElementById('close-settings');
        this.saveSettingsBtn = document.getElementById('save-settings');
        this.resetSettingsBtn = document.getElementById('reset-settings');

        // Notepad
        this.notepadText = document.getElementById('notepad-text');
        this.closeNotepadBtn = document.getElementById('close-notepad');
        this.saveNotepadBtn = document.getElementById('save-notepad');
        this.clearNotepadBtn = document.getElementById('clear-notepad');

        // Plugin management (optional elements)
        this.llmModelSelector = document.getElementById('llm-model-selector');
        this.pluginsList = document.getElementById('plugins-list');
    }

    attachEventListeners() {
        // Command input
        this.commandInput.addEventListener('keydown', (e) => this.handleCommandInput(e));

        // Buttons
        this.sendBtn.addEventListener('click', () => this.executeCommand());
        this.killBtn.addEventListener('click', () => this.killAllProcesses());
        this.burnBtn.addEventListener('click', () => this.burnSession());

        // Toggles
        this.autoPilotBtn.addEventListener('click', () => this.toggleAutoPilot());
        this.livePipeBtn.addEventListener('click', () => this.toggleLivePipe());

        // Clear
        this.clearIntelBtn.addEventListener('click', () => { this.intelligenceStream.innerHTML = ''; });
        this.clearWireBtn.addEventListener('click', () => { this.wireStream.innerHTML = ''; });

        // Copy
        this.copyIntelBtn.addEventListener('click', () => this.copyToClipboard(this.intelligenceStream));
        this.copyWireBtn.addEventListener('click', () => this.copyToClipboard(this.wireStream));

        // Search
        this.intelSearch.addEventListener('input', (e) => this.searchStream(this.intelligenceStream, e.target.value));
        this.wireSearch.addEventListener('input', (e) => this.searchStream(this.wireStream, e.target.value));

        // Top actions
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.notepadBtn.addEventListener('click', () => this.openNotepad());
        this.reportBtn.addEventListener('click', () => this.generateReport());
        this.exportBtn.addEventListener('click', () => this.exportSession());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // Quick commands
        this.toggleQcBtn.addEventListener('click', () => this.toggleQuickCommands());
        document.querySelectorAll('.qc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.getAttribute('data-cmd');
                this.commandInput.value = cmd;
                this.commandInput.focus();
            });
        });

        // Login
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Confirm modal
        this.confirmBtn.addEventListener('click', () => this.executeConfirmedCommand());
        this.cancelBtn.addEventListener('click', () => this.closeConfirmModal());

        // Settings
        this.refreshModelsBtn.addEventListener('click', () => this.refreshOllamaModels());
        this.testOllamaBtn.addEventListener('click', () => this.checkOllamaStatus());
        this.pullModelBtn.addEventListener('click', () => this.pullModel());
        this.ollmaTempInput.addEventListener('input', (e) => {
            this.tempValueDisplay.textContent = (e.target.value / 100).toFixed(2);
        });

        this.pingTargetBtn.addEventListener('click', () => this.pingTarget());
        this.installBtn.addEventListener('click', () => this.installPackages());
        this.restartContainerBtn.addEventListener('click', () => this.restartContainer());
        this.resetContainerBtn.addEventListener('click', () => this.resetContainer());
        this.testProxyBtn.addEventListener('click', () => this.testProxyConnection());

        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettingsToDefaults());

        // Notepad
        this.closeNotepadBtn.addEventListener('click', () => this.closeNotepad());
        this.saveNotepadBtn.addEventListener('click', () => this.saveNotepad());
        this.clearNotepadBtn.addEventListener('click', () => {
            if (confirm('Clear notepad?')) this.notepadText.value = '';
        });

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.target.dataset.tab));
        });

        // Panel resizer
        this.setupPanelResizer();

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalShortcuts(e));

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.loginModal.classList.remove('active');
                this.confirmModal.classList.remove('active');
                this.settingsModal.classList.remove('active');
                this.notepadModal.classList.remove('active');
            }
        });

        // Close modal on background click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettings();
        });
        this.notepadModal.addEventListener('click', (e) => {
            if (e.target === this.notepadModal) this.closeNotepad();
        });

        // HUD inputs
        this.targetIPDisplay.addEventListener('blur', () => this.saveHudVariable('targetIP', this.targetIPDisplay));
        this.localIPDisplay.addEventListener('blur', () => this.saveHudVariable('localIP', this.localIPDisplay));
        this.listeningPortDisplay.addEventListener('blur', () => this.saveHudVariable('listeningPort', this.listeningPortDisplay));
    }

    setupPanelResizer() {
        let isResizing = false;

        this.panelResizer.addEventListener('mousedown', () => {
            isResizing = true;
            this.panelResizer.classList.add('active');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const container = document.getElementById('content-area');
            const rect = container.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            this.panelSplitRatio = Math.max(0.2, Math.min(0.8, ratio));

            this.intelPanel.style.flex = this.panelSplitRatio;
            this.wirePanel.style.flex = 1 - this.panelSplitRatio;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            this.panelResizer.classList.remove('active');
            localStorage.setItem('panelSplitRatio', this.panelSplitRatio);
        });
    }

    handleGlobalShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'l': e.preventDefault(); this.intelligenceStream.innerHTML = ''; break;
                case 'k': e.preventDefault(); this.killAllProcesses(); break;
                case 'n': e.preventDefault(); this.openNotepad(); break;
                case ',': e.preventDefault(); this.openSettings(); break;
            }
        }

        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }
    }

    handleCommandInput(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.historyIndex = Math.min(this.historyIndex + 1, this.commandHistory.length - 1);
            if (this.historyIndex >= 0) {
                this.commandInput.value = this.commandHistory[this.historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.historyIndex = Math.max(this.historyIndex - 1, -1);
            if (this.historyIndex >= 0) {
                this.commandInput.value = this.commandHistory[this.historyIndex];
            } else {
                this.commandInput.value = '';
            }
        }
    }

    // ============================================
    // BOOT SEQUENCE
    // ============================================

    async bootSequence() {
        this.drawBootLogo();
        const bootSteps = [
            { msg: '> Initializing Kali Hacker Bot v1.0...', type: 'info' },
            { msg: '> Loading terminal interface', type: 'info' },
            { msg: '✓ UI components loaded', type: 'ok' },
            { msg: '> Checking authentication', type: 'info' },
            { msg: '✓ Session manager ready', type: 'ok' },
            { msg: '> Connecting to services', type: 'info' },
            { msg: '✓ API endpoints initialized', type: 'ok' },
            { msg: '> Verifying credentials', type: 'info' },
        ];

        for (let i = 0; i < bootSteps.length; i++) {
            const step = bootSteps[i];
            const line = document.createElement('div');
            line.className = `boot-line ${step.type}`;
            line.textContent = step.msg;
            line.style.animationDelay = `${i * 0.2}s`;
            this.bootLog.appendChild(line);

            this.bootProgressBar.style.width = `${((i + 1) / bootSteps.length) * 100}%`;
            await new Promise(r => setTimeout(r, 150));
        }

        await new Promise(r => setTimeout(r, 800));
        this.bootOverlay.classList.add('hidden');
    }

    drawBootLogo() {
        this.bootLogo.textContent = `
 ╔═╗╔═╗╔╗  ╔╗
 ║ ╚╝ ║║║  ║║
 ║ ╔╗ ║║╚╗╔╝║
 ║ ║║ ║║╔╗╔╗║
 ╚═╝╚═╝╚╝╚╝╚╝
 HACKER BOT v1.0
        `;
    }

    startUptimeCounter() {
        setInterval(() => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            this.uptimeValue.textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    checkAuthStatus() {
        if (this.token && this.sessionId) {
            this.showMainApp();
            this.updateUserInfo();
            this.loadUserSettings();
            this.syncOllamaUrlToServer();
            this.initializeSystemStatus();
            this.startUptimeCounter();
        } else {
            this.showLoginModal();
        }
    }

    async login() {
        const password = this.passwordInput.value;

        try {
            const response = await this.apiCall('POST', '/api/auth/login', { password });

            this.token = response.token;
            this.sessionId = response.sessionId;

            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('session_id', this.sessionId);

            this.passwordInput.value = '';
            this.closeLoginModal();
            this.showMainApp();
            this.updateUserInfo();
            this.loadUserSettings();
            this.syncOllamaUrlToServer();
            this.initializeSystemStatus();
            this.startUptimeCounter();
            this.addIntelligenceMessage('🔓 Authentication successful! Welcome to Kali Hacker Bot.', 'green');
        } catch (err) {
            const reportId = await this.submitLoginErrorReport(err);
            this.addIntelligenceMessage(`❌ Authentication failed: ${err.message}`, 'red');
            if (reportId) {
                this.addIntelligenceMessage(`📋 Login error report captured: ${reportId}`, 'yellow');
                this.addIntelligenceMessage('Run ./collect-logs.sh and include this report ID in the issue.', 'yellow');
            }
            this.passwordInput.value = '';
        }
    }

    async submitLoginErrorReport(err) {
        const loginReportId = err?.payload?.reportId || null;
        const payload = {
            message: err?.message || 'Unknown login error',
            status: err?.status || null,
            location: window.location.href,
            timestamp: new Date().toISOString(),
            serverReportId: loginReportId,
        };

        try {
            const reportResponse = await this.apiCall('POST', '/api/auth/login/error-report', payload);
            return reportResponse.reportId || loginReportId;
        } catch (reportErr) {
            console.warn('Failed to submit login error report:', reportErr);
            return loginReportId;
        }
    }

    updateUserInfo() {
        this.sessionIDDisplay.textContent = this.sessionId.slice(0, 8);
    }

    // ============================================
    // SETTINGS & PREFERENCES
    // ============================================

    loadUserSettings() {
        const saved = JSON.parse(localStorage.getItem('userSettings')) || {};

        this.targetIP = saved.targetIP || '192.168.1.100';
        this.localIP = saved.localIP || '192.168.1.50';
        this.listeningPort = saved.listeningPort || '4444';
        this.ollamaUrl = saved.ollamaUrl || 'http://localhost:11434';
        this.ollamaModel = saved.ollamaModel || 'dolphin-mixtral';
        this.ollamaTemp = saved.ollamaTemp || 0.7;
        this.aiProvider = saved.aiProvider || 'auto';
        this.aiTaskType = saved.aiTaskType || 'default';
        this.showTimestamps = saved.showTimestamps !== false;
        this.soundEnabled = saved.soundEnabled !== false;
        this.panelSplitRatio = saved.panelSplitRatio || 0.5;
        this.quickCmdsCollapsed = saved.quickCmdsCollapsed || false;
        this.enabledPlugins = saved.enabledPlugins || ['cve-plugin', 'threat-intel-plugin'];

        // Apply theme
        const theme = saved.theme || 'default';
        if (theme !== 'default') document.body.classList.add(`theme-${theme}`);

        // Apply to UI
        this.targetIPDisplay.value = this.targetIP;
        this.localIPDisplay.value = this.localIP;
        this.listeningPortDisplay.value = this.listeningPort;
        this.activeModelDisplay.textContent = this.ollamaModel;
        this.intelPanel.style.flex = this.panelSplitRatio;
        this.wirePanel.style.flex = 1 - this.panelSplitRatio;

        if (this.quickCmdsCollapsed) {
            this.qcBody.classList.add('collapsed');
        }

        this.loadSessionNotes();
        this.loadCommandHistory();
        this.loadPlugins();
    }

    saveUserSettings() {
        const settings = {
            targetIP: this.targetIP,
            localIP: this.localIP,
            listeningPort: this.listeningPort,
            ollamaUrl: this.ollamaUrl,
            ollamaModel: this.ollamaModel,
            ollamaTemp: this.ollamaTemp,
            aiProvider: this.aiProvider,
            aiTaskType: this.aiTaskType,
            showTimestamps: this.showTimestamps,
            soundEnabled: this.soundEnabled,
            theme: this.themeSelect.value,
            panelSplitRatio: this.panelSplitRatio,
            quickCmdsCollapsed: this.quickCmdsCollapsed,
            enabledPlugins: this.enabledPlugins,
        };

        localStorage.setItem('userSettings', JSON.stringify(settings));
    }

    saveHudVariable(key, element) {
        const value = element.value;
        if (key === 'targetIP') this.targetIP = value;
        else if (key === 'localIP') this.localIP = value;
        else if (key === 'listeningPort') this.listeningPort = value;
        this.saveUserSettings();
    }

    syncOllamaUrlToServer() {
        // Only push a non-default URL — localhost:11434 is already the server default
        if (!this.ollamaUrl || this.ollamaUrl === 'http://localhost:11434') return;
        this.apiCall('POST', '/api/ollama/config', { url: this.ollamaUrl }).catch(err => {
            console.warn('Failed to sync Ollama URL to server on startup:', err.message);
        });
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

            if (response.docker.connected && response.docker.containerRunning) {
                this.dockerLED.classList.add('connected');
                this.dockerLED.classList.remove('disconnected');
            } else {
                this.dockerLED.classList.remove('connected');
                this.dockerLED.classList.add('disconnected');
            }

            this.targetLED.classList.add('connected');
        } catch (err) {
            console.error('Status check error:', err);
        }

        // Update Ollama LED from /api/llm/health
        try {
            const health = await this.apiCall('GET', '/api/llm/health');
            const ollamaOk = health.health?.ollama?.available;
            if (ollamaOk) {
                this.ollamaLED.classList.add('connected');
                this.ollamaLED.classList.remove('disconnected');
            } else {
                this.ollamaLED.classList.remove('connected');
                this.ollamaLED.classList.add('disconnected');
            }
        } catch (err) {
            this.ollamaLED.classList.remove('connected');
            this.ollamaLED.classList.add('disconnected');
        }
    }

    // ============================================
    // COMMAND EXECUTION
    // ============================================

    executeCommand() {
        const input = this.commandInput.value.trim();
        if (!input) return;

        this.commandInput.value = '';
        this.historyIndex = -1;
        this.addToCommandHistory(input);

        let mode = 'auto';
        let command = input;

        if (input.startsWith('!')) {
            mode = 'shell';
            command = input.slice(1).trim();
        } else if (input.startsWith('?')) {
            mode = 'ai';
            command = input.slice(1).trim();
        }

        if (mode === 'ai' || (mode === 'auto' && this.isNaturalLanguage(command))) {
            this.processNaturalLanguage(command);
        } else {
            if (this.livePipe) {
                this.executeDockerCommand(command);
            } else {
                this.showConfirmModal(command);
            }
        }
    }

    addToCommandHistory(cmd) {
        this.commandHistory.unshift(cmd);
        if (this.commandHistory.length > 100) this.commandHistory.pop();
    }

    isNaturalLanguage(input) {
        const nlPatterns = /^(what|how|why|when|where|can|find|scan|test|check|enumerate|exploit|analyze|search|tell|explain|show|list|get|describe|identify)/i;
        return nlPatterns.test(input);
    }

    async processNaturalLanguage(query) {
        this.addIntelligenceMessage(`🧠 Processing: "${query}"`, 'cyan');
        this.addIntelligenceMessage('⏳ AI is thinking...', 'cyan');
        document.getElementById('main-container').classList.add('thinking');

        const useOrchestrator = this.aiProvider === 'auto';
        const endpoint = useOrchestrator ? '/api/ollama/stream' : '/api/llm/stream';
        const body = useOrchestrator
            ? {
                prompt: query,
                model: this.ollamaModel,
                temperature: this.ollamaTemp,
                systemPrompt: document.getElementById('system-prompt').value || undefined,
                useOrchestrator: true,
                taskType: this.aiTaskType,
            }
            : {
                prompt: query,
                temperature: this.ollamaTemp,
                systemPrompt: document.getElementById('system-prompt').value || undefined,
                preferredProvider: this.aiProvider,
                taskType: this.aiTaskType,
            };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';
            let lastProvider = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.error) {
                            this.addIntelligenceMessage(`❌ AI Error: ${data.error}`, 'red');
                        } else if (data.done) {
                            if (data.provider && data.provider !== lastProvider) {
                                this.addIntelligenceMessage(`[${data.provider}]`, 'cyan', true);
                            }
                        } else if (data.token) {
                            if (data.provider && data.provider !== lastProvider) {
                                lastProvider = data.provider;
                            }
                            fullResponse += data.token;
                            this.addIntelligenceMessage(data.token, 'green', true);
                        }
                    } catch (e) { }
                }
            }

            document.getElementById('main-container').classList.remove('thinking');
            this.addIntelligenceMessage('\n✓ Response complete', 'green');
            if (this.autoPilot && fullResponse.length > 0) {
                this.suggestNextCommand(fullResponse);
            }
        } catch (err) {
            document.getElementById('main-container').classList.remove('thinking');
            this.addIntelligenceMessage(`❌ AI Error: ${err.message}`, 'red');
            this.playSound('error');
        }
    }

    async executeDockerCommand(command) {
        this.addWireMessage(`$ ${command}`, 'green');
        this.addWireMessage('⏳ Executing...', 'grey');

        try {
            const response = await this.apiCall('POST', '/api/docker/exec', { command });

            if (response.success) {
                const output = response.output || '(no output)';
                if (output) this.addWireMessage(output, 'grey');

                if (response.timedOut) {
                    this.addWireMessage('⏱ Command timed out', 'yellow');
                } else {
                    this.addWireMessage('✓ Command completed', 'green');
                }

                if (this.autoPilot) {
                    this.analyzeCommandOutput(command, output);
                }

                this.highlightOutput(output);
            }
        } catch (err) {
            this.addWireMessage(`❌ Error: ${err.message}`, 'red');
            this.playSound('error');
        }
    }

    highlightOutput(output) {
        // Detect IPs, ports, CVEs, credentials in output
        const ipPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
        const portPattern = /(\d+\/tcp|\d+\/udp)/g;
        const cvePattern = /(CVE-\d{4}-\d{4,})/gi;

        if (ipPattern.test(output)) {
            this.addIntelligenceMessage('🔍 Detected target addresses in output', 'cyan');
        }
        if (portPattern.test(output)) {
            this.addIntelligenceMessage('🔓 Detected open ports - consider enum next', 'cyan');
        }
        if (cvePattern.test(output)) {
            this.addIntelligenceMessage('⚠️ Detected CVEs - use CVE lookup for details', 'warning');
        }
    }

    async analyzeCommandOutput(command, output) {
        const analysisPrompt = `Analyze this penetration test output:
Command: ${command}
Output: ${output.slice(0, 1000)}...

Provide: 1) Key findings 2) Security implications 3) Next recommended command`;

        this.addIntelligenceMessage('🤖 Auto-Pilot analyzing...', 'cyan');

        try {
            const response = await this.apiCall('POST', '/api/ollama/generate', {
                prompt: analysisPrompt,
                model: this.ollamaModel,
                temperature: this.ollamaTemp,
                useOrchestrator: this.aiProvider === 'auto',
                taskType: this.aiTaskType,
            });

            if (response.response) {
                this.addIntelligenceMessage(response.response, 'green');
            }
        } catch (err) {
            console.error('Analysis error:', err);
        }
    }

    async suggestNextCommand(output) {
        const prompt = `Based on this information, suggest the next tactical penetration testing command:
${output.slice(0, 500)}

Format: <one-liner command suggestion>`;

        try {
            const response = await this.apiCall('POST', '/api/ollama/generate', {
                prompt: prompt,
                model: this.ollamaModel,
                useOrchestrator: this.aiProvider === 'auto',
                taskType: this.aiTaskType,
            });

            this.commandInput.placeholder = `Suggested: ${response.response.slice(0, 60)}...`;
        } catch (err) { }
    }

    // ============================================
    // KILL & BURN
    // ============================================

    async killAllProcesses() {
        if (!confirm('Kill ALL processes in Kali container?')) return;

        this.addWireMessage('⏹ KILL SWITCH ACTIVATED', 'red');

        try {
            await this.apiCall('POST', '/api/docker/killall');
            this.addWireMessage('✓ All processes terminated', 'red');
            this.targetLED.classList.remove('connected');
            this.playSound('success');
        } catch (err) {
            this.addWireMessage(`❌ Kill failed: ${err.message}`, 'red');
        }
    }

    async burnSession() {
        if (!confirm('🔥 BURN ENTIRE SESSION?\n\n- Clear all streams\n- Reset Docker\n- Clear browser cache\n- Wipe local storage\n\nContinue?')) {
            return;
        }

        this.addWireMessage('🔥 BURNING SESSION...', 'yellow');
        this.addIntelligenceMessage('🔥 Purging all traces...', 'red');

        try {
            await this.apiCall('POST', '/api/docker/reset');

            setTimeout(() => {
                localStorage.clear();
                sessionStorage.clear();

                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                }

                this.playSound('success');
                setTimeout(() => location.reload(), 1000);
            }, 500);
        } catch (err) {
            this.addWireMessage(`❌ Burn failed: ${err.message}`, 'red');
        }
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
        this.modeIndicator.textContent = this.livePipe ? '⚡' : '›';
        this.modeIndicator.title = this.livePipe ? 'Mode: Direct Execution' : 'Mode: Confirmation Required';

        if (this.livePipe) {
            this.livePipeBtn.classList.add('active');
            this.addIntelligenceMessage('✓ Live-Pipe ENABLED - Direct execution mode', 'green');
        } else {
            this.livePipeBtn.classList.remove('active');
            this.addIntelligenceMessage('✗ Live-Pipe DISABLED - Confirmation required', 'yellow');
        }
    }

    toggleQuickCommands() {
        this.quickCmdsCollapsed = !this.quickCmdsCollapsed;
        this.qcBody.classList.toggle('collapsed');
        this.saveUserSettings();
    }

    // ============================================
    // MODALS
    // ============================================

    showLoginModal() {
        this.loginModal.classList.add('active');
        this.passwordInput.focus();
    }

    closeLoginModal() {
        this.loginModal.classList.remove('active');
    }

    showMainApp() {
        this.loginModal.classList.remove('active');
        this.commandInput.focus();
    }

    openSettings() {
        this.loadSettings();
        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    async loadSettings() {
        // Sync Ollama URL from server so the input reflects what the server is actually using
        try {
            const config = await this.apiCall('GET', '/api/ollama/config');
            if (config.url) {
                this.ollamaUrl = config.url;
            }
        } catch (err) {
            console.warn('Could not fetch Ollama config from server:', err.message);
        }

        this.ollamaUrlInput.value = this.ollamaUrl;
        this.ollamaModelInput.value = this.ollamaModel;
        this.ollmaTempInput.value = this.ollamaTemp * 100;
        this.tempValueDisplay.textContent = this.ollamaTemp.toFixed(2);
        this.targetIPInput.value = this.targetIP;
        this.localIPInput.value = this.localIP;
        this.listeningPortInput.value = this.listeningPort;
        this.themeSelect.value = document.body.className.replace('theme-', '') || 'default';
        this.timestampToggle.value = this.showTimestamps ? 'true' : 'false';
        this.soundToggle.value = this.soundEnabled ? 'true' : 'false';
        if (this.aiProviderSelect) this.aiProviderSelect.value = this.aiProvider;
        if (this.aiTaskTypeSelect) this.aiTaskTypeSelect.value = this.aiTaskType;

        // Load proxy settings
        this.loadProxySettings();

        this.checkOllamaStatus();
        this.loadContainerInfo();
    }

    loadProxySettings() {
        const proxySettings = JSON.parse(localStorage.getItem('proxySettings') || '{"enabled":false,"protocol":"http","host":"","port":"8080","username":"","password":"","bypass":""}');
        this.proxyEnabled.value = proxySettings.enabled ? 'true' : 'false';
        this.proxyProtocol.value = proxySettings.protocol || 'http';
        this.proxyHost.value = proxySettings.host || '';
        this.proxyPort.value = proxySettings.port || '8080';
        this.proxyUsername.value = proxySettings.username || '';
        this.proxyPassword.value = '';
        this.proxyBypass.value = proxySettings.bypass || '';
    }

    saveSettings() {
        this.ollamaUrl = this.ollamaUrlInput.value.trim();
        this.ollamaModel = this.ollamaModelInput.value;
        this.ollamaTemp = parseInt(this.ollmaTempInput.value) / 100;
        this.targetIP = this.targetIPInput.value;
        this.localIP = this.localIPInput.value;
        this.listeningPort = this.listeningPortInput.value;
        this.showTimestamps = this.timestampToggle.value === 'true';
        this.soundEnabled = this.soundToggle.value === 'true';
        if (this.aiProviderSelect) this.aiProvider = this.aiProviderSelect.value;
        if (this.aiTaskTypeSelect) this.aiTaskType = this.aiTaskTypeSelect.value;

        // Apply theme
        const theme = this.themeSelect.value;
        document.body.className = theme !== 'default' ? `theme-${theme}` : '';

        this.targetIPDisplay.value = this.targetIP;
        this.localIPDisplay.value = this.localIP;
        this.listeningPortDisplay.value = this.listeningPort;
        this.activeModelDisplay.textContent = this.ollamaModel;

        // Sync Ollama URL to server so health checks and AI calls use the correct host
        this.apiCall('POST', '/api/ollama/config', { url: this.ollamaUrl }).catch(err => {
            console.warn('Failed to sync Ollama URL to server:', err.message);
        });

        // Save proxy settings
        this.saveProxySettings();

        this.saveUserSettings();
        this.addIntelligenceMessage('✓ Settings saved', 'green');
        this.closeSettings();
    }

    saveProxySettings() {
        const proxySettings = {
            enabled: this.proxyEnabled.value === 'true',
            protocol: this.proxyProtocol.value,
            host: this.proxyHost.value,
            port: this.proxyPort.value,
            username: this.proxyUsername.value,
            bypass: this.proxyBypass.value
        };

        localStorage.setItem('proxySettings', JSON.stringify(proxySettings));

        // Also save to backend
        this.apiCall('/api/proxy/config', 'POST', {
            enabled: proxySettings.enabled,
            protocol: proxySettings.protocol,
            host: proxySettings.host,
            port: proxySettings.port,
            username: proxySettings.username,
            password: this.proxyPassword.value,
            bypass: proxySettings.bypass
        }).catch(err => {
            console.warn('Failed to save proxy config to backend:', err);
        });
    }

    async testProxyConnection() {
        this.proxyStatusBox.textContent = '⏳ Testing...';
        try {
            const response = await this.apiCall('/api/proxy/test', 'POST', {});
            if (response.success) {
                this.proxyStatusBox.textContent = `✓ ${response.message} (latency: ${response.latency || 'N/A'}ms)`;
                this.proxyStatusBox.style.color = '#0f0';
            } else {
                this.proxyStatusBox.textContent = `✗ ${response.error || response.message}`;
                this.proxyStatusBox.style.color = '#f00';
            }
        } catch (err) {
            this.proxyStatusBox.textContent = `✗ Connection failed: ${err.message}`;
            this.proxyStatusBox.style.color = '#f00';
        }
    }

    resetSettingsToDefaults() {
        if (!confirm('Reset all settings to defaults?')) return;

        localStorage.removeItem('userSettings');
        location.reload();
    }

    switchSettingsTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        document.getElementById(`tab-${tabName}`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Load plugins UI when switching to plugins tab
        if (tabName === 'plugins') {
            this.loadPluginsUI();
        }
    }

    // ============================================
    // PLUGIN MANAGEMENT
    // ============================================

    async loadPlugins() {
        try {
            const response = await this.apiCall('GET', '/api/plugins');
            if (response.success) {
                this.enabledPlugins = response.plugins.filter(p => p.enabled).map(p => p.name);
                this.plugins.clear();
                response.plugins.forEach(p => {
                    this.plugins.set(p.name, p);
                });
                return response.plugins;
            }
        } catch (err) {
            console.error('Failed to load plugins:', err);
        }
        return [];
    }

    async loadPluginsUI() {
        const plugins = await this.loadPlugins();
        if (!this.pluginsList) return;

        this.pluginsList.innerHTML = '';
        plugins.forEach(plugin => {
            const div = document.createElement('div');
            div.className = 'plugin-item';
            div.innerHTML = `
                <label class="plugin-toggle">
                    <input type="checkbox" data-plugin="${plugin.name}" ${plugin.enabled ? 'checked' : ''}>
                    <span class="plugin-name">${plugin.name}</span>
                </label>
                <span class="plugin-desc">${plugin.description}</span>
            `;

            const checkbox = div.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => this.togglePlugin(plugin.name, e.target.checked));

            this.pluginsList.appendChild(div);
        });

        // Load LLM selector
        this.loadLLMSelector();
    }

    async togglePlugin(name, enabled) {
        try {
            const endpoint = enabled ? `/api/plugins/enable/${name}` : `/api/plugins/disable/${name}`;
            const response = await this.apiCall('POST', endpoint);
            if (response.success) {
                this.addIntelligenceMessage(`✓ Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`, 'green');
                if (enabled) {
                    this.enabledPlugins.push(name);
                } else {
                    this.enabledPlugins = this.enabledPlugins.filter(p => p !== name);
                }
                this.saveUserSettings();
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to toggle plugin: ${err.message}`, 'red');
        }
    }

    async loadLLMSelector() {
        if (!this.llmModelSelector) return;

        try {
            const response = await this.apiCall('GET', '/api/llm/models');
            const allModels = response.models || {};

            this.llmModelSelector.innerHTML = '';

            // Group models by provider
            const providerGroups = {
                ollama: allModels.ollama || [],
                gemini: allModels.gemini || [],
            };

            // Add default recommended models under Ollama if Ollama group is empty
            const ollamaNames = new Set((providerGroups.ollama).map(m => (typeof m === 'string' ? m : m.name)));
            const defaultsToAdd = this.defaultModels.filter(m => !ollamaNames.has(m.id));

            Object.entries(providerGroups).forEach(([provider, models]) => {
                const group = document.createElement('optgroup');
                group.label = provider.charAt(0).toUpperCase() + provider.slice(1);

                if (provider === 'ollama') {
                    defaultsToAdd.forEach(m => {
                        const option = document.createElement('option');
                        option.value = m.id;
                        option.textContent = `${m.name}${m.recommended ? ' ⭐' : ''}`;
                        group.appendChild(option);
                    });
                }

                models.forEach(m => {
                    const modelId = typeof m === 'string' ? m : m.name;
                    const option = document.createElement('option');
                    option.value = modelId;
                    option.textContent = modelId;
                    group.appendChild(option);
                });

                if (group.children.length > 0) {
                    this.llmModelSelector.appendChild(group);
                }
            });

            this.llmModelSelector.value = this.ollamaModel;
            this.llmModelSelector.addEventListener('change', (e) => this.selectModel(e.target.value));
        } catch (err) {
            console.error('Failed to load LLM models:', err);
        }
    }

    selectModel(modelId) {
        this.ollamaModel = modelId;
        this.activeModelDisplay.textContent = modelId;
        this.saveUserSettings();
        this.addIntelligenceMessage(`✓ Switched to ${modelId}`, 'green');
    }

    async checkOllamaStatus() {
        const url = this.ollamaUrlInput?.value?.trim() || this.ollamaUrl;
        this.ollamaStatusBox.textContent = '⏳ Testing connection...';
        this.ollamaStatusBox.classList.remove('connected', 'disconnected');

        try {
            const result = await this.apiCall('GET', `/api/ollama/status?url=${encodeURIComponent(url)}`);

            if (result.connected) {
                const modelList = result.models && result.models.length > 0
                    ? `Models: ${result.models.join(', ')}`
                    : 'No models installed';
                this.ollamaStatusBox.textContent = [
                    `✓ Connected`,
                    `URL: ${result.url}`,
                    `${result.modelCount} model(s) available`,
                    modelList
                ].join('\n');
                this.ollamaStatusBox.classList.add('connected');
                this.ollamaStatusBox.classList.remove('disconnected');
            } else {
                const lines = [
                    `✗ Disconnected`,
                    `URL: ${result.url}`,
                    `Error: ${result.error}`
                ];
                if (result.errorCode) lines.push(`Code: ${result.errorCode}`);
                if (result.httpStatus) lines.push(`HTTP Status: ${result.httpStatus}`);
                if (result.suggestion) lines.push(`Tip: ${result.suggestion}`);
                this.ollamaStatusBox.textContent = lines.join('\n');
                this.ollamaStatusBox.classList.remove('connected');
                this.ollamaStatusBox.classList.add('disconnected');
            }

            // Keep Gemini status updated via the /api/llm/health fallback
            if (this.geminiStatusBox) {
                try {
                    const health = await this.apiCall('GET', '/api/llm/health');
                    const gemini = (health.health || {}).gemini;
                    if (gemini && gemini.available) {
                        const geminiModel = (gemini.models || [])[0] || 'gemini';
                        this.geminiStatusBox.textContent = `✓ Connected — ${geminiModel}`;
                        this.geminiStatusBox.classList.add('connected');
                        this.geminiStatusBox.classList.remove('disconnected');
                    } else {
                        this.geminiStatusBox.textContent = '✗ Not configured — add GEMINI_API_KEY to server environment';
                        this.geminiStatusBox.classList.remove('connected');
                        this.geminiStatusBox.classList.add('disconnected');
                    }
                } catch (_) { }
            }
        } catch (err) {
            this.ollamaStatusBox.textContent = [
                `✗ Status check failed`,
                `Error: ${err.message}`,
                `Tip: Ensure the server is running and you are authenticated.`
            ].join('\n');
            this.ollamaStatusBox.classList.remove('connected');
            this.ollamaStatusBox.classList.add('disconnected');
        }
    }

    async refreshOllamaModels() {
        const url = this.ollamaUrlInput?.value?.trim() || this.ollamaUrl;
        this.refreshModelsBtn.textContent = '⏳';
        this.refreshModelsBtn.disabled = true;

        try {
            const response = await this.apiCall('GET', `/api/ollama/models?url=${encodeURIComponent(url)}`);
            const models = response.models || [];
            if (models.length > 0) {
                this.ollamaModelInput.innerHTML = '';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    this.ollamaModelInput.appendChild(option);
                });
                this.addIntelligenceMessage('✓ Models refreshed', 'green');
            } else {
                this.addIntelligenceMessage('⚠ No models found at that URL', 'yellow');
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to fetch models: ${err.message}`, 'red');
        } finally {
            this.refreshModelsBtn.textContent = '🔄';
            this.refreshModelsBtn.disabled = false;
        }
    }

    async pullModel() {
        const modelName = this.pullModelName.value.trim();
        if (!modelName) {
            this.pullProgress.textContent = 'Enter model name';
            return;
        }

        this.pullProgress.textContent = `⏳ Pulling ${modelName}...`;

        try {
            const response = await fetch('/api/ollama/pull', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                },
                body: JSON.stringify({ model: modelName }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const json = JSON.parse(line.slice(6));
                        if (json.status === 'success') {
                            this.pullProgress.textContent = `✓ ${modelName} pulled successfully`;
                            this.pullModelName.value = '';
                            this.refreshOllamaModels();
                        } else if (json.error) {
                            this.pullProgress.textContent = `❌ ${json.error}`;
                        } else if (json.status) {
                            this.pullProgress.textContent = `⏳ ${json.status}`;
                        }
                    } catch (e) { }
                }
            }
        } catch (err) {
            this.pullProgress.textContent = `❌ ${err.message}`;
        }
    }

    async pingTarget() {
        const target = this.targetIPInput.value.trim();
        if (!target) {
            this.targetStatusBox.textContent = 'Enter target IP first';
            return;
        }

        this.targetStatusBox.textContent = `⏳ Pinging ${target}...`;

        try {
            const response = await this.apiCall('POST', '/api/docker/exec', {
                command: `ping -c 4 ${target} 2>&1 | tail -5`,
                timeout: 10000,
            });

            this.targetStatusBox.textContent = response.output || '(no output)';
            this.targetStatusBox.classList.add('connected');
        } catch (err) {
            this.targetStatusBox.textContent = `❌ ${err.message}`;
            this.targetStatusBox.classList.add('disconnected');
        }
    }

    async installPackages() {
        const packages = this.installPackages.value.trim().split(/\s+/);
        if (packages.length === 0 || packages[0] === '') {
            this.installOutput.textContent = 'Enter package names';
            return;
        }

        this.installOutput.style.display = 'block';
        this.installOutput.textContent = `⏳ Installing ${packages.join(', ')}...`;
        this.installBtn.disabled = true;

        try {
            const response = await this.apiCall('POST', '/api/docker/install', { packages });
            this.installOutput.textContent = response.output;
            this.addIntelligenceMessage(`✓ Installed: ${packages.join(', ')}`, 'green');
        } catch (err) {
            this.installOutput.textContent = `❌ ${err.message}`;
            this.addIntelligenceMessage(`❌ Install failed: ${err.message}`, 'red');
        } finally {
            this.installBtn.disabled = false;
        }
    }

    async restartContainer() {
        if (!confirm('Restart Kali container?')) return;

        try {
            await this.apiCall('POST', '/api/docker/restart');
            this.addIntelligenceMessage('✓ Container restarting...', 'green');
            this.loadContainerInfo();
        } catch (err) {
            this.addIntelligenceMessage(`❌ Restart failed: ${err.message}`, 'red');
        }
    }

    async resetContainer() {
        if (!confirm('Factory reset Kali container? This cannot be undone!')) return;

        try {
            await this.apiCall('POST', '/api/docker/reset');
            this.addIntelligenceMessage('✓ Container reset to clean state', 'green');
            this.loadContainerInfo();
        } catch (err) {
            this.addIntelligenceMessage(`❌ Reset failed: ${err.message}`, 'red');
        }
    }

    async loadContainerInfo() {
        try {
            const response = await this.apiCall('GET', '/api/docker/status');
            this.containerInfo.textContent = `Image: ${response.image}\nState: ${response.state}\nUptime: ${new Date(response.uptime).toLocaleString()}`;
        } catch (err) {
            this.containerInfo.textContent = `Error: ${err.message}`;
        }
    }

    // ============================================
    // NOTEPAD
    // ============================================

    openNotepad() {
        this.notepadModal.classList.add('active');
        this.notepadText.focus();
    }

    closeNotepad() {
        this.notepadModal.classList.remove('active');
    }

    async loadSessionNotes() {
        try {
            const response = await this.apiCall('GET', '/api/session/notes');
            this.notepadText.value = response.notes || '';
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    }

    async saveNotepad() {
        try {
            await this.apiCall('POST', '/api/session/notes', {
                notes: this.notepadText.value,
            });
            this.addIntelligenceMessage('✓ Notepad saved', 'green');
        } catch (err) {
            this.addIntelligenceMessage(`❌ Save failed: ${err.message}`, 'red');
        }
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    async loadCommandHistory() {
        try {
            const response = await this.apiCall('GET', '/api/session/history');
            this.commandHistory = response.history.map(h => h.command);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    }

    async exportSession() {
        try {
            const response = await this.apiCall('GET', '/api/session/export');
            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pentest-session-${Date.now()}.json`;
            a.click();
            this.addIntelligenceMessage('✓ Session exported', 'green');
        } catch (err) {
            this.addIntelligenceMessage(`❌ Export failed: ${err.message}`, 'red');
        }
    }

    async generateReport() {
        try {
            this.addIntelligenceMessage('📋 Generating report...', 'cyan');

            // Show format selection dialog
            const format = await this.promptReportFormat();
            if (!format) return;

            // Generate report
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    format: format,
                    includeCommandHistory: true,
                    includeCVEs: true
                })
            });

            if (!response.ok) {
                throw new Error(`Report generation failed: ${response.statusText}`);
            }

            // Download the report
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const ext = format === 'json' ? 'json' : format === 'html' ? 'html' : 'md';
            a.download = `pentest-report-${Date.now()}.${ext}`;
            a.click();

            this.addIntelligenceMessage(`✓ Report generated (${format})`, 'green');
        } catch (err) {
            this.addIntelligenceMessage(`❌ Report generation failed: ${err.message}`, 'red');
        }
    }

    promptReportFormat() {
        return new Promise((resolve) => {
            const formats = ['HTML', 'JSON', 'Markdown'];
            let html = '<div style="padding: 10px;">';
            html += '<p style="margin-bottom: 15px;">Select report format:</p>';
            html += '<div style="display: flex; gap: 10px;">';
            formats.forEach(fmt => {
                html += `<button class="report-fmt-btn" data-fmt="${fmt.toLowerCase()}" style="flex: 1; padding: 10px; border: 1px solid #0f0; background: #000; color: #0f0; cursor: pointer; border-radius: 4px;">${fmt}</button>`;
            });
            html += '</div></div>';

            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #000; border: 2px solid #0f0; padding: 20px; z-index: 10000; min-width: 300px; box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);';
            modal.innerHTML = html;
            document.body.appendChild(modal);

            const buttons = modal.querySelectorAll('.report-fmt-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const format = btn.getAttribute('data-fmt');
                    modal.remove();
                    resolve(format);
                });
            });
        });
    }

    // ============================================
    // UTILITIES
    // ============================================

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    copyToClipboard(element) {
        const text = element.innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.addIntelligenceMessage('✓ Copied to clipboard', 'green');
        });
    }

    searchStream(stream, query) {
        const lines = stream.querySelectorAll('.line');
        lines.forEach(line => {
            line.classList.remove('search-highlight');
            if (query && line.textContent.toLowerCase().includes(query.toLowerCase())) {
                line.classList.add('search-highlight');
            }
        });
    }

    playSound(type) {
        if (!this.soundEnabled) return;

        // Simple beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'success') {
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } else if (type === 'error') {
            oscillator.frequency.value = 400;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        }
    }

    showConfirmModal(command) {
        this.commandPreview.textContent = `$ ${command}`;
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
        // Handle null/undefined values
        if (!message) return;
        
        const timestamp = this.showTimestamps ? `[${new Date().toLocaleTimeString()}] ` : '';
        const span = document.createElement('span');
        span.className = color;
        span.textContent = String(message);

        if (append) {
            const lastLine = this.intelligenceStream.lastChild;
            if (lastLine && lastLine.classList.contains('line')) {
                lastLine.appendChild(span);
                return;
            }
        }

        const line = document.createElement('div');
        line.className = 'line';
        if (timestamp) {
            const ts = document.createElement('span');
            ts.className = 'timestamp';
            ts.textContent = timestamp;
            line.appendChild(ts);
        }
        line.appendChild(span);
        this.intelligenceStream.appendChild(line);
        this.intelligenceStream.scrollTop = this.intelligenceStream.scrollHeight;
    }

    addWireMessage(message, color = 'grey') {
        // Handle null/undefined values
        if (!message) return;
        
        const timestamp = this.showTimestamps ? `[${new Date().toLocaleTimeString()}] ` : '';
        const span = document.createElement('span');
        span.className = color;
        span.textContent = message;

        const line = document.createElement('div');
        line.className = 'line';
        if (timestamp) {
            const ts = document.createElement('span');
            ts.className = 'timestamp';
            ts.textContent = timestamp;
            line.appendChild(ts);
        }
        line.appendChild(span);
        this.wireStream.appendChild(line);
        this.wireStream.scrollTop = this.wireStream.scrollHeight;
    }

    // ============================================
    // API CALLS
    // ============================================

    async apiCall(methodOrEndpoint, endpointOrMethod, data = null) {
        let method = methodOrEndpoint;
        let endpoint = endpointOrMethod;

        // Backwards compatibility for legacy call order: apiCall(endpoint, method, data)
        if (typeof methodOrEndpoint === 'string' && methodOrEndpoint.startsWith('/')) {
            endpoint = methodOrEndpoint;
            method = endpointOrMethod || 'GET';
        }

        if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) {
            throw new Error('Invalid API endpoint');
        }

        const options = {
            method: String(method || 'GET').toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (this.token) {
            options.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, options);
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await response.json()
            : { message: await response.text() };

        if (!response.ok) {
            const err = new Error(payload.error || payload.message || `HTTP ${response.status}`);
            err.status = response.status;
            err.payload = payload;
            throw err;
        }

        return payload;
    }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Add axios for streaming
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axios/1.6.0/axios.min.js';
    document.head.appendChild(script);

    script.onload = () => {
        window.bot = new KaliHackerBot();
        window.bot.checkAuthStatus();
    };
});
