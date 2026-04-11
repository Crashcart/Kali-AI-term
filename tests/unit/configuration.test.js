const fs = require('fs');
const path = require('path');

describe('Configuration wiring', () => {
  it('passes auth settings into the app container', () => {
    const composePath = path.join(__dirname, '..', '..', 'docker-compose.yml');
    const compose = fs.readFileSync(composePath, 'utf8');

    expect(compose).toContain('ADMIN_PASSWORD=${ADMIN_PASSWORD:-kalibot}');
    expect(compose).toContain('AUTH_SECRET=${AUTH_SECRET:-changeme-local-dev}');
  });

  it('loads .env before reading runtime configuration', () => {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    expect(serverSource).toContain("require('dotenv').config();");
  });

  it('exposes login error report endpoint and report IDs', () => {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');

    expect(serverSource).toContain("app.post('/api/auth/login/error-report'");
    expect(serverSource).toContain('reportId');
    expect(serverSource).toContain('createLoginErrorReport');
  });

  it('submits login failure diagnostics from the frontend', () => {
    const appPath = path.join(__dirname, '..', '..', 'public', 'app.js');
    const appSource = fs.readFileSync(appPath, 'utf8');

    expect(appSource).toContain('submitLoginErrorReport');
    expect(appSource).toContain('/api/auth/login/error-report');
    expect(appSource).toContain('Login error report captured');
  });
});
