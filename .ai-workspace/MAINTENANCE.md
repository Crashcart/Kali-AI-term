# AI Workspace Maintenance

**How to keep the space free and useful**

## Periodic Checks

Run this whenever you stop working:

```bash
./ai-workspace-check.sh
```

This checks:
- ✓ Workspace exists and is accessible
- ✓ No rules are creeping in
- ✓ Git stashes are being processed
- ✓ Old files are being managed
- ✓ Notes are being kept

## What to Do Each Session

### Start
1. Run `./ai-workspace-check.sh` to see context
2. Check `.ai-workspace/` for previous findings
3. Check `git stash list` for in-progress work
4. Read `AI_RESEARCH_NOTES.md` for ongoing research

### Work
1. Drop findings in `.ai-workspace/` as you go
2. Update `AI_RESEARCH_NOTES.md` with discoveries
3. Leave clear notes for the next AI
4. Link to actual code when relevant

### Stop
1. Commit your work: `git add .ai-workspace AI_RESEARCH_NOTES.md && git commit -m "ai-workspace: update notes"`
2. Run `./ai-workspace-check.sh` to verify everything is captured
3. Leave the workspace clean for the next AI

## Processing Stashes

When `ai-workspace-check.sh` shows stashed work:

```bash
# See what's in the stash
git stash show -p stash@{0}

# Apply to your working tree
git stash pop

# Or review then drop
git stash drop
```

## Handling Rule Creep

The workspace should **never** have:
- ❌ RULES.md or GUIDELINES.md files
- ❌ Forced folder structure
- ❌ "Don't put X here" instructions
- ❌ Approval processes or reviews
- ❌ Standardized formats

If you see any, consider removing them. The space is **for work, not rules**.

## Adding to Notes

```markdown
### [Date/Time] What You Did

- What you found
- What you tried
- What you learned
- Links to code: server.js:150, plugins/x.js

Next AI should:
- Check this thing
- Look at that code
- Try this approach
```

## Committing Workspace Changes

```bash
git add .ai-workspace AI_RESEARCH_NOTES.md
git commit -m "ai-workspace: [brief description]"
```

Examples:
- `ai-workspace: add notes on performance issue`
- `ai-workspace: stash Opus improvements for review`
- `ai-workspace: document authentication findings`

## Keep It Simple

- **Notes** should be readable (add timestamps)
- **Files** should have clear purpose
- **Structure** should be obvious but not enforced
- **Communication** between AIs should be clear

No rules. Just good notes. Help the next AI pick up where you left off.
