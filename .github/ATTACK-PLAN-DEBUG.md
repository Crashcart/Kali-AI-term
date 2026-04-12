# 🐛 Attack Plan Generation — Bug Tracking Notes

**Last Updated**: 2026-04-11  
**Symptom**: UI shows `❌ Failed to generate plan: Failed to generate attack plan`  
**Endpoint**: `POST /api/autonomous/plan`  
**Status**: ⚠️ **OPEN — root cause not yet confirmed**

---

## 📋 Symptom

When a user types `attack <ip>` or clicks the Attack button in the UI, the autonomous attack flow calls `POST /api/autonomous/plan`. The server returns HTTP 500 with:

```json
{ "error": "Failed to generate attack plan", "details": "<actual error here>" }
```

The UI (`public/app.js` line 920) only shows `err.message` which maps to `payload.error` — the **generic string**. The `payload.details` field (actual root cause) is **never displayed to the user**, making the bug appear vague.

---

## 🔁 Past Attempts — DO NOT REPEAT

### Attempt 1 — PR #102 (`copilot/fix-gemini-attack-plan-generation`, commit `38418f2`)

**What was changed:**

- Replaced deprecated `gemini-pro` default model with `gemini-1.5-flash`
- Fixed `getModels()` filter: old code checked `m.name.includes('generative')` which never matched anything; corrected to check `supportedGenerationMethods.includes('generateContent')`
- Replaced fake system-prompt workaround with proper `systemInstruction` field in `generate()` and `streamGenerate()` in `lib/gemini-provider.js`
- Threaded `preferredProvider` through `/api/ollama/generate` and `/api/ollama/stream` so AI analysis calls respect the Gemini provider selection

**What it did NOT fix:**

- The attack plan endpoint (`/api/autonomous/plan`) still returns 500 in practice
- The fix assumed Gemini was at fault, but the real failure provider is unknown because the UI hides `details`
- No test coverage was added for the autonomous plan endpoint
- The failing unit test (`gemini-config.test.js`: `returns 400 for empty-string model`) was left broken — this test expects the message `model must be a non-empty string` but when `model` is `""` and `apiKey` is not provided, the earlier `!apiKey && !model` guard fires first returning `apiKey or model is required`

---

## 🔍 Root Cause Analysis

The server at `server.js:1932` calls `orchestrator.generate(planPrompt, { ... })`.

The orchestrator (`lib/llm-orchestrator.js`) tries providers in order:

1. **Ollama** (primary) — fails if Ollama is not running, the model is not loaded, or times out
2. **Gemini** (fallback) — fails if `GEMINI_API_KEY` is not set at startup (provider never registered) or if the API key is invalid

If **both** fail, orchestrator throws: `All providers failed. Last error: <Ollama/Gemini error>` — this lands in `details`, not `error`.

### Most likely failure scenarios (in priority order):

| #   | Scenario                                                                                  | How to confirm                                                                        |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Ollama container not running / not reachable at `OLLAMA_URL`                              | `curl http://localhost:11434/api/tags`                                                |
| 2   | The model in `this.ollamaModel` (sent as `model` in request body) is not pulled in Ollama | `curl http://localhost:11434/api/tags \| jq '.models[].name'`                         |
| 3   | `GEMINI_API_KEY` not set so Gemini fallback was never registered                          | Check server startup log for `⚠ GEMINI_API_KEY not set`                               |
| 4   | Gemini API key set but invalid / quota exceeded                                           | Check `details` field in API response                                                 |
| 5   | JSON parse failure — AI wrapped response in markdown fences                               | `details` will say `Failed to parse AI plan` or `AI did not return a valid JSON plan` |

---

## 🔧 What Still Needs To Be Fixed

### Fix 1 — Surface `details` in the UI (EASY, high value)

In `public/app.js` line 920, change:

```js
this.addIntelligenceMessage(`❌ Failed to generate plan: ${err.message}`, 'red');
```

to also show `err.payload?.details`:

```js
const detail = err.payload?.details ? ` — ${err.payload.details}` : '';
this.addIntelligenceMessage(`❌ Failed to generate plan: ${err.message}${detail}`, 'red');
```

This alone will reveal the actual error without any server changes.

### Fix 2 — The failing unit test (`gemini-config.test.js` line 277)

The test sends `{ model: '' }` (no `apiKey`) and expects `model must be a non-empty string`.  
The server check at line 824 (`if (!apiKey && !model)`) fires first and returns `apiKey or model is required`.

Fix: reorder the validation in `server.js` — check individual field emptiness **before** the "at least one required" guard, or change the test expectation to match current behaviour. Both approaches are valid; pick one and stick with it.

### Fix 3 — Provider registration logging at plan time (EASY)

At `server.js:1933` (the `orchestrator.generate` call), log which providers are actually registered before attempting:

```js
appLogger.debug(
  `Plan attempt — providers registered: ${[...orchestrator.providers.keys()].join(', ')}`
);
```

This will confirm whether Gemini/Ollama are both available when the call is made.

---

## 🛑 Things NOT to change again (already done in PR #102)

- `gemini-provider.js` default model (`gemini-1.5-flash`) — already correct
- `gemini-provider.js` `systemInstruction` field — already correct
- `gemini-provider.js` `getModels()` filter — already correct
- `preferredProvider` threading through `/api/ollama/generate` — already done

---

## 🧪 Diagnostic Commands

Run these against the live server to pinpoint the failure **before writing any code**:

```bash
# 1. Is Ollama reachable?
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# 2. Test Ollama generation directly (replace model name as needed)
curl -s -X POST http://localhost:11434/api/generate \
  -d '{"model":"phi3:mini","prompt":"say hello","stream":false}' | jq '.response'

# 3. Check server Docker logs for provider registration and errors
docker logs kali-ai-term-app --tail=100 2>&1 | grep -E "ERROR|WARN|provider|plan|Gemini|Ollama"

# 4. Hit the plan endpoint directly (after auth) and inspect the `details` field
curl -s -X POST http://localhost:3000/api/autonomous/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"target":"192.168.1.2"}' | jq .
```

---

## 📁 Key Files

| File                                       | Relevance                                      |
| ------------------------------------------ | ---------------------------------------------- |
| `server.js:1890–1966`                      | `POST /api/autonomous/plan` handler            |
| `lib/llm-orchestrator.js:generate()`       | Provider routing + fallback logic              |
| `lib/ollama-provider.js:generate()`        | Ollama API call                                |
| `lib/gemini-provider.js:generate()`        | Gemini API call                                |
| `public/app.js:912–925`                    | Frontend plan call + error display             |
| `tests/unit/gemini-config.test.js:270–278` | Failing test for empty-string model validation |
