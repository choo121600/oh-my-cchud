#!/usr/bin/env bun
// One command to cut a release: bump the version in package.json, commit, and push.
// The release workflow (.github/workflows/release.yml) then tags + publishes the
// GitHub release automatically once the new version lands on main — so the only
// step a human takes is choosing the bump, and tags/releases can't drift again.
//
//   bun run release patch        # 0.1.3 -> 0.1.4
//   bun run release minor        # 0.1.3 -> 0.2.0
//   bun run release major        # 0.1.3 -> 1.0.0
//   bun run release 0.2.5        # set an explicit version

import { $ } from "bun";

const PKG = new URL("../package.json", import.meta.url).pathname;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  fail("usage: bun run release <patch|minor|major|x.y.z>");
}

const raw = await Bun.file(PKG).text();
const current = JSON.parse(raw).version as string;
const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) fail(`current version "${current}" is not plain semver (x.y.z)`);
const [major, minor, patch] = m.slice(1).map(Number) as [number, number, number];

let next: string;
switch (arg) {
  case "patch": next = `${major}.${minor}.${patch + 1}`; break;
  case "minor": next = `${major}.${minor + 1}.0`; break;
  case "major": next = `${major + 1}.0.0`; break;
  default:
    if (!/^\d+\.\d+\.\d+$/.test(arg)) fail(`"${arg}" is not patch|minor|major or a x.y.z version`);
    next = arg;
}
const tag = `v${next}`;

// Guards: clean tree, on main, tag not already taken.
const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") fail(`releases are cut from main, but you're on "${branch}"`);

const dirty = (await $`git status --porcelain`.text()).trim();
if (dirty) fail("working tree is not clean — commit or stash first");

const existingTags = (await $`git tag -l ${tag}`.text()).trim();
if (existingTags) fail(`tag ${tag} already exists`);

// Bump only the version line so the file's formatting is preserved exactly.
const bumped = raw.replace(/("version":\s*)"[^"]+"/, `$1"${next}"`);
if (bumped === raw) fail("could not locate the version field in package.json");
await Bun.write(PKG, bumped);

console.log(`• ${current} -> ${next}`);

await $`git add ${PKG}`;
await $`git commit -m ${`release: ${tag}`}`;
await $`git push origin main`;

console.log(`\n✓ pushed release: ${tag}`);
console.log("  the 'release' workflow will now tag + publish the GitHub release.");
console.log(`  watch it: gh run watch  •  releases: gh release list`);
