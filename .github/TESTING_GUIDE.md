# Testing Guide for Kali-AI-term

**Complete guide to validating application quality**

## Quick Start

Run the automated quality check:
```bash
./qa-check.sh
```

This validates:
- ✓ Environment setup
- ✓ Dependencies
- ✓ Code quality (ESLint, Prettier)
- ✓ Test infrastructure
- ✓ Configuration files
- ✓ Docker setup
- ✓ GitHub workflows
- ✓ Git repository

---

## Full Test Suite

### 1. Setup

```bash
# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Edit .env with your configuration
# - Set OLLAMA_URL if using external Ollama
# - Set API keys if using external services
```

### 2. Run All Tests

```bash
# Run full test suite with coverage
npm test

# Run tests in watch mode (reload on changes)
npm run test:watch
```

### 3. Test by Category

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance tests
npm run test:perf

# Security tests
npm run test:security
```

---

## Code Quality Checks

### Linting

```bash
# Fix linting issues automatically
npm run lint

# Check without fixing
npm run lint:check
```

Issues checked:
- Variable naming conventions
- Unused variables and imports
- Code complexity
- Security vulnerabilities
- Best practices

### Code Formatting

```bash
# Format all code automatically
npm run format

# Check formatting without changes
npm run format:check
```

Ensures consistent:
- Indentation (2 spaces)
- Quote usage (single quotes)
- Semicolons
- Line lengths

### Security Audit

```bash
npm run test:security
```

Checks:
- Known vulnerabilities in dependencies
- Outdated packages
- Recommended updates

---

## Manual Testing

### Application Startup

```bash
# Start application in development mode
npm run dev

# Start in production mode
npm start

# Check logs
docker compose logs -f app
```

Application should be available at `http://localhost:31337`

### Docker Containers

```bash
# Start Docker containers
docker compose up -d

# Check container status
docker compose ps

# View container logs
docker compose logs app
docker compose logs kali

# Access Kali container shell
docker exec -it kali-ai-term-kali bash

# Stop containers
docker compose down
```

### API Testing

```bash
# Test terminal execution endpoint
curl -X POST http://localhost:31337/api/terminal/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "whoami"}'

# Expected response:
# {
#   "status": "success",
#   "output": "root\n",
#   "timestamp": "2026-05-17T..."
# }
```

### Feature Testing Checklist

#### Terminal Functionality
- [ ] Commands execute in Kali container
- [ ] Output displays correctly
- [ ] Long-running commands don't timeout
- [ ] Special characters handled properly

#### Report Generation
- [ ] Report PDF generates without errors
- [ ] All findings included in report
- [ ] Formatting looks professional
- [ ] File downloads correctly

#### Database Operations
- [ ] Data persists between sessions
- [ ] Queries execute correctly
- [ ] No data corruption
- [ ] Cleanup properly removes data

#### Security Features
- [ ] Rate limiting prevents abuse
- [ ] CORS only allows configured origins
- [ ] Input validation prevents injection
- [ ] Error messages don't leak sensitive info

---

## Performance Testing

### Memory & CPU Usage

```bash
# Monitor container resources
docker stats

# Run load test
npm run test:perf
```

Success criteria:
- Memory usage < 500MB for app container
- Memory usage < 1GB for Kali container
- CPU not consistently > 80%
- No memory leaks over extended runs

### Response Time Benchmarks

Expected response times (p95):
- Terminal execution: < 500ms
- Report generation: < 2s
- Database queries: < 100ms
- Static file serving: < 100ms

### Load Testing

```bash
# Using Apache Bench (if installed)
ab -n 100 -c 10 http://localhost:31337/

# Expected: 95%+ requests successful
# Expected: Average response time < 500ms
```

---

## Integration Testing

### End-to-End Workflow

1. **Start clean installation**
   ```bash
   ./uninstall.sh
   rm -rf .env
   ./install.sh
   ```

2. **Verify initial setup**
   - Containers running: `docker compose ps`
   - App accessible: http://localhost:31337
   - Kali container ready: `docker exec kali-ai-term-kali whoami`

3. **Execute test commands**
   ```bash
   # Basic command
   curl -X POST http://localhost:31337/api/terminal/execute \
     -H "Content-Type: application/json" \
     -d '{"command": "whoami"}'

   # Complex command
   curl -X POST http://localhost:31337/api/terminal/execute \
     -H "Content-Type: application/json" \
     -d '{"command": "nmap -sV localhost 2>/dev/null || echo \"nmap not found\""}'
   ```

4. **Generate report**
   - Navigate to report section
   - Generate PDF
   - Verify content and formatting

5. **Verify persistence**
   - Restart containers: `docker compose restart`
   - Confirm previous data still available

### Branch Update Testing

Test updating between branches:
```bash
# Update to test branch
./update.sh test

# Verify application works
npm test

# Update back to main
./update.sh main
```

---

## Regression Testing

When fixing a bug:

1. **Create failing test**
   ```javascript
   describe('Bug fix for #123', () => {
     it('should handle edge case properly', () => {
       // This test should FAIL before fix
       const result = buggyFunction(edgeCase);
       expect(result).toEqual(expectedValue);
     });
   });
   ```

2. **Verify test fails**
   ```bash
   npm test -- --testNamePattern="Bug fix for #123"
   # Should fail with current code
   ```

3. **Fix the bug**
   - Implement fix in source code

4. **Verify test passes**
   ```bash
   npm test -- --testNamePattern="Bug fix for #123"
   # Should pass with fix applied
   ```

5. **Commit with test**
   ```bash
   git add bug.js bug.test.js
   git commit -m "fix: resolve edge case in buggyFunction

   - Handle undefined input properly
   - Add regression test to prevent recurrence

   Fixes #123"
   ```

---

## Continuous Integration

### Pre-Commit Hook

Automatically runs before each commit:
```bash
npm run lint:check  # ESLint validation
npm test           # Unit tests
```

If either fails, commit is blocked.

### Pre-Push Hook

Automatically runs before each push:
```bash
npm test           # Full test suite
npm run test:security  # Security audit
```

### GitHub Workflows

Automated CI/CD on every push:
1. **Lint**: Code style validation
2. **Test**: Full test suite with coverage
3. **Build**: Docker image build
4. **Security**: Vulnerability scanning
5. **Deploy**: Automated staging deployment

View workflow status: https://github.com/Crashcart/Kali-AI-term/actions

---

## Troubleshooting Tests

### Tests Timeout

```bash
# Increase timeout in jest.config.cjs
testTimeout: 30000  # 30 seconds

# Or override for specific test
jest.setTimeout(30000);
```

### Tests Fail with "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear jest cache
npm test -- --clearCache
```

### Docker Tests Fail

```bash
# Verify Docker is running
docker ps

# Check container status
docker compose ps

# View logs
docker compose logs -f

# Rebuild containers
docker compose down
docker compose build
docker compose up -d
```

### Flaky Tests (Intermittent Failures)

1. Increase timeout
2. Add retry logic
3. Check for race conditions
4. Investigate logging for clues

---

## Quality Metrics

Monitor these metrics over time:

```bash
# View test coverage
npm test -- --coverage
```

Expected metrics:
- **Line coverage**: ≥ 80%
- **Branch coverage**: ≥ 75%
- **Function coverage**: ≥ 80%
- **Statement coverage**: ≥ 80%

Track trends:
```bash
# Generate coverage report
npm test -- --coverage --coverage-reporters=html

# View report
open coverage/index.html
```

---

## Release Testing Checklist

Before releasing to production:

### Code Quality (Automated)
- [ ] `npm run lint:check` passes
- [ ] `npm run format:check` passes
- [ ] `npm test` passes with coverage ≥ 80%
- [ ] `npm run test:security` finds no vulnerabilities

### Functionality (Manual)
- [ ] Terminal execution works
- [ ] Report generation works
- [ ] Database persistence works
- [ ] Docker containers stable

### Performance
- [ ] Response times < 500ms (p95)
- [ ] No memory leaks
- [ ] Load test passes

### Security
- [ ] Input validation complete
- [ ] Rate limiting effective
- [ ] CORS properly configured
- [ ] No secrets in code/config

### Documentation
- [ ] README up to date
- [ ] API documentation complete
- [ ] Release notes prepared
- [ ] Migration guide (if needed)

### Deployment
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Support contacts available
- [ ] Release notes published

---

## Continuous Improvement

After each release:

1. **Collect Metrics**
   - Bug reports
   - Performance data
   - User feedback

2. **Analyze Results**
   - Identify improvement areas
   - Prioritize fixes
   - Plan next release

3. **Update Tests**
   - Add tests for reported bugs
   - Improve coverage gaps
   - Enhance edge case handling

4. **Improve Documentation**
   - Update based on support requests
   - Add examples for common issues
   - Clarify unclear sections

This iterative approach ensures continuous quality improvement.

