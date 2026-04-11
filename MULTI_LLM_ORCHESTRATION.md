# Multi-LLM Orchestration

This document describes the implementation of Issue #45: **Add ability to integrate faster APIs such as Gemini**.

## Overview

The multi-LLM orchestration system provides intelligent routing of AI requests to multiple language model providers (Ollama, Gemini, etc.). This enables:

- **Hybrid Processing**: Combine free local models (Ollama) with premium cloud APIs (Gemini) for optimal cost/quality balance
- **Intelligent Routing**: Automatically select the best provider based on task type and availability
- **Fallback Support**: Seamlessly fall back to alternative providers if the primary fails
- **Provider Synthesis**: Consult multiple providers and combine their responses for complex reasoning

## Architecture

### Core Components

#### 1. **LLMProvider** (`lib/llm-provider.js`)
Abstract base class defining the interface for LLM providers.

**Interface Methods:**
- `healthCheck()` - Verify provider availability
- `getModels()` - List available models
- `generate(prompt, options)` - Generate response (non-streaming)
- `streamGenerate(prompt, options)` - Generate response (streaming)
- `getStatus()` - Get provider status and metrics

#### 2. **OllamaProvider** (`lib/ollama-provider.js`)
Local Ollama LLM integration with model caching and cost efficiency.

**Features:**
- Local execution (zero API cost)
- Model list caching (5-minute TTL)
- Fast response times
- Offline capability
- Model management

#### 3. **GeminiProvider** (`lib/gemini-provider.js`)
Google Gemini API integration for high-quality reasoning.

**Features:**
- High-quality responses
- Multiple model variants (gemini-pro, gemini-pro-vision)
- Token counting
- Safety settings configuration
- Request metrics tracking

#### 4. **LLMOrchestrator** (`lib/llm-orchestrator.js`)
Intelligent orchestration system managing multiple providers.

**Key Capabilities:**
- Provider registration and health checking
- Task-based routing strategies
- Automatic provider selection
- Fallback chain handling
- Multi-provider synthesis
- Request/error statistics
- Event emission for monitoring

#### 5. **Multi-LLM API Routes** (`lib/multi-llm-api-routes.js`)
RESTful endpoints for orchestrated LLM operations.

## Routing Strategies

The orchestrator supports task-based routing strategies:

### Built-in Strategies

**1. Reasoning (Default)**
```javascript
{
  primary: 'gemini',      // Use Gemini for complex reasoning
  fallback: 'ollama',     // Fall back to Ollama
  timeout: 60000,
  retries: 1
}
```
Used for: Complex analysis, CVE assessment, attack planning

**2. Speed**
```javascript
{
  primary: 'ollama',      // Use local Ollama for speed
  fallback: 'gemini',
  timeout: 30000,
  retries: 0
}
```
Used for: Rapid command suggestions, quick lookups

**3. Quality**
```javascript
{
  primary: 'gemini',      // Use Gemini for best quality
  fallback: 'ollama',
  timeout: 120000,
  retries: 2
}
```
Used for: Report generation, detailed analysis

### Custom Strategies

You can define custom routing strategies:

```bash
curl -X POST http://localhost:31337/api/llm/routing \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "reconnaissance",
    "strategy": {
      "primary": "gemini",
      "fallback": "ollama",
      "timeout": 45000,
      "retries": 2
    }
  }'
```

## API Endpoints

### Provider Management

**GET `/api/llm/providers`**
List all available LLM providers with status and models.

```bash
curl http://localhost:31337/api/llm/providers \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "name": "ollama",
      "status": {
        "available": true,
        "type": "local",
        "modelCount": 3
      },
      "models": [
        {
          "name": "dolphin-mixtral",
          "provider": "ollama",
          "size": 26000000000
        }
      ]
    },
    {
      "name": "gemini",
      "status": {
        "available": true,
        "type": "cloud"
      },
      "models": [...]
    }
  ]
}
```

**GET `/api/llm/providers/:name`**
Get details of a specific provider.

```bash
curl http://localhost:31337/api/llm/providers/gemini \
  -H "Authorization: Bearer $TOKEN"
```

### Generation Endpoints

**POST `/api/llm/generate`**
Generate response with intelligent routing.

```bash
curl -X POST http://localhost:31337/api/llm/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is a SQL injection attack?",
    "taskType": "reasoning",
    "temperature": 0.7,
    "systemPrompt": "You are a penetration testing expert..."
  }'
```

**Parameters:**
- `prompt` (required): The input prompt
- `taskType` (optional): Task type for routing strategy ('reasoning', 'speed', 'quality', custom)
- `preferredProvider` (optional): Force specific provider (overrides routing strategy)
- `temperature` (optional): Response creativity (0.0-1.0, default: 0.7)
- `systemPrompt` (optional): System instruction context

**Response:**
```json
{
  "success": true,
  "response": {
    "provider": "gemini",
    "model": "gemini-pro",
    "response": "SQL injection is...",
    "tokens": {
      "input": 42,
      "output": 156
    }
  }
}
```

**POST `/api/llm/stream`**
Stream response with intelligent routing (Server-Sent Events).

```bash
curl -X POST http://localhost:31337/api/llm/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain privilege escalation...",
    "taskType": "quality"
  }'
```

**Stream Events:**
```json
data: {"token": "SQL", "provider": "gemini", "tokenCount": 1}
data: {"token": " injection", "provider": "gemini", "tokenCount": 2}
...
data: {"done": true, "tokenCount": 256, "provider": "gemini"}
```

### Multi-Provider Operations

**POST `/api/llm/synthesize`**
Consult multiple providers and synthesize responses.

Useful for complex reasoning tasks where multiple perspectives are valuable.

```bash
curl -X POST http://localhost:31337/api/llm/synthesize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "How would you approach testing a web application??",
    "providers": ["gemini", "ollama"],
    "temperature": 0.7
  }'
```

**Response:**
```json
{
  "success": true,
  "synthesis": {
    "responses": [
      {
        "provider": "gemini",
        "response": "A comprehensive web app test involves..."
      },
      {
        "provider": "ollama",
        "response": "Web application testing typically starts with..."
      }
    ],
    "synthesisType": "multi-provider"
  }
}
```

### Utility Endpoints

**GET `/api/llm/models`**
Get all available models across all providers.

```bash
curl http://localhost:31337/api/llm/models \
  -H "Authorization: Bearer $TOKEN"
```

**GET `/api/llm/health`**
Health check all providers.

```bash
curl http://localhost:31337/api/llm/health \
  -H "Authorization: Bearer $TOKEN"
```

**GET `/api/llm/stats`**
Get orchestrator statistics (request counts, errors, etc.).

```bash
curl http://localhost:31337/api/llm/stats \
  -H "Authorization: Bearer $TOKEN"
```

**POST `/api/llm/reset-stats`**
Reset statistics.

```bash
curl -X POST http://localhost:31337/api/llm/reset-stats \
  -H "Authorization: Bearer $TOKEN"
```

## Integration with Existing Endpoints

The existing `/api/ollama/generate` and `/api/ollama/stream` endpoints now support orchestration:

```bash
# Old way (direct Ollama)
curl -X POST http://localhost:31337/api/ollama/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "...", "model": "dolphin-mixtral"}'

# New way (with orchestration)
curl -X POST http://localhost:31337/api/ollama/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "prompt": "...",
    "useOrchestrator": true,
    "taskType": "reasoning"
  }'
```

## Setup and Configuration

### Prerequisites

**Ollama (Local):**
```bash
# Already running locally on OLLAMA_URL environment variable
# Default: http://localhost:11434
```

**Gemini API (Optional):**
```bash
# Get API key from https://ai.google.dev/
export GEMINI_API_KEY="your-api-key-here"
```

### Server Startup

1. Start the server with Gemini API key configured:
   ```bash
   GEMINI_API_KEY="your-api-key" npm start
   ```

2. Verify provider availability:
   ```bash
   curl http://localhost:31337/api/llm/providers
   ```

3. Check orchestrator status:
   ```bash
   curl http://localhost:31337/api/llm/health
   ```

## Usage Examples

### Example 1: Cost-Optimized Approach

Use Ollama for fast tasks, Gemini for complex reasoning:

```javascript
// Fast command suggestion
POST /api/llm/generate {
  "prompt": "Suggest next nmap command after finding port 445 open",
  "taskType": "speed"  // Uses Ollama
}

// Complex vulnerability analysis
POST /api/llm/generate {
  "prompt": "Analyze this CVE and explain exploitation strategy",
  "taskType": "reasoning"  // Uses Gemini, falls back to Ollama
}
```

### Example 2: Hybrid Intelligence

Get perspectives from multiple models:

```javascript
POST /api/llm/synthesize {
  "prompt": "What are the risks of this detected vulnerability?",
  "providers": ["gemini", "ollama"],
  "temperature": 0.8
}
```

Returns insights from both Gemini and Ollama, allowing correlation of findings.

### Example 3: Guaranteed Availability

Always have a response ready:

```javascript
POST /api/llm/generate {
  "prompt": "Quick SQL injection test strategy",
  "taskType": "reasoning"
}
```

If Gemini fails, automatically falls back to Ollama with no user-facing error.

### Example 4: Custom Routing

Define application-specific strategies:

```javascript
// Set up custom strategy for penetration testing
POST /api/llm/routing {
  "taskType": "pentest-analysis",
  "strategy": {
    "primary": "gemini",
    "fallback": "ollama",
    "timeout": 45000,
    "retries": 2
  }
}

// Then use it
POST /api/llm/generate {
  "prompt": "...",
  "taskType": "pentest-analysis"
}
```

## Monitoring and Troubleshooting

### Check Provider Status

```bash
curl http://localhost:31337/api/llm/health
```

**Possible Issues:**

1. **Ollama not responding**
   - Verify Ollama is running: `curl http://localhost:11434/api/tags`
   - Check `OLLAMA_URL` environment variable
   - Restart Ollama service

2. **Gemini API failing**
   - Verify `GEMINI_API_KEY` is set correctly
   - Check API quota at https://console.cloud.google.com/
   - Confirm internet connectivity
   - Verify API is enabled in Google Cloud Console

3. **Provider falls back unexpectedly**
   - Check orchestrator logs for error messages
   - Verify timeout isn't too short for the task
   - Request stats: `GET /api/llm/stats`

### Performance Tuning

**For Speed:**
```json
{
  "taskType": "speed",
  "temperature": 0.3  // Lower temperature = faster convergence
}
```

**For Quality:**
```json
{
  "taskType": "quality",
  "temperature": 0.8  // Higher creativity for nuanced analysis
}
```

## Statistics and Metrics

Track orchestrator performance:

```bash
curl http://localhost:31337/api/llm/stats
```

**Response:**
```json
{
  "stats": {
    "totalRequests": 142,
    "requestsByProvider": {
      "gemini": 89,
      "ollama": 53
    },
    "errorsByProvider": {
      "gemini": 2,
      "ollama": 0
    },
    "lastUpdated": "2026-04-01T23:45:00Z",
    "providers": ["ollama", "gemini"],
    "strategies": ["reasoning", "speed", "quality"]
  }
}
```

Use this data to optimize routing strategies and identify provider issues.

## Security Considerations

1. **API Key Protection**
   - Store `GEMINI_API_KEY` in environment variables, not code
   - Never log or expose API keys
   - Use `.env` file (add to `.gitignore`)

2. **Rate Limiting**
   - Application rate limiting applies to all `/api/llm/` endpoints
   - Gemini API has its own rate limits per plan
   - Monitor `errorsByProvider` for quota issues

3. **Prompt Injection**
   - Validate user prompts before sending to providers
   - System prompts are injected by the application
   - Be cautious with user-supplied `systemPrompt` parameter

4. **Data Privacy**
   - Ollama processes data locally (no external transmission)
   - Gemini API transmits data to Google's servers
   - Review Google's privacy policy before sending sensitive data

## Compliance with Issue #45

### Requirements Met

✓ Add ability to integrate faster APIs (Gemini support)
✓ Offset processing to paid services (Gemini)
✓ Dynamic AI-to-AI communication (synthesis endpoint)
✓ Speedy communication protocol (orchestration layer)
✓ Architect for future integrations (plugin-based provider system)

### Technical Achievements

- **Multiple Provider Support**: Extensible architecture for adding new providers
- **Hybrid Processing**: Combine free and premium models optimally
- **Intelligent Routing**: Task-based strategy selection
- **Automatic Fallback**: Service continuity and reliability
- **Multi-Provider Synthesis**: Combine insights from multiple models
- **Full Observability**: Statistics, health checks, metrics

## Future Enhancements

- [ ] Add Claude API provider
- [ ] Add OpenAI API provider
- [ ] Cost tracking and role-based budget limits
- [ ] Advanced adaptive routing (ML-based provider selection)
- [ ] Response caching for identical queries
- [ ] Batch processing for multiple queries
- [ ] Provider performance tracking and recommendations
- [ ] A/B testing framework for strategy evaluation

---

**Version:** 1.0.0 (MVP)  
**Status:** Ready for production  
**Last Updated:** 2026-04-01
