---
name: install
description: Wire the oh-my-cchud main status line into ~/.claude/settings.json. Run once after installing the plugin, and again after each /plugin update.
allowed-tools: Bash
---

Wire the **oh-my-cchud** HUD into the user's `~/.claude/settings.json`.

A Claude Code plugin can only auto-apply `subagentStatusLine`, not the main
`statusLine`, so it must be wired once. Run the bundled installer — it writes a
stable launcher (`~/.claude/oh-my-cchud/statusline.sh`) and points `statusLine`
at it, so this only needs re-running after a `/plugin update`:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/scripts/install-statusline.ts"
```

Then:

1. Show the installer's output to the user.
2. If `${CLAUDE_PLUGIN_ROOT}` is empty/unset in the shell, find this plugin's
   directory under `~/.claude/plugins/` (it contains `scripts/install-statusline.ts`)
   and run the installer from there instead.
3. Remind the user that **Bun** must be installed (the status line runs `bun`),
   and to open a new prompt to see the HUD.
