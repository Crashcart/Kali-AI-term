# 🗺️ Session Planning

**Date**: 2026-04-11
**Issue**: Restore missing live window (wire-stream panel)
**Repository**: Kali-AI-term
**Branch**: copilot/fix-live-window-issue
**Tier**: TIER 2

## Problem Statement
The "live window" (shell execution output panel) is missing from the main UI.
The intelligence stream and wire stream are merged into one panel.
The panel resizer exists in CSS and JS but has no corresponding HTML element.

## Root Cause
In `public/index.html`, the `content-area` only contains the `intelligence-panel`.
The `wire-panel`, `wire-stream`, and `panel-resizer` elements were removed (likely
as part of the unified chat/command UI merge in PR #104).

In `public/app.js`:
- `this.wireStream = this.intelligenceStream` (aliased — both streams share one panel)
- `this.wirePanel = this.intelPanel` (same alias)
- `this.panelResizer = null` (resizer not wired)
- `setupPanelResizer()` relies on `this.panelResizer` but it's null, so resizing is broken

## Approach
1. Add `wire-panel` + `panel-resizer` HTML to `content-area` in `index.html`
2. Update `app.js` `initializeElements()` to point to real DOM elements
3. Call `setupPanelResizer()` now that `panelResizer` is a real element
4. Re-wire clear/copy/search buttons for the wire panel
5. Apply saved `panelSplitRatio` on load

## Key Files
- `public/index.html` — add wire-panel and resizer HTML
- `public/app.js` — fix element references and resizer setup

## Decisions Log
- 2026-04-11: Shell output (wire stream) goes in RIGHT panel; AI intelligence in LEFT panel
- 2026-04-11: Wire panel starts at 50% width, user can drag to resize
- 2026-04-11: Wire panel will have its own clear, copy, and search controls

## Status
In Progress
