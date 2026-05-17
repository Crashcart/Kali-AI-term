# Development Environment Setup

**Get started developing Kali-AI-term with full quality standards**

---

## Prerequisites

### Required
- **Node.js** ≥ 18.0.0 ([Download](https://nodejs.org/))
- **npm** ≥ 9.0.0 (comes with Node.js)
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/))

### Verify Installation
```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
docker --version  # Should be recent
git --version     # Should be recent
```

---

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/Crashcart/Kali-AI-term.git
cd Kali-AI-term
git checkout dev   # Use development branch
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- Express.js (web server)
- Jest (testing framework)
- ESLint (linting)
- Prettier (code formatting)
- Docker client libraries
- And more (see package.json)

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

Default `.env` configuration:
```
PORT=31337
BIND_HOST=0.0.0.0
OLLAMA_URL=http://host.docker.internal:11434
KALI_CONTAINER=kali-ai-term-kali
```

### 4. Start Docker Containers
```bash
docker-compose up -d
```

Verify containers started:
```bash
docker compose ps
# Should show: kali-ai-term-app and kali-ai-term-kali as "running"
```

### 5. Verify Setup
```bash
./qa-check.sh
# Should show: ✓ All checks passed
```

---

## Development Workflow

### Daily Development

#### Start Day
```bash
# Update to latest code
git pull origin dev

# Install any new dependencies
npm install

# Start development server
npm run dev
```

Application will be available at: http://localhost:31337

#### During Development

```bash
# Keep 3 terminal windows open:

# Terminal 1: Dev server (auto-reloads on changes)
npm run dev

# Terminal 2: Docker logs
docker compose logs -f

# Terminal 3: Git and testing
git status
npm test
```

#### End Day
```bash
# Run full quality checks
./qa-check.sh

# Run all tests
npm test

# Check code formatting
npm run format:check

# Commit your work
git add .
git commit -m "feat: implement feature X"
git push origin dev
```

---

## Code Quality Standards

### Before Every Commit

```bash
# 1. Fix linting issues
npm run lint

# 2. Format code
npm run format

# 3. Run tests
npm test

# 4. Run QA checks
./qa-check.sh
```

If all pass → You're ready to commit! ✅

### Commit Message Format

```
type(scope): subject

body

Fixes #123
```

**Types**: feat, fix, docs, style, refactor, test, chore, perf

**Example**:
```
feat(api): add terminal execution endpoint

- Validates input to prevent injection attacks
- Executes commands in Kali container
- Returns output with timestamp
- Includes comprehensive error handling

Fixes #45
```

### Code Style Guidelines

**Variables**: camelCase
```javascript
const userName = 'alice';
let containerStatus = 'running';
```

**Functions**: camelCase, verb-based
```javascript
function getContainerStatus() { }
function executeCommand(cmd) { }
```

**Constants**: UPPER_SNAKE_CASE
```javascript
const MAX_TIMEOUT = 30000;
const KALI_CONTAINER = 'kali-ai-term-kali';
```

**Classes**: PascalCase
```javascript
class TerminalSession { }
class DockerClient { }
```

---

## Testing

### Run Tests

```bash
# All tests with coverage
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Write Tests

Test file location: `tests/unit/feature.test.js`

```javascript
describe('Feature Name', () => {
  describe('functionName', () => {
    it('should do X when given Y', () => {
      // Arrange: Set up test data
      const input = { key: 'value' };

      // Act: Call the function
      const result = myFunction(input);

      // Assert: Verify the result
      expect(result).toEqual(expectedValue);
    });

    it('should handle error case', () => {
      expect(() => {
        myFunction(invalidInput);
      }).toThrow();
    });
  });
});
```

### Test Coverage

View coverage report:
```bash
npm test -- --coverage
open coverage/index.html
```

Target: ≥ 80% coverage for new code

---

## Debugging

### Debug Server

```bash
# Start server with debug logging
DEBUG=* npm run dev

# View in browser
http://localhost:31337
```

### Docker Container Debug

```bash
# Access Kali container shell
docker exec -it kali-ai-term-kali bash

# Run a command in container
docker exec kali-ai-term-kali whoami

# View container logs
docker compose logs app
docker compose logs kali

# Follow logs in real-time
docker compose logs -f
```

### Node.js Debugging

```bash
# Start with inspector
node --inspect server.js

# Open in Chrome: chrome://inspect
```

---

## Common Tasks

### Add New Dependency
```bash
npm install package-name
npm test  # Verify it works
git add package.json package-lock.json
git commit -m "chore: add package-name"
```

### Update Dependencies
```bash
npm update
npm audit --audit-level=moderate
npm test
git add package.json package-lock.json
git commit -m "chore: update dependencies"
```

### Fix Security Vulnerabilities
```bash
npm audit
npm audit fix
npm test
git add package.json package-lock.json
git commit -m "fix: resolve security vulnerabilities"
```

### Create Feature Branch
```bash
git checkout -b feature/my-feature
# Make changes
npm test
git add .
git commit -m "feat: implement my feature"
git push origin feature/my-feature
# Create PR on GitHub
```

### Switch Branches
```bash
# Update to latest from main branch
./update.sh main

# Or switch to specific branch
./update.sh beta
```

---

## API Development

### Adding New Endpoint

1. **Create handler** in `server.js`:
```javascript
app.post('/api/feature', express.json(), async (req, res) => {
  try {
    const { param } = req.body;
    
    // Validate input
    if (!param) {
      return res.status(400).json({ error: 'param required' });
    }

    // Implement logic
    const result = await doSomething(param);

    // Return response
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('API error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

2. **Add tests** in `tests/integration/api.test.js`:
```javascript
it('POST /api/feature should work', async () => {
  const response = await request(server)
    .post('/api/feature')
    .send({ param: 'value' });

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('data');
});
```

3. **Document** in README.md:
```markdown
### POST /api/feature
Execute a feature.

**Request**:
```json
{ "param": "value" }
```

**Response**:
```json
{ "success": true, "data": {...} }
```
```

---

## Docker Development

### Build Custom Image
```bash
docker build -t my-app:latest .
docker tag my-app:latest my-app:dev
```

### Run Container Directly
```bash
docker run -p 31337:31337 -e PORT=31337 my-app:latest
```

### Docker Compose Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Remove everything (including volumes)
docker compose down -v

# View logs
docker compose logs -f

# Execute command in container
docker compose exec app bash
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 31337
lsof -i :31337

# Kill the process
kill -9 <PID>

# Or use different port
PORT=31338 npm run dev
```

### Docker Not Running
```bash
# Start Docker Desktop (Mac/Windows)
# Or start daemon (Linux)
sudo systemctl start docker

# Verify
docker ps
```

### npm Module Errors
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port 11434 in Use (Ollama)
```bash
# Ollama should be running externally
# Set correct URL in .env
OLLAMA_URL=http://your-ollama-host:11434

# Or run Ollama locally
ollama serve  # In separate terminal
```

### Tests Timeout
```bash
# Increase timeout in jest.config.cjs
testTimeout: 30000  // 30 seconds

# Or in specific test
jest.setTimeout(30000);
```

---

## Performance Optimization

### Measure Performance
```bash
npm run test:perf
node --inspect server.js
# Open chrome://inspect
```

### Common Issues
- Memory leaks: Check for unclosed connections
- Slow queries: Add database indexes
- N+1 queries: Batch database operations
- Large payloads: Implement pagination

---

## Security Best Practices

### Code Security
- ✓ Never commit secrets or API keys
- ✓ Sanitize all user inputs
- ✓ Use parameterized queries
- ✓ Validate on server side
- ✓ Use HTTPS in production
- ✓ Keep dependencies updated

### Check Security
```bash
npm run test:security  # Audit dependencies
npm run lint           # Check code security rules
```

---

## Resources

### Documentation
- [README.md](../README.md) — Project overview
- [QUALITY_STANDARDS.md](.github/QUALITY_STANDARDS.md) — Quality requirements
- [TESTING_GUIDE.md](.github/TESTING_GUIDE.md) — Testing procedures

### External Resources
- [Express.js Docs](https://expressjs.com/)
- [Jest Testing Docs](https://jestjs.io/)
- [Docker Docs](https://docs.docker.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Getting Help

### Stuck?
1. Check README.md for common issues
2. Search GitHub issues for similar problems
3. Check docker compose logs: `docker compose logs -f`
4. Ask in team chat with error message

### Report Bugs
Create GitHub issue with:
- What you were trying to do
- What happened
- Expected behavior
- Steps to reproduce
- Environment (OS, Node version, etc.)

---

## Continuous Learning

### Recommended Reading
- [QUALITY_STANDARDS.md](.github/QUALITY_STANDARDS.md)
- [TESTING_GUIDE.md](.github/TESTING_GUIDE.md)
- [DEPLOYMENT_QUALITY_GATE.md](.github/DEPLOYMENT_QUALITY_GATE.md)
- Code review comments on PRs

### Practice Quality
Every commit should:
- ✓ Pass linting
- ✓ Have test coverage
- ✓ Include documentation
- ✓ Be reviewed before merge

---

**Welcome to the team! 🚀**

Questions? Ask in Slack or create a GitHub discussion.

