## Description
<!-- Provide a detailed description of the changes in this pull request -->

## Type of Change
<!-- Mark the relevant option with an "x" -->
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Enhancement (improvement to existing functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Dependency update
- [ ] Security patch

## Related Issues
<!-- Link to related issues using #issue-number -->
Closes #
Related to #

## Testing
<!-- Describe the testing performed -->
- [ ] Unit tests pass (`npm test:unit`)
- [ ] Integration tests pass (`npm test:integration`)
- [ ] All tests pass with coverage (`npm test`)
- [ ] Manual testing completed
- [ ] No new warnings generated

## Code Quality
- [ ] Code follows project style guidelines (`npm run lint:check`)
- [ ] Formatting is correct (`npm run format:check`)
- [ ] Comments added for complex logic
- [ ] No debug code or console logs left behind
- [ ] Security audit passed (`npm run test:security`)

## Documentation
- [ ] README.md updated (if needed)
- [ ] Inline comments added for complex logic
- [ ] API documentation updated (if applicable)
- [ ] CHANGELOG entry added

## Screenshots / Demos
<!-- If applicable, add screenshots or video of the feature -->

## Planning Agent Sign-Off
<!-- Was this work planned through the Planning Agent before implementation? -->
- [ ] Issue triaged and tiered in `TODO.md`
- [ ] Approach documented in `PLANNING.md`
- [ ] Acceptance criteria defined before coding started
- [ ] High-conflict-risk files flagged and handled
- [ ] `TODO.md` updated with completed tasks
- [ ] `PLANNING.md` updated with decisions + handoff notes

## End-of-Code Review
<!-- Automated via code-review-gate.yml — confirm before requesting human merge -->
- [ ] Code Review Gate workflow passed (conflict check ✅, ESLint ✅, tests ✅)
- [ ] No merge conflicts with target branch
- [ ] Code Review agent (or human reviewer) has reviewed all changed files
- [ ] All acceptance criteria from PLANNING.md are met

## Checklist
- [ ] I have self-reviewed my code
- [ ] I have commented complex sections
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests passed locally with my changes
- [ ] Any dependent changes have been merged and published

## Breaking Changes
<!-- Describe any breaking changes -->
- None

## Deployment Notes
<!-- Any special deployment considerations -->

---

### CI/CD Status
All of the following must pass before merge:
- ✅ Conflict Detection (code-review-gate / Conflict Detection job)
- ✅ Static Code Review (code-review-gate / Static Code Review job)
- ✅ Tests (unit + integration)
- ✅ Linting & formatting
- ✅ Security audit
- ✅ Docker build
