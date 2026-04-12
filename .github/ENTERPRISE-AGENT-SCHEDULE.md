# Autonomous Enterprise Workflow Agent - Schedule Configuration

## Overview

This document defines how to schedule the **Autonomous Enterprise Workflow Agent** to autonomously discover and resolve issues across multiple repositories on a recurring basis.

## Agent Configuration

### Agent Name

`enterprise-workflow-agent`

### Agent Description

```
Autonomous Enterprise Workflow Agent - Multi-repo issue discovery and resolution

Scans crashcart/kali-ai-term, crashcart/ollama-intelgpu, crashcart/rpg-bot,
and crashcart/discord-chromecast for open issues. Prioritizes TIER 1 (CRITICAL)
issues, detects duplicates, and autonomously executes the full workflow for
the highest-priority issue. Maintains TODO.md and PLANNING.md. Creates feature
branches, implements fixes, pushes code, and creates PRs. Never closes issues,
merges to main, or pushes directly to main.
```

## Recommended Schedules

### Option 1: Every 4 Hours (Recommended)

```
Cron: 0 */4 * * *
Times: 12:00 AM, 4:00 AM, 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM
Runs: 6 times per day
Best for: Active development with frequent updates
```

### Option 2: Daily (Conservative)

```
Cron: 0 9 * * *
Time: 9:00 AM (every morning)
Runs: 1 time per day
Best for: Steady issue resolution, fewer context switches
```

### Option 3: Every 8 Hours (Balanced)

```
Cron: 0 0,8,16 * * *
Times: 12:00 AM, 8:00 AM, 4:00 PM
Runs: 3 times per day
Best for: Regular progress without overwhelming capacity
```

### Option 4: On-Demand (Manual)

```
No schedule - trigger manually when needed
Best for: Testing or when human wants to control timing
```

## Agent Instructions

When scheduled, the agent should execute:

```
You are the Enterprise Workflow Agent. Run the full autonomous issue
resolution workflow:

1. DISCOVERY: List all open issues across these repos:
   - crashcart/kali-ai-term
   - crashcart/olama-intelgpu
   - crashcart/rpg-bot
   - crashcart/discord-chromecast
   Read ALL comments. Identify CRITICAL tickets (TIER 1 first). Detect
   duplicates. NEVER close any issues — human-only action.

2. For the highest-priority open issue:
   a. Create feature branch: type/issue-number (NEVER push to main)
   b. Read ALL monitored files listed in .github/copilot-instructions.md
   c. Update TODO.md with task breakdown
   d. Update PLANNING.md with approach and decisions
   e. Implement the fix/feature
   f. Push and create PR (NEVER auto-merge)
   g. Post [PHASE 4/4] completion comment on the issue

3. Rules that MUST be followed every run:
   - NEVER merge to main
   - NEVER close a GitHub issue
   - NEVER push to main directly
   - ALWAYS update TODO.md and PLANNING.md
   - ALWAYS read all monitored files before editing
   - ALWAYS check for conflicts after push (Rule 4a loop)
   - Push after every major change, create PR immediately after push

4. After completing the highest-priority issue:
   - Option A: Loop back to step 1 and continue with next issue
   - Option B: Post session summary and stop

Follow all rules in .github/copilot-instructions.md, especially:
- Rule 4a: Conflict Detection After Push (with looping resolution)
- Autonomous Enterprise Workflow Agent Mode section
- CRITICAL RULES (non-negotiable)
```

## How to Set Up the Schedule

### Method 1: Claude Code CLI

```bash
# Create schedule
claude schedule create \
  --name enterprise-workflow-agent \
  --description "Autonomous Enterprise Workflow Agent - Multi-repo issue resolution" \
  --schedule "0 */4 * * *" \
  --instructions "$(cat /path/to/agent-instructions.md)"

# List schedules
claude schedule list

# Run manually
claude schedule run enterprise-workflow-agent

# Edit schedule
claude schedule update enterprise-workflow-agent --schedule "0 0 * * *"

# Delete schedule
claude schedule delete enterprise-workflow-agent
```

### Method 2: Claude Code Web UI

1. Go to https://claude.ai/code
2. Navigate to Settings → Scheduled Agents
3. Click "New Scheduled Agent"
4. Fill in:
   - **Name**: `enterprise-workflow-agent`
   - **Description**: See "Agent Description" above
   - **Schedule**: Select cron option, enter `0 */4 * * *`
   - **Instructions**: Paste full agent instructions above
5. Click "Create"

### Method 3: GitHub Actions (Alternative)

If direct scheduling is unavailable, create a GitHub Actions workflow:

```yaml
# .github/workflows/enterprise-agent-schedule.yml
name: Enterprise Workflow Agent

on:
  schedule:
    - cron: '0 */4 * * *' # Every 4 hours
  workflow_dispatch: # Manual trigger

jobs:
  autonomous-agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Enterprise Workflow Agent
        run: |
          # This would trigger Claude Code to run the agent
          # (Requires GitHub integration with Claude Code)
          echo "Triggering autonomous agent..."
```

## Expected Behavior

### First Run

- Scans all 4 repositories
- Identifies and lists all open issues with TIER assignments
- Selects highest-priority issue
- Creates feature branch and begins work
- Posts initial comment: `[PHASE 1/4] ✅ COMPLETE`

### Subsequent Runs

- Resumes from current state
- Works on PRs in progress, OR
- Moves to next highest-priority issue if previous one merged
- Posts progress updates to GitHub issues
- Creates new PRs as work completes

### Session Summary

After each run, agent should post:

```
## Autonomous Agent Session Complete

**Issues Resolved**: [list with PR #s]
**Issues In-Progress**: [list with PR #s]
**High-Priority Remaining**: [list with details]

Next scheduled run: [timestamp]
```

## Monitoring

### Check Agent Health

- Look for GitHub commits from "Claude Code" or "GitHub Actions"
- Check for new PRs created by the agent
- Review comments on issues for progress updates
- Verify TODO.md and PLANNING.md are being updated

### Disable if Needed

- Comment out schedule in GitHub Actions workflow, OR
- Delete scheduled agent in Claude Code settings, OR
- Set schedule to very infrequent until issues are resolved

## Safety Guardrails

The agent is configured with these non-negotiable rules:

✅ **Enabled Safety Features**:

- Feature branches only (no main commits)
- Conflict detection after every push (Rule 4a with looping)
- TODO.md and PLANNING.md tracking
- PR-based workflow (no auto-merge)
- All changes auditable in commit history and issue comments

🚫 **Prevented Actions**:

- Cannot merge to main
- Cannot close issues
- Cannot push directly to main
- Cannot skip tests
- Cannot ignore CRITICAL issues
- Cannot auto-merge PRs

## Tuning the Schedule

### If Agent is Completing Work Too Slowly

- Increase frequency: Change `0 */4 * * *` to `0 */2 * * *` (every 2 hours)
- Or: `0 * * * *` (every hour)

### If Agent is Creating Too Many PRs

- Decrease frequency: Change to `0 0 * * *` (once daily)
- Or: `0 0 * * MON` (once weekly)

### If Agent is Getting Blocked

- Check for conflicts (Rule 4a loop should resolve them)
- Check PLANNING.md for documented blockers
- May need human intervention for architectural decisions

## Multi-Repo Considerations

The agent will:

- Create separate TODO.md and PLANNING.md per repository
- Create separate feature branches per repository
- Create separate PRs per repository (even if related issues)
- Track dependencies between repos in PLANNING.md files

This ensures each repository maintains its own workflow while coordinating across them.

## Troubleshooting

| Issue                             | Solution                                                  |
| --------------------------------- | --------------------------------------------------------- |
| Agent keeps looping on same issue | Check PLANNING.md for blockers; may need human decision   |
| Too many PRs created              | Reduce schedule frequency                                 |
| Agent not starting                | Verify schedule cron syntax                               |
| Conflicts blocking agent          | Rule 4a loop should resolve; if not, may need manual help |
| PRs not merging                   | Agent doesn't auto-merge; human review required           |

## Questions or Issues?

If the scheduled agent encounters problems it cannot resolve:

- Check the issue comments for escalation requests
- Review PLANNING.md files for documented blockers
- Check git logs for failed commits or pushes
- Verify GitHub credentials/permissions are valid
