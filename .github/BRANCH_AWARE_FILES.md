# Branch-Aware Files Manifest

This document tracks all files that require branch-specific updates during the promotion pipeline: `feature/* → alpha → beta → test → main`.

## Installation Scripts

Files that must be branch-specific with matching filenames and internal URLs:

| Branch | Filename | Purpose | URL Pattern |
|--------|----------|---------|------------|
| main | `install.sh` | Production installer | `https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh` |
| test | `install-test.sh` | Test tier installer | `https://raw.githubusercontent.com/Crashcart/Kali-AI-term/test/install-test.sh` |
| beta | `install-beta.sh` | Beta tier installer | `https://raw.githubusercontent.com/Crashcart/Kali-AI-term/beta/install-beta.sh` |
| alpha | `install-alpha.sh` | Alpha tier installer | `https://raw.githubusercontent.com/Crashcart/Kali-AI-term/alpha/install-alpha.sh` |

### Script Header Requirement

Each installer script MUST include a comment header identifying its target branch:

```bash
#!/bin/bash
# Kali Hacker Bot Installation Script
# Target Branch: main
# Raw URL: https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh
```

## Documentation Files

Files requiring branch-specific URLs in their content:

### README.md

- **Quick Start Section**: One-liner `bash <(curl ...)` installation command
  - Must reference the correct branch (main, test, beta, or alpha)
  - Example for main: `bash <(curl -fsSL https://raw.githubusercontent.com/Crashcart/Kali-AI-term/main/install.sh)`
  
- **Installation Tier Table**: If present, must list all available tiers and their URLs
  - Clearly label which tier is recommended (usually main for production)

### .env.example

- Default values should match the stable production configuration
- No branch-specific content needed (generic across all tiers)

## Promotion Workflow

When promoting from one tier to the next:

1. **Filename Update**: Rename installer script to match target branch
   - `install-alpha.sh` → `install-beta.sh` → `install-test.sh` → `install.sh`

2. **Header URL Update**: Update the `Target Branch` and `Raw URL` comments in the installer header

3. **Documentation Update**: Update all `bash <(curl ...)` one-liners in README.md to reference new branch

4. **Verification**: Run CI validation to confirm:
   - Bash syntax is valid
   - URLs are correctly formatted
   - Filename matches branch name
   - No mismatched branch references

## Current Status

- ✅ Governance files established (copilot-instructions.md, REPO_CONFIG.md, TODO.md, PLANNING.md)
- ⏳ Tier branches not yet created (alpha, beta, test)
- ⏳ Branch-specific installers pending (install-alpha.sh, install-beta.sh, install-test.sh)
- ⏳ Protected branch rules to be configured on tier branches
- ⏳ CI validation workflows to be configured

## Notes

- Feature branches bypass this requirement (they have their own promotion path)
- Only the four tier branches (alpha, beta, test, main) require strict branch-aware file management
- All CI validation checks assume the PR target branch is the authoritative reference
