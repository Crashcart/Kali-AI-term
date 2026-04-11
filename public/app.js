// ============================================
// KALI HACKER BOT - Frontend Application v2.0
// ============================================

class KaliHackerBot {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.sessionId = localStorage.getItem('session_id');
        this.autoPilot = false;
        this.livePipe = false;
        this.autonomousRunning = false;
        this.autonomousAbort = false;
        this.targetIP = '192.168.1.100';
        this.localIP = '192.168.1.50';
        this.listeningPort = 4444;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.showTimestamps = true;
        this.soundEnabled = true;
        this.ollamaUrl = 'http://localhost:11434';
        this.ollamaModel = 'phi3:mini';
        this.ollamaTemp = 0.7;
        this.aiProvider = 'auto';
        this.aiTaskType = 'default';
        this.panelSplitRatio = 0.5;
        this.quickCmdsCollapsed = false;

        // Plugin system
        this.plugins = new Map();
        this.enabledPlugins = [];
        this.defaultModels = [
            { id: 'phi3:mini', name: 'Phi-3 Mini (lightweight, ~2.2 GiB)', recommended: true },
            { id: 'tinyllama', name: 'TinyLlama (~637 MiB)', recommended: true },
            { id: 'llama3.2:3b', name: 'Llama 3.2 3B (~2 GiB)', recommended: true },
            { id: 'dolphin-mixtral', name: 'Dolphin Mixtral (requires ~24.8 GiB RAM)', recommended: false },
            { id: 'neural-chat:7b', name: 'Neural Chat 7B', recommended: false }
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
        this.geminiLED = document.getElementById('gemini-led');
        this.uptimeValue = document.getElementById('uptime-value');

        // HUD
        this.targetIPDisplay = document.getElementById('target-ip');
        this.localIPDisplay = document.getElementById('local-ip');
        this.listeningPortDisplay = document.getElementById('listening-port');
        this.sessionIDDisplay = document.getElementById('session-id');
        this.activeModelDisplay = document.getElementById('active-model');

        // Command (shell)
        this.commandInput = document.getElementById('command-input');
        this.commandWrapper = document.getElementById('cmd-wrapper');
        this.modeIndicator = null;   // removed — each row has its own fixed mode
        this.sendBtn = document.getElementById('send-btn');
        this.killBtn = document.getElementById('kill-btn');
        this.burnBtn = null;        // removed from UI
        this.attackBtn = document.getElementById('attack-btn');
        this.autoPilotBtn = null;   // removed from UI
        this.livePipeBtn = null;    // removed from UI

        // Chat input (AI)
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send-btn');

        // LLM log modal
        this.llmLogBtn = document.getElementById('llm-log-btn');
        this.llmLogModal = document.getElementById('llm-log-modal');
        this.llmLogStream = document.getElementById('llm-log-stream');
        this.llmLogSummary = document.getElementById('llm-log-summary');
        this.closeLLMLogBtn = document.getElementById('close-llm-log');
        this.refreshLLMLogBtn = document.getElementById('refresh-llm-log-btn');
        this.clearLLMLogBtn = document.getElementById('clear-llm-log-btn');
        this.llmLogAutoRefresh = document.getElementById('llm-log-autorefresh');
        this._llmLogTimer = null;

        // Top actions
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.notepadBtn = null;     // removed from UI
        this.reportBtn = null;      // removed from UI
        this.exportBtn = null;      // removed from UI
        this.settingsBtn = document.getElementById('settings-btn');

        // Copy buttons
        this.copyIntelBtn = document.getElementById('copy-intel');
        this.copyWireBtn = document.getElementById('copy-wire');

        // Clear buttons
        this.clearIntelBtn = document.getElementById('clear-intel');
        this.clearWireBtn = document.getElementById('clear-wire');

        // Quick commands (removed from UI)
        this.quickCommands = null;
        this.toggleQcBtn = null;
        this.qcBody = null;

        // Hosts modal
        this.hostsModal = document.getElementById('hosts-modal');
        this.hostsBtn = document.getElementById('hosts-btn');
        this.hostsList = document.getElementById('hosts-list');

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
        this.ollamaModelInput = document.getElementById('ollama-model');
        this.ollmaTempInput = document.getElementById('ollama-temp');
        this.tempValueDisplay = document.getElementById('temp-value');
        this.ollamaStatusBox = document.getElementById('ollama-status');
        this.geminiStatusBox = document.getElementById('gemini-status');
        this.geminiApiKeyInput = document.getElementById('gemini-api-key');
        this.geminiModelInput = document.getElementById('gemini-model');
        this.saveGeminiBtn = document.getElementById('save-gemini-btn');
        this.refreshModelsBtn = document.getElementById('refresh-models');
        this.pullModelName = document.getElementById('pull-model-name');
        this.pullModelBtn = document.getElementById('pull-model-btn');
        this.pullProgress = document.getElementById('pull-progress');
        this.systemPromptInput = document.getElementById('system-prompt');
        this.aiProviderSelect = document.getElementById('ai-provider');
        this.aiTaskTypeSelect = document.getElementById('ai-task-type');

        // Multi-instance Ollama
        this.ollamaInstancesList = document.getElementById('ollama-instances-list');
        this.newOllamaHostInput = document.getElementById('new-ollama-host');
        this.newOllamaPortInput = document.getElementById('new-ollama-port');
        this.addOllamaInstanceBtn = document.getElementById('add-ollama-instance-btn');

        // Network scan
        this.networkScanToggle = document.getElementById('network-scan-toggle');
        this.scanOllamaBtn = document.getElementById('scan-ollama-btn');
        this.scanResults = document.getElementById('scan-results');

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
        // Shell command input (CMD row)
        this.commandInput.addEventListener('keydown', (e) => this.handleCommandInput(e));

        // Chat / AI input (CHAT row)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.executeChatInput(); }
        });

        // Buttons
        this.sendBtn.addEventListener('click', () => this.executeCommand());
        this.chatSendBtn.addEventListener('click', () => this.executeChatInput());
        this.killBtn.addEventListener('click', () => this.killAllProcesses());
        this.attackBtn.addEventListener('click', () => this.startAutonomousAttack(this.targetIP));

        // LLM log modal
        if (this.llmLogBtn) {
            this.llmLogBtn.addEventListener('click', () => this.openLLMLog());
        }
        if (this.closeLLMLogBtn) {
            this.closeLLMLogBtn.addEventListener('click', () => this.closeLLMLog());
        }
        if (this.refreshLLMLogBtn) {
            this.refreshLLMLogBtn.addEventListener('click', () => this.fetchLLMLog());
        }
        if (this.clearLLMLogBtn) {
            this.clearLLMLogBtn.addEventListener('click', () => this.clearLLMLog());
        }
        if (this.llmLogModal) {
            this.llmLogModal.addEventListener('click', (e) => {
                if (e.target === this.llmLogModal) this.closeLLMLog();
            });
        }

        // Clear
        this.clearIntelBtn.addEventListener('click', () => { this.intelligenceStream.innerHTML = ''; });
        if (this.clearWireBtn) {
            this.clearWireBtn.addEventListener('click', () => { this.wireStream.innerHTML = ''; });
        }

        // Copy
        this.copyIntelBtn.addEventListener('click', () => this.copyToClipboard(this.intelligenceStream));
        if (this.copyWireBtn) {
            this.copyWireBtn.addEventListener('click', () => this.copyToClipboard(this.wireStream));
        }

        // Search
        this.intelSearch.addEventListener('input', (e) => this.searchStream(this.intelligenceStream, e.target.value));
        if (this.wireSearch) {
            this.wireSearch.addEventListener('input', (e) => this.searchStream(this.wireStream, e.target.value));
        }

        // Panel resizer
        if (this.panelResizer) {
            this.setupPanelResizer();
        }

        // Top actions
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // Hosts
        if (this.hostsBtn) {
            this.hostsBtn.addEventListener('click', () => this.openHostsModal());
        }

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
        this.pullModelBtn.addEventListener('click', () => this.pullModel());
        this.ollmaTempInput.addEventListener('input', (e) => {
            this.tempValueDisplay.textContent = (e.target.value / 100).toFixed(2);
        });

        if (this.addOllamaInstanceBtn) {
            this.addOllamaInstanceBtn.addEventListener('click', () => this.addOllamaInstance());
        }
        if (this.newOllamaHostInput) {
            this.newOllamaHostInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.addOllamaInstance();
            });
        }
        if (this.newOllamaPortInput) {
            this.newOllamaPortInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.addOllamaInstance();
            });
        }
        if (this.scanOllamaBtn) {
            this.scanOllamaBtn.addEventListener('click', () => this.scanForOllamaInstances());
        }
        if (this.networkScanToggle) {
            this.networkScanToggle.addEventListener('change', (e) => {
                this.saveNetworkScanSetting(e.target.value === 'true');
            });
        }

        this.pingTargetBtn.addEventListener('click', () => this.pingTarget());
        this.installBtn.addEventListener('click', () => this.installPackages());
        this.restartContainerBtn.addEventListener('click', () => this.restartContainer());
        this.resetContainerBtn.addEventListener('click', () => this.resetContainer());
        this.testProxyBtn.addEventListener('click', () => this.testProxyConnection());
        if (this.saveGeminiBtn) {
            this.saveGeminiBtn.addEventListener('click', () => this.saveGeminiConfig());
        }

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

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalShortcuts(e));

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.loginModal.classList.remove('active');
                this.confirmModal.classList.remove('active');
                this.settingsModal.classList.remove('active');
                this.notepadModal.classList.remove('active');
                if (this.hostsModal) this.hostsModal.classList.remove('active');
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
                case 'g': e.preventDefault(); this.openLLMLog(); break;
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
        this.ollamaModel = saved.ollamaModel || 'phi3:mini';
        this.ollamaTemp = saved.ollamaTemp || 0.7;
        this.aiProvider = saved.aiProvider || 'auto';
        this.aiTaskType = saved.aiTaskType || 'default';
        this.showTimestamps = saved.showTimestamps !== false;
        this.soundEnabled = saved.soundEnabled !== false;
        this.panelSplitRatio = saved.panelSplitRatio || 0.5;
        this.quickCmdsCollapsed = saved.quickCmdsCollapsed || false;
        this.enabledPlugins = saved.enabledPlugins || ['cve-plugin', 'threat-intel-plugin'];
        this.livePipe = saved.livePipe === true;

        // Apply panel split ratio to layout
        if (this.intelPanel && this.wirePanel) {
            this.intelPanel.style.flex = this.panelSplitRatio;
            this.wirePanel.style.flex = 1 - this.panelSplitRatio;
        }

        // Apply theme
        const theme = saved.theme || 'default';
        if (theme !== 'default') document.body.classList.add(`theme-${theme}`);

        // Apply to UI
        this.targetIPDisplay.value = this.targetIP;
        this.localIPDisplay.value = this.localIP;
        this.listeningPortDisplay.value = this.listeningPort;
        this.activeModelDisplay.textContent = this.ollamaModel;

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
            livePipe: this.livePipe,
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
        // Sync primary URL to server on startup only if it differs from default
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

    // CMD row: always treated as a shell command
    executeCommand() {
        const input = this.commandInput.value.trim();
        if (!input) return;

        this.commandInput.value = '';
        this.historyIndex = -1;
        this.addToCommandHistory(input);

        // Autonomous attack mode: "attack" or "attack <target>"
        const attackMatch = input.match(/^attack(?:\s+(.+))?$/i);
        if (attackMatch) {
            const target = (attackMatch[1] || this.targetIP || '').trim();
            this.startAutonomousAttack(target);
            return;
        }

        if (this.livePipe) {
            this.executeDockerCommand(input);
        } else {
            this.showConfirmModal(input);
        }
    }

    // CHAT row: always sent to AI
    executeChatInput() {
        const input = this.chatInput.value.trim();
        if (!input) return;

        this.chatInput.value = '';
        this.addToCommandHistory(input);

        // Autonomous attack mode shortcut works from chat too
        const attackMatch = input.match(/^attack(?:\s+(.+))?$/i);
        if (attackMatch) {
            const target = (attackMatch[1] || this.targetIP || '').trim();
            this.startAutonomousAttack(target);
            return;
        }

        this.processNaturalLanguage(input);
    }

    addToCommandHistory(cmd) {
        this.commandHistory.unshift(cmd);
        if (this.commandHistory.length > 100) this.commandHistory.pop();
    }

    isNaturalLanguage(input) {
        // If the input contains shell syntax, treat it as a shell command regardless of first word
        const shellSyntax = /(\s+-{1,2}[a-zA-Z]|[|><&;]|^\/|~\/|\.\/)/ ;
        if (shellSyntax.test(input)) return false;

        // Only match words that are unambiguously natural language (not shell command names)
        const nlPatterns = /^(what|how|why|when|where|can|enumerate|exploit|analyze|tell|explain|describe|identify)\b/i;
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

    // ============================================
    // LLM DEBUG LOG
    // ============================================

    openLLMLog() {
        if (!this.llmLogModal) return;
        this.llmLogModal.style.display = 'flex';
        this.fetchLLMLog();
        this._startLLMLogAutoRefresh();
    }

    closeLLMLog() {
        if (!this.llmLogModal) return;
        this.llmLogModal.style.display = 'none';
        this._stopLLMLogAutoRefresh();
    }

    _startLLMLogAutoRefresh() {
        this._stopLLMLogAutoRefresh();
        if (this.llmLogAutoRefresh && this.llmLogAutoRefresh.checked) {
            this._llmLogTimer = setInterval(() => this.fetchLLMLog(), 4000);
        }
        if (this.llmLogAutoRefresh) {
            this.llmLogAutoRefresh.onchange = () => {
                if (this.llmLogAutoRefresh.checked) {
                    this._llmLogTimer = setInterval(() => this.fetchLLMLog(), 4000);
                } else {
                    this._stopLLMLogAutoRefresh();
                }
            };
        }
    }

    _stopLLMLogAutoRefresh() {
        if (this._llmLogTimer) {
            clearInterval(this._llmLogTimer);
            this._llmLogTimer = null;
        }
    }

    async fetchLLMLog() {
        if (!this.token) return;
        try {
            const data = await this.apiCall('GET', '/api/llm/log?limit=100');
            this._renderLLMLog(data);
        } catch (e) {
            if (this.llmLogStream) {
                this.llmLogStream.innerHTML = `<div style="color:var(--danger);padding:8px;">❌ Failed to load log: ${e.message}</div>`;
            }
        }
    }

    async clearLLMLog() {
        if (!this.token) return;
        try {
            await this.apiCall('DELETE', '/api/llm/log');
            this.fetchLLMLog();
        } catch (e) { /* ignore */ }
    }

    _renderLLMLog(data) {
        if (!this.llmLogStream) return;
        const entries = data.entries || [];

        if (this.llmLogSummary) {
            this.llmLogSummary.textContent = `${data.total || 0} total interactions | showing last ${entries.length}`;
        }

        if (!entries.length) {
            this.llmLogStream.innerHTML = '<div style="color:var(--text-secondary);font-size:11px;padding:8px;">No LLM interactions logged yet.</div>';
            return;
        }

        const html = entries.map(e => {
            const ts = new Date(e.ts).toLocaleTimeString();
            const statusClass = `status-${e.status || 'pending'}`;
            const dur = e.durationMs != null ? `${e.durationMs}ms` : '…';
            const bodyParts = [];
            if (e.prompt) {
                bodyParts.push(`<div class="llm-log-prompt">▶ ${this._escHtml(e.prompt.slice(0, 200))}${e.prompt.length > 200 ? '…' : ''}</div>`);
            }
            if (e.responseSnippet) {
                bodyParts.push(`<div class="llm-log-snippet">◀ ${this._escHtml(e.responseSnippet)}${e.responseSnippet.length >= 300 ? '…' : ''}</div>`);
            }
            if (e.error) {
                bodyParts.push(`<div class="llm-log-error">⚠ ${this._escHtml(e.error)}</div>`);
            }
            if (e.tokenCount != null) {
                bodyParts.push(`<div style="color:var(--text-secondary);font-size:10px;">${e.tokenCount} tokens</div>`);
            }
            return `<div class="llm-log-entry ${statusClass}">
                <span class="llm-log-ts">${ts}</span>
                <span class="llm-log-type">${e.type || '?'}</span>
                <span class="llm-log-prov">${e.provider || '?'}</span>
                <div class="llm-log-body">${bodyParts.join('')}</div>
                <span class="llm-log-dur">${dur}</span>
            </div>`;
        }).join('');

        this.llmLogStream.innerHTML = html;
    }

    _escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
                preferredProvider: this.aiProvider !== 'auto' ? this.aiProvider : undefined,
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
                preferredProvider: this.aiProvider !== 'auto' ? this.aiProvider : undefined,
                taskType: this.aiTaskType,
            });

            this.commandInput.placeholder = `Suggested: ${response.response.slice(0, 60)}...`;
        } catch (err) { }
    }

    // ============================================
    // AUTONOMOUS ATTACK MODE
    // ============================================

    async startAutonomousAttack(target) {
        if (this.autonomousRunning) {
            this.addIntelligenceMessage('⚠️ Autonomous attack already running. Use KILL to stop.', 'yellow');
            return;
        }

        if (!target || target === '---.---.---.---') {
            this.addIntelligenceMessage('❌ No target set. Set $TARGET_IP in the HUD first, or use: attack 192.168.1.1', 'red');
            return;
        }

        if (!confirm(`⚠️  AUTONOMOUS ATTACK MODE\n\nTarget: ${target}\n\nThe AI will plan and execute a series of penetration testing commands automatically.\n\nOnly use against systems you own or have explicit written permission to test.\n\nContinue?`)) {
            return;
        }

        this.autonomousRunning = true;
        this.autonomousAbort = false;
        this.autoPilotBtn.classList.add('active');
        if (this.attackBtn) this.attackBtn.classList.add('active');

        this.addIntelligenceMessage('\n🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
        this.addIntelligenceMessage('   AUTONOMOUS ATTACK MODE ACTIVATED', 'red');
        this.addIntelligenceMessage('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'red');
        this.addIntelligenceMessage(`🎯 Target: ${target}`, 'cyan');
        this.addIntelligenceMessage('⏳ Asking AI to generate attack plan...', 'cyan');

        let plan;
        try {
            const response = await this.apiCall('POST', '/api/autonomous/plan', {
                target,
                model: this.ollamaModel,
            });
            plan = response.plan;
            if (response.template) {
                this.addIntelligenceMessage('⚠️  AI unavailable — using standard recon template', 'yellow');
            }
        } catch (err) {
            const detail = err.payload?.details ? ` — ${err.payload.details}` : '';
            this.addIntelligenceMessage(`❌ Failed to generate plan: ${err.message}${detail}`, 'red');
            this.autonomousRunning = false;
            this.autoPilotBtn.classList.remove('active');
            if (this.attackBtn) this.attackBtn.classList.remove('active');
            return;
        }

        this.addIntelligenceMessage(`\n📋 ATTACK PLAN — ${plan.phases.length} phases`, 'green');
        plan.phases.forEach((phase, i) => {
            this.addIntelligenceMessage(`  ${i + 1}. ${phase.name}`, 'grey');
        });
        this.addIntelligenceMessage('', 'grey');

        for (let i = 0; i < plan.phases.length; i++) {
            if (this.autonomousAbort) break;

            const phase = plan.phases[i];
            const stepLabel = `Phase ${i + 1}/${plan.phases.length}`;

            this.addIntelligenceMessage(`\n┌─ ${stepLabel}: ${phase.name.toUpperCase()} ─┐`, 'cyan');
            this.addIntelligenceMessage(`📖 Best Practice:\n   ${phase.bestPractice}`, 'yellow');
            this.addIntelligenceMessage(`🎯 Purpose: ${phase.purpose}`, 'grey');

            // Substitute common placeholders in the command
            const cmd = phase.command
                .replace(/\$TARGET_IP/g, target)
                .replace(/TARGET_IP/g, target);

            this.addWireMessage(`\n[${stepLabel}] ${phase.name}`, 'cyan');
            this.addWireMessage(`$ ${cmd}`, 'green');

            let output = '';
            try {
                const execResponse = await this.apiCall('POST', '/api/docker/exec', {
                    command: cmd,
                    timeout: 90000,
                });

                if (execResponse.success) {
                    output = execResponse.output || '(no output)';
                    this.addWireMessage(output.slice(0, 3000), 'grey');

                    if (execResponse.timedOut) {
                        this.addWireMessage(`⏱ ${stepLabel} timed out`, 'yellow');
                    } else {
                        this.addWireMessage(`✓ ${stepLabel} complete`, 'green');
                    }
                }
            } catch (err) {
                output = `Error: ${err.message}`;
                this.addWireMessage(`❌ ${stepLabel} failed: ${err.message}`, 'red');
                if (!phase.continueOnFail) {
                    this.addIntelligenceMessage(`⛔ Stopping: ${phase.name} failed and continueOnFail is false`, 'red');
                    break;
                }
            }

            // AI mentor analysis of this phase's output
            if (!this.autonomousAbort) {
                await this.analyzeAutonomousOutput(phase.name, cmd, output);
            }

            // Brief pause between phases so the user can read
            if (!this.autonomousAbort) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        this.autonomousRunning = false;
        this.autoPilotBtn.classList.remove('active');
        if (this.attackBtn) this.attackBtn.classList.remove('active');

        if (this.autonomousAbort) {
            this.addIntelligenceMessage('\n⛔ Autonomous attack ABORTED', 'red');
        } else {
            this.addIntelligenceMessage('\n✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
            this.addIntelligenceMessage(`   AUTONOMOUS ATTACK SEQUENCE COMPLETE`, 'green');
            this.addIntelligenceMessage('✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'green');
            this.addIntelligenceMessage(`All ${plan.phases.length} phases executed against ${target}`, 'green');
            this.addIntelligenceMessage('💡 Tip: Click 📋 to generate a full pentest report', 'cyan');
        }
    }

    async analyzeAutonomousOutput(phaseName, command, output) {
        const prompt = `You are a penetration testing mentor reviewing a student's scan results.

Phase: ${phaseName}
Command run: ${command}
Output (first 800 chars):
${output.slice(0, 800)}

Provide a concise mentor-style debrief with these sections:
KEY FINDINGS: What important information was revealed?
WHAT IT MEANS: Security implications of what was found.
NEXT STEPS: What should be investigated next based on these results?

Keep it under 150 words. Be educational and specific.`;

        this.addIntelligenceMessage(`\n🧠 AI Mentor — ${phaseName} Analysis:`, 'cyan');

        try {
            const response = await this.apiCall('POST', '/api/ollama/generate', {
                prompt,
                model: this.ollamaModel,
                temperature: 0.4,
                useOrchestrator: this.aiProvider === 'auto',
                preferredProvider: this.aiProvider !== 'auto' ? this.aiProvider : undefined,
                taskType: 'reasoning',
            });

            if (response.response) {
                this.addIntelligenceMessage(response.response, 'green');
            }
        } catch (err) {
            this.addIntelligenceMessage(`(Analysis unavailable: ${err.message})`, 'grey');
        }
    }

    // ============================================
    // KILL & BURN
    // ============================================

    async killAllProcesses() {
        if (!confirm('Kill ALL processes in Kali container?')) return;

        // Abort any running autonomous attack chain
        if (this.autonomousRunning) {
            this.autonomousAbort = true;
            this.autonomousRunning = false;
            this.autoPilotBtn.classList.remove('active');
        }

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
        // Load current Ollama config from server
        try {
            const config = await this.apiCall('GET', '/api/ollama/config');
            if (config.url) {
                this.ollamaUrl = config.url;
            }
        } catch (err) {
            console.warn('Could not fetch Ollama config from server:', err.message);
        }

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

        // Load Ollama instances and network scan state
        this.loadOllamaInstances();
        this.loadNetworkScanSetting();

        // Load Gemini config (model + key presence) from server
        this.loadGeminiConfig();

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
        this.ollamaModel = this.ollamaModelInput.value;
        this.ollamaTemp = parseInt(this.ollmaTempInput.value, 10) / 100;
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

        // Save proxy settings
        this.saveProxySettings();

        // Sync Ollama URL to server so health checks and AI calls use the correct host
        this.apiCall('POST', '/api/ollama/config', { url: this.ollamaUrl }).catch(err => {
            console.warn('Failed to sync Ollama URL to server:', err.message);
        });

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

    async loadGeminiConfig() {
        try {
            const config = await this.apiCall('GET', '/api/gemini/config');
            if (this.geminiModelInput && config.model) {
                this.geminiModelInput.value = config.model;
            }
            if (this.geminiApiKeyInput) {
                this.geminiApiKeyInput.placeholder = config.apiKeySet
                    ? 'API key is set — paste new key to update'
                    : 'Paste API key (leave blank to keep existing)';
            }
        } catch (err) {
            console.warn('Could not fetch Gemini config:', err.message);
        }
    }

    async saveGeminiConfig() {
        const apiKey = this.geminiApiKeyInput ? this.geminiApiKeyInput.value.trim() : '';
        const model = this.geminiModelInput ? this.geminiModelInput.value.trim() : '';

        if (!apiKey && !model) {
            this.addIntelligenceMessage('⚠ Enter an API key or model to update Gemini config', 'yellow');
            return;
        }

        const payload = {};
        if (apiKey) payload.apiKey = apiKey;
        if (model) payload.model = model;

        try {
            const result = await this.apiCall('POST', '/api/gemini/config', payload);
            if (result.success) {
                // Clear the key field so it isn't sitting in the DOM
                if (this.geminiApiKeyInput) {
                    this.geminiApiKeyInput.value = '';
                    this.geminiApiKeyInput.placeholder = 'API key is set — paste new key to update';
                }
                if (this.geminiModelInput && result.model) {
                    this.geminiModelInput.value = result.model;
                }
                this.addIntelligenceMessage(`✓ Gemini config saved (model: ${result.model})`, 'green');
                // Refresh status box
                if (this.geminiStatusBox) {
                    this.geminiStatusBox.textContent = `✓ Configured — ${result.model}`;
                    this.geminiStatusBox.classList.add('connected');
                    this.geminiStatusBox.classList.remove('disconnected');
                }
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to save Gemini config: ${err.message}`, 'red');
        }
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
        if (!this.ollamaStatusBox) return;
        this.ollamaStatusBox.textContent = '⏳ Testing connection...';
        this.ollamaStatusBox.classList.remove('connected', 'disconnected');

        try {
            const result = await this.apiCall('GET', `/api/ollama/status?url=${encodeURIComponent(this.ollamaUrl)}`);

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
                        this.geminiStatusBox.textContent = '✗ Not configured — add API key in Settings → AI/LLM → Gemini API Key';
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
        const url = this.ollamaUrl;
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

    // ============================================
    // OLLAMA INSTANCE MANAGEMENT
    // ============================================

    async loadOllamaInstances() {
        if (!this.ollamaInstancesList) return;
        this.ollamaInstancesList.innerHTML = '<p class="loading">Loading instances...</p>';
        try {
            const response = await this.apiCall('GET', '/api/ollama/instances');
            const instances = response.instances || [];
            this.renderOllamaInstances(instances);
        } catch (err) {
            this.ollamaInstancesList.innerHTML = `<p class="error">Failed to load instances: ${err.message}</p>`;
        }
    }

    renderOllamaInstances(instances) {
        if (!this.ollamaInstancesList) return;
        this.ollamaInstancesList.innerHTML = '';

        if (instances.length === 0) {
            this.ollamaInstancesList.innerHTML = '<p class="loading">No instances registered.</p>';
            return;
        }

        instances.forEach(inst => {
            const row = document.createElement('div');
            row.className = 'instance-row';
            row.dataset.id = inst.id;

            const statusDot = inst.available ? '🟢' : '🔴';
            const isPrimary = inst.id === 'ollama';
            const modelInfo = inst.models && inst.models.length > 0 ? ` (${inst.models.length} model${inst.models.length !== 1 ? 's' : ''})` : '';

            row.innerHTML = `
                <span class="instance-status">${statusDot}</span>
                <span class="instance-id">${inst.id}</span>
                <span class="instance-url">${inst.url}${modelInfo}</span>
                ${isPrimary
                    ? `<button class="btn btn-small" onclick="app.editPrimaryOllamaUrl()">EDIT</button>`
                    : `<button class="btn btn-small btn-danger-small" onclick="app.removeOllamaInstance('${inst.id}')">✕</button>`
                }
            `;
            this.ollamaInstancesList.appendChild(row);
        });
    }

    async addOllamaInstance() {
        if (!this.newOllamaHostInput) return;
        const host = this.newOllamaHostInput.value.trim();
        if (!host) {
            this.addIntelligenceMessage('⚠ Enter a host or IP address first', 'yellow');
            return;
        }
        const port = (this.newOllamaPortInput && this.newOllamaPortInput.value.trim()) || '11434';
        const url = `http://${host}:${port}`;
        try {
            const response = await this.apiCall('POST', '/api/ollama/instances', { url });
            if (response.success) {
                this.addIntelligenceMessage(`✓ Ollama instance added: ${response.id} → ${url}`, 'green');
                this.newOllamaHostInput.value = '';
                if (this.newOllamaPortInput) this.newOllamaPortInput.value = '11434';
                await this.loadOllamaInstances();
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to add instance: ${err.message}`, 'red');
        }
    }

    async removeOllamaInstance(id) {
        if (!confirm(`Remove Ollama instance "${id}"?`)) return;
        try {
            const response = await this.apiCall('DELETE', `/api/ollama/instances/${id}`);
            if (response.success) {
                this.addIntelligenceMessage(`✓ Removed instance: ${id}`, 'green');
                await this.loadOllamaInstances();
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to remove instance: ${err.message}`, 'red');
        }
    }

    editPrimaryOllamaUrl() {
        const current = this.ollamaUrl || 'http://localhost:11434';
        const newUrl = prompt('Enter new primary Ollama URL:', current);
        if (!newUrl || newUrl.trim() === current) return;
        this.apiCall('POST', '/api/ollama/config', { url: newUrl.trim() })
            .then(response => {
                if (response.success) {
                    this.ollamaUrl = response.url;
                    this.saveUserSettings();
                    this.addIntelligenceMessage(`✓ Primary Ollama URL updated: ${response.url}`, 'green');
                    this.loadOllamaInstances();
                    this.checkOllamaStatus();
                }
            })
            .catch(err => {
                this.addIntelligenceMessage(`❌ Failed to update URL: ${err.message}`, 'red');
            });
    }

    // ============================================
    // NETWORK SCAN FOR OLLAMA
    // ============================================

    async loadNetworkScanSetting() {
        try {
            const response = await this.apiCall('GET', '/api/ollama/scan/settings');
            if (this.networkScanToggle) {
                this.networkScanToggle.value = response.enabled ? 'true' : 'false';
            }
        } catch (err) {
            console.warn('Could not load network scan setting:', err.message);
        }
    }

    async saveNetworkScanSetting(enabled) {
        try {
            await this.apiCall('POST', '/api/ollama/scan/settings', { enabled });
            this.addIntelligenceMessage(`✓ Network scanning ${enabled ? 'enabled' : 'disabled'}`, 'green');
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to update scan setting: ${err.message}`, 'red');
        }
    }

    async scanForOllamaInstances() {
        if (!this.scanResults) return;

        // Check if scanning is enabled
        const scanEnabled = this.networkScanToggle ? this.networkScanToggle.value === 'true' : false;
        if (!scanEnabled) {
            this.scanResults.style.display = 'block';
            this.scanResults.textContent = '⚠ Enable Network Discovery first, then click SCAN.';
            return;
        }

        this.scanResults.style.display = 'block';
        this.scanResults.textContent = '⏳ Scanning network for Ollama instances...';
        if (this.scanOllamaBtn) this.scanOllamaBtn.disabled = true;

        try {
            const response = await this.apiCall('POST', '/api/ollama/scan', {});

            if (!response.success) {
                this.scanResults.textContent = `✗ ${response.error || 'Scan failed'}`;
                return;
            }

            const found = response.discovered || [];
            if (found.length === 0) {
                this.scanResults.textContent = `No Ollama instances found on ${response.subnet}.0/24`;
                return;
            }

            this.scanResults.innerHTML = `Found ${found.length} Ollama instance(s) on ${response.subnet}.0/24:<br>`;
            found.forEach(host => {
                const modelInfo = host.models && host.models.length > 0 ? ` — ${host.models.join(', ')}` : '';
                const line = document.createElement('div');
                line.className = 'scan-result-row';
                line.innerHTML = `
                    <span>🟢 ${host.url}${modelInfo}</span>
                    <button class="btn btn-small" onclick="app.addDiscoveredOllamaInstance('${host.url}')">ADD</button>
                `;
                this.scanResults.appendChild(line);
            });
        } catch (err) {
            this.scanResults.textContent = `✗ Scan error: ${err.message}`;
        } finally {
            if (this.scanOllamaBtn) this.scanOllamaBtn.disabled = false;
        }
    }

    async addDiscoveredOllamaInstance(url) {
        try {
            const response = await this.apiCall('POST', '/api/ollama/instances', { url });
            if (response.success) {
                this.addIntelligenceMessage(`✓ Added discovered instance: ${response.id} → ${url}`, 'green');
                await this.loadOllamaInstances();
            }
        } catch (err) {
            this.addIntelligenceMessage(`❌ Failed to add instance: ${err.message}`, 'red');
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
            if (response.status === 401) {
                // Session is no longer valid — clear stored credentials and force re-login
                this.token = null;
                this.sessionId = null;
                localStorage.removeItem('auth_token');
                localStorage.removeItem('session_id');
                this.showLoginModal();
            }
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
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axios/1.9.0/axios.min.js';
    document.head.appendChild(script);

    script.onload = () => {
        window.bot = new KaliHackerBot();
        // Also expose as `app` so inline onclick handlers in the instances list work
        window.app = window.bot;
        window.bot.checkAuthStatus();
    };
});
