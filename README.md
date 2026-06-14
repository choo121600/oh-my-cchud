# oh-my-cchud

> Performance-focused HUD for Claude Code — fed by two sources, the native `statusLine` JSON (stdin) and the session transcript JSONL, rendered as fast composable segments.

**English** · [한국어](README.ko.md)

```
[oh-my-cchud]  Opus  ⎇ main*3  ⇡ #1234 pending  ██████████░░░░ 73%  5h 41% (2h11m)  7d 88% (3d3h)
✱ high  ✻  code-reviewer ⟳1  ☑ 4/6 fixing transcript parser
```

A bottom-of-terminal status line: project · model · git · context usage · rate limits ·
reasoning effort · subagents · todo progress. No extra window or tmux. Bun + TypeScript,
zero runtime deps.

## Install

### Plugin

```bash
/plugin marketplace add choo121600/oh-my-cchud
/plugin install oh-my-cchud
/oh-my-cchud:install     # wire the main statusLine — re-run after each /plugin update
```

Requires **Bun** on PATH (the status line runs `bun`). A plugin can only auto-apply
`subagentStatusLine`, so `/oh-my-cchud:install` wires the main HUD into your
`~/.claude/settings.json` through a stable launcher that survives plugin updates.

### Manual (clone)

```bash
bun run scripts/install-statusline.ts    # writes statusLine into ~/.claude/settings.json (backup made)
```

Or set it by hand —

`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun /abs/path/to/oh-my-cchud/src/statusline.ts",
    "refreshInterval": 2
  }
}
```

## Configure

Copy `config.example.json` to `~/.claude/oh-my-cchud.json` (shallow-merged over defaults —
set only what you change). Also read from `OH_MY_CCHUD_CONFIG` or `${CLAUDE_PLUGIN_ROOT}/config.json`.

```json
{
  "theme": "default",
  "lines": [
    ["project", "model", "worktree", "git", "pr", "context", "rate"],
    ["effort", "thinking", "agents", "todos"]
  ],
  "context": { "barWidth": 14, "warn": 70, "crit": 90 },
  "rate": { "warn": 60, "crit": 85, "reset": "relative" },
  "transcript": { "tailBytes": 131072, "recentTools": 3 },
  "git": { "cacheMs": 3000 }
}
```

- **`lines`** — each array is one row; values are segment names. Reorder freely or merge into one line. `worktree`/`pr` auto-hide when absent.
- **`theme`** — `default` (Unicode) · `nerd` (Nerd Font) · `ascii` (plain). `OH_MY_CCHUD_THEME=ascii` for a quick switch; `NO_COLOR` honored.
- **`rate.reset`** — `relative` (in 2h12m) · `clock` (14:30) · `off`.

### Segments

| name | shows | source | default |
|------|-------|--------|:------:|
| `project` | `[name]` anchor (project_dir basename) | stdin | ✅ |
| `model` | model display name | stdin | ✅ |
| `context` | context bar + % (green→yellow→red), the `/compact` cue | stdin | ✅ |
| `rate` | 5h/7d limit % + time-to-reset `(2h12m)` | stdin (Pro/Max) | ✅ |
| `git` | branch + dirty count (cached; branch links to repo) | git + stdin | ✅ |
| `worktree` | worktree name:branch | stdin | ✅ |
| `effort` | reasoning effort level (colored by intensity) | stdin | ✅ |
| `thinking` | thinking active (`✻`) | stdin | ✅ |
| `agents` | running subagents | transcript | ✅ |
| `todos` | ☑ done/total + active item | transcript | ✅ |
| `pr` | PR number + review state (clickable; only with an open PR) | stdin | ✅ |
| `cost` | cost $ + elapsed `(12m34s)` | stdin | ⬜ |
| `tools` | ● active / recent tools | transcript | ⬜ |
| `output_style` | non-default output style name | stdin | ⬜ |

Opt-in segments are off by default — add the name to a line to enable. ([why these are off](DESIGN.md#whats-shown-by-default--and-what-isnt))

**Single line** — merge into one array; reasoning state reads well next to the model:

```json
{ "lines": [["project", "model", "effort", "thinking", "git", "context", "rate", "todos"]] }
```

## Build a binary (optional)

```bash
bun run build   # -> dist/cchud (self-contained; no bun on PATH needed)
```

## Preview

```bash
bun run scripts/demo.ts [transcript.jsonl]   # all three themes, no live session needed
```

## More

- Architecture, performance & design rationale — [DESIGN.md](DESIGN.md)
- Official statusLine docs — https://code.claude.com/docs/en/statusline
- Inspiration — [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud), [npow/oh-my-claude](https://github.com/npow/oh-my-claude)
