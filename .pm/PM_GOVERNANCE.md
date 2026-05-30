# PM Governance Rules

**The Project Manager's Rule Book**

Follow these rules to stay on top of projects without being overwhelmed.

---

## Core Principle

**PM spends 3-5 minutes per project per checkin.**

Not 30 minutes. Not an hour. 3-5 minutes to understand health, identify issues, note hiring needs.

---

## Rule 1: Daily/Weekly Checkins (3-5 min each)

Every project gets a quick health check:

```bash
pm status <project>
```

This tells you:
- ✓ Branch and commit status
- ✓ Uncommitted changes (needs attention?)
- ✓ Git stashes (work in progress?)
- ✓ Quality file checklist
- ✓ Overall health

**Action**: If GOOD → move to next project. If BAD → note it.

---

## Rule 2: Bug Tracking (2-3 min)

Weekly, check what was actually fixed:

```bash
pm bugs <project>
```

**Track**:
- ✓ Bug fixes (commits with "fix:" prefix)
- ✓ Issues resolved
- ✓ NOT features (don't count new development)

**Why**: Helps distinguish maintenance from new work.

**Note**: We allow leeway for development. Don't penalize new features.

---

## Rule 3: Team Assessment

When taking on a new project:

```bash
pm team <project>
```

**Check**:
- Who's on the team?
- What roles do we need?
- Any gaps?

**If gaps exist**: Note them for Rule 5 (Hiring).

---

## Rule 4: Monthly Reports (only when asked)

**ONLY generate reports when explicitly requested.**

Don't generate obsessively. Reports are for sharing with team and stakeholders.

```bash
pm report <project>
```

**Report includes**:
- Health status
- Bug fixes this period
- Team status
- Hiring needs
- Recommendations

---

## Rule 5: Hiring Recommendations (all at once)

When hiring is needed:

```bash
pm hire <project>
```

**Important**: 
- Get ALL hiring needs at once
- Suggest all candidates together
- Don't trickle in hiring requests
- Format: Copy-paste ready for management

**Process**:
1. Identify all hiring needs across projects
2. Generate hiring recommendations
3. PM sends all at once to management
4. Management conducts interviews
5. Best candidates selected

---

## Rule 6: New Project Setup

When a new project is found:

```bash
pm init <project-path>
```

**Creates**:
- `.pm/tracking/` — metrics folder
- `.pm/reports/` — reports folder
- `.pm/team/` — team configuration
- `.pm/hiring/` — hiring recommendations

**Infrastructure is ready on first pull.**

---

## Rule 7: Track Metrics (not obsessively)

For ongoing projects, update metrics:

```bash
pm track <project>
```

**Track**:
- ✓ Bug fix velocity
- ✓ Team changes
- ✓ Performance issues
- ✓ Hiring updates

**Don't track**:
- ✗ Every feature (too noisy)
- ✗ Every commit (git handles this)
- ✗ Obsessive metrics (focus on action)

---

## Rule 8: AI Team Coordination

Other AIs see reports and metrics.

**AI workflow**:
1. Read `.pm/reports/` for current status
2. See hiring recommendations
3. Work on improvements
4. Update `.ai-workspace/` with findings

**PM is the connector**:
- AIs know what's needed
- PM knows what's done
- Reports share knowledge

---

## Rule 9: Suggested Improvements

Ask for recommendations:

```bash
pm suggest <project>
```

**Returns**:
- Quick wins (fix in < 1 hour)
- Important improvements
- Hiring needs
- Process changes

---

## Rule 10: The PM Schedule

**Per project per day/week**:
- 3-5 min: Status check (`pm status`)
- 2-3 min: Bug review (`pm bugs`)
- 1-2 min: Note any issues

**Total**: ~5-10 min per project per week

**Per project per month**:
- 10 min: Generate report (if needed)
- 5 min: Review with stakeholders

**When hiring needed**:
- 15 min: Compile all hiring needs
- 5 min: Generate candidates
- Send to management in copy-paste format

---

## Rule 11: Don't Be Slammed

If you're spending > 15 min per project per week:
- You're over-analyzing
- You're generating too many reports
- You're not delegating to AIs

**Solution**:
- Use quick checks only
- Let AIs do detailed analysis
- Only report when asked
- Let metrics be automatic

---

## Rule 12: Focus on Action

Reports should answer:
- ✓ What's broken?
- ✓ How do we fix it?
- ✓ Who do we need?
- ✓ What's next?

**NOT**:
- ✗ Excessive metrics
- ✗ Historical data
- ✗ Blame analysis
- ✗ Obsessive details

---

## Rule 13: Copy-Paste Hiring Format

When hiring is needed, format must be copy-paste ready:

```
PROJECT: project-name
ROLE: role-name
LEVEL: junior/mid/senior
SKILLS: skill1, skill2, skill3
DESCRIPTION: One line description
URGENCY: 1-5 (5 = critical)
```

Send all candidates at once, not individually.

---

## Rule 14: Team Communication

**PM is the hub**:
- Management → Knows project health, hiring needs
- AIs → Know what needs improvement, metrics
- Stakeholders → Get periodic reports

**Frequency**:
- Daily: Status (internal only)
- Weekly: Bug summary (to team)
- Monthly: Full report (if needed)
- On-demand: Hiring recommendations (to management)

---

## Rule 15: Project Lifecycle

**New Project**:
1. Run `pm init <path>`
2. Assess team
3. Note any gaps
4. Set up infrastructure

**Active Project**:
1. Weekly `pm status`
2. Weekly `pm bugs`
3. Monthly report (if needed)
4. Track improvements

**Mature Project**:
1. Bi-weekly checkins
2. Focus on bug fixes
3. Plan hiring
4. Optimize processes

---

## Summary

| Task | Time | Frequency | Command |
|------|------|-----------|---------|
| Health check | 3-5 min | Daily/Weekly | `pm status` |
| Bug review | 2-3 min | Weekly | `pm bugs` |
| Team check | 2 min | As needed | `pm team` |
| Report | 10 min | Monthly/On-demand | `pm report` |
| Hiring | 15 min | As needed | `pm hire` |
| Setup new | 10 min | Per new project | `pm init` |

**Total PM overhead: 5-10 min per project per week**

---

## Key Mindset

**You are a coordinator, not a police officer.**

- Help projects succeed
- Identify blockers early
- Get teams what they need
- Don't micromanage
- Trust the team
- Focus on action

---

**Built for efficiency. Designed to scale.**

Use these rules. Stay sane. Keep projects healthy.

