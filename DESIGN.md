# Design notes

The *why* behind oh-my-cchud — architecture, performance, and the reasoning for
what's shown by default. The [README](README.md) covers how to install and use it;
this file is for contributors and the curious.

## Two-source architecture

A status line gets one JSON blob on stdin. That's enough for budgets and identity,
but not for "what is Claude doing right now" — so we also tail-read the transcript.

| source | how | yields |
|--------|-----|--------|
| **statusLine JSON** (stdin) | injected by Claude Code on every refresh | model · `context_window.used_percentage` (native, exact) · `rate_limits` (used % + `resets_at`) · cost · git/worktree · effort/thinking |
| **transcript JSONL** (`transcript_path`) | we read the tail of the session log | active tool · subagents (`isSidechain` / `Task`) · todo progress (`TodoWrite`) |

## Performance

The status line runs as a **fresh process on every refresh event** (debounced
~300ms). So process startup and per-run work are the whole budget.

1. **Minimal cold start** — Bun + zero deps. Measured **~47ms/call** (cold start +
   128 KiB transcript parse + git), well inside the 300ms window.
2. **Never read the whole transcript** — a session log grows to many MB. We `seek`
   to the last `tailBytes` (default 128 KiB) and parse only that. Cost is
   `O(tailBytes)`, flat regardless of session length. The leading partial line is
   discarded.
3. **Cache expensive ops** — `git status` is cached to a temp file keyed by
   `session_id` (3s TTL). A pid-based key changes every invocation and defeats the
   cache; `session_id` is stable per session and unique across concurrent sessions
   (per the official docs).
4. **Survive idle** — refresh triggers go quiet while the main session waits on
   background subagents. `refreshInterval` re-runs on a timer to keep time-based
   segments (rate reset, git state) current.
5. **Never crash** — segment and parse errors are isolated; worst case is an empty
   line or a short fallback string, never a broken status line.

### Cold start & the binary

`bun run build` produces a `bun build --compile` single binary (`dist/cchud`).
**It is not faster:**

| run | avg (20×) |
|-----|-----------|
| `bun src/statusline.ts` | ~48ms |
| `dist/cchud` (compiled) | ~47ms |

The bottleneck is Bun runtime init (~45ms), not TS parsing, so compiling saves
nothing measurable. The binary's value is **portability** — no `bun` on PATH, a
self-contained artifact (per OS/arch, ~55MB). If sub-10ms ever mattered, the only
real path is a resident daemon the status line talks to over a socket — unnecessary
at this budget.

## What's shown by default — and what isn't

One rule: **show only signals that aren't already on screen and that you'd act on.**

**Line 1** — `[project]` anchor + identity + the two budget gauges. `context%`
(drives the `/compact` decision) and `rate%` (the quota) sit together because both
answer "how much headroom is left." `pr`/`worktree` auto-hide when absent, so they
only appear when relevant.

**Line 2** — reasoning state first (`effort`/`thinking` — what's driving token burn),
then the activity Claude Code's main UI does *not* persist: subagents and todos.

Default-on niceties:
- **`context`** is the headline because the color thresholds *are* the compact cue
  (green <70, yellow 70–89, red ≥90 → compact now). `used_percentage` is input-only,
  the right metric for "how full is the context."
- **`rate`** shows time-to-reset, which matters most exactly when you're near the
  limit: 88% on the 7-day window means very different things at "resets in 4h" vs
  "resets in 3 days."
- **`effort`** is colored by intensity — `high` (the token-expensive mode) gets a
  warning color so it stands out.

Off by default (segments still exist; add the name to a line to enable):

| segment | why it's off |
|---------|--------------|
| `cost` | For Pro/Max it's a flat-rate artifact (Claude Code's API-equivalent estimate, not real spend) → `rate` is the real budget signal. On **API/pay-go** plans add it back (there `rate_limits` is absent, so `rate` auto-hides — the two are complementary). |
| `tools` | The active tool is already shown live, with a spinner, in Claude Code's own UI. Duplicating it is redundant, and the status line refreshes on a lag so it's also staler. |
| `output_style` | A rarely-changed, user-set value that drives no action. |

## Plugin can't set the main statusLine

A plugin's bundled `settings.json` only applies the `agent` and
`subagentStatusLine` keys — **not** the main `statusLine`. So oh-my-cchud ships as
a plugin (code distribution + auto-applied `subagentStatusLine`), and the main HUD
is wired into the user's own `settings.json` by `scripts/install-statusline.ts`.
This is why install is a two-step. claude-hud works the same way.

## Project structure

```
oh-my-cchud/
├── .claude-plugin/
│   ├── plugin.json             # plugin manifest
│   └── marketplace.json        # marketplace entry
├── settings.json               # bundled (subagentStatusLine, auto-applied)
├── src/
│   ├── statusline.ts           # entry: stdin → parse → render
│   ├── subagent-statusline.ts  # per-subagent row overrides
│   ├── transcript.ts           # tail-read JSONL parser
│   ├── cache.ts                # session_id-keyed disk cache
│   ├── segments.ts             # segment registry (14)
│   ├── render.ts               # line assembly
│   ├── config.ts               # config loading + defaults
│   ├── theme.ts                # themes (default/nerd/ascii)
│   ├── ansi.ts                 # color / OSC 8 link helpers
│   └── types.ts                # statusLine JSON + transcript types
├── scripts/
│   ├── demo.ts                 # preview all three themes
│   ├── build.ts                # single-binary build
│   └── install-statusline.ts   # wire the main statusLine
└── config.example.json
```
