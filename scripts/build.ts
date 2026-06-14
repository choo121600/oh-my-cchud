#!/usr/bin/env bun
// Compile standalone binaries with `bun build --compile`. This embeds the Bun
// runtime + bundled/minified JS into a single executable, so each status-line
// invocation skips TS/module parsing entirely and doesn't need `bun` on PATH.
// Config files are still read from disk at runtime, so behavior is unchanged.
//
//   bun run build            # -> dist/cchud, dist/cchud-subagent
//
// Note: binaries are platform-specific (this host's OS/arch). Rebuild per target,
// or cross-compile with --target=bun-<os>-<arch>. They are gitignored.

import { $ } from "bun";

await $`mkdir -p dist`;

await $`bun build --compile --minify ./src/statusline.ts --outfile ./dist/cchud`;
await $`bun build --compile --minify ./src/subagent-statusline.ts --outfile ./dist/cchud-subagent`;

console.log("\n✓ built dist/cchud and dist/cchud-subagent");
console.log("  point your statusLine command at the absolute path of dist/cchud");
console.log("  (re-run `bun run scripts/install-statusline.ts` to wire it automatically)");
