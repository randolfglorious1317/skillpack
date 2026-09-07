# skillpack

[![CI](https://github.com/Onur45500/skillpack/actions/workflows/ci.yml/badge.svg)](https://github.com/Onur45500/skillpack/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@onur45500/skillpack.svg)](https://www.npmjs.com/package/@onur45500/skillpack)
[![npm downloads](https://img.shields.io/npm/dm/@onur45500/skillpack.svg)](https://www.npmjs.com/package/@onur45500/skillpack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

Recommend, measure token cost, and safely curate meta-skill frameworks for AI coding agents — **[Superpowers](https://github.com/obra/superpowers)**, **[Agent Skills](https://github.com/addyosmani/agent-skills)**, **[Matt Pocock's skills](https://github.com/mattpocock/skills)**, and **[pstack](https://github.com/cursor/plugins/tree/main/pstack)** — with one CLI.

`pick` runs a short quiz and prints a primary router (or an honest **none**), plus a conflict-checked cherry-pick list with token costs. `map` inventories packs, reports conflicts, and shows **context tax**. `curate` builds a minimal phase-grouped skill set and saves named profiles you can switch per project.

**Published on npm:** [`@onur45500/skillpack`](https://www.npmjs.com/package/@onur45500/skillpack)

<p align="center">
  <img src="docs/assets/pick-demo.svg" alt="skillpack pick terminal demo" width="880"/>
</p>

## Why this exists

All four frameworks are trending at once. Install two as active routers and you get colliding slash commands, contradictory session-start hooks, and skills fighting over the same intent. Community feedback is consistent:

1. Full packs can burn context before you type anything
2. Spec/grill loops can create "process hell" on small tasks
3. People mix packs by workflow phase (Matt for specs, Superpowers for debug)
4. Many prefer **no router at all** — just a curated handful of skills

skillpack fills that gap: recommend one primary (or none), show token cost, and install a minimal set.

## Why token data matters

Frontier models are strong — but every installed skill still injects name + description into the session catalog. `skillpack map tokens` answers "how much am I paying before I type?" with a chars÷4 estimate (no tokenizer dependency). Process-intensity tags (`light` / `interactive` / `heavy-process`) flag grilling/spec loops that burn more than tokens.

## Install

```bash
npx @onur45500/skillpack pick
npx @onur45500/skillpack map tokens
npx @onur45500/skillpack map diff
```

Or install globally:

```bash
npm i -g @onur45500/skillpack
skillpack pick
skillpack map tokens
skillpack curate
```

## Quick start

```bash
# Opinionated recommendation (bundled snapshot — no network required)
npx @onur45500/skillpack pick

# Non-interactive (CI / demos)
npx @onur45500/skillpack pick --yes --answers examples/barrel-through-solo.json
npx @onur45500/skillpack pick --yes --answers examples/none-small-scope.json

# Token / context-tax report
npx @onur45500/skillpack map tokens
npx @onur45500/skillpack map tokens --json

# Structural diff across packs
npx @onur45500/skillpack map diff
npx @onur45500/skillpack map html -o skillpack-map.html

# Refresh live data from GitHub (tarball download, no git binary)
npx @onur45500/skillpack map fetch --refresh

# Fetch any skills repo (forks, niche packs)
npx @onur45500/skillpack map fetch --repo owner/repo
npx @onur45500/skillpack map fetch --repo cursor/plugins/pstack

# Curate a minimal set by workflow phase; save/apply profiles
npx @onur45500/skillpack curate --save-as backend-api
npx @onur45500/skillpack curate --apply backend-api
npx @onur45500/skillpack curate --list
```

## Map report

`skillpack map html` writes a single offline HTML file with unique / overlapping / conflicting skills, plus per-pack context tax:

<p align="center">
  <img src="docs/assets/map-report.png" alt="skillpack map HTML report" width="900"/>
</p>

## Commands

| Command | Description |
| --- | --- |
| `skillpack pick` | Interactive quiz → primary router **or none** + cherry-picks + install snippets |
| `skillpack pick --yes --answers <file>` | Non-interactive answers JSON |
| `skillpack pick --json` | Emit recommendation as JSON |
| `skillpack map fetch [--refresh]` | Download & parse official packs into `~/.cache/skillpack/` |
| `skillpack map fetch --repo <owner/repo[/path]>` | Parse any SKILL.md repo as a custom pack |
| `skillpack map diff [--json] [--fail-on-collision]` | Unique / overlapping / conflicts report |
| `skillpack map tokens [--json]` | Context tax + heaviest skills |
| `skillpack map html [-o path]` | Self-contained HTML report |
| `skillpack curate` | Phase-grouped picker → install + optional named profile |
| `skillpack curate --apply <name\|file>` | Re-install a profile (removes previous skillpack-managed skills) |
| `skillpack curate --list` | List saved profiles |

## Conflict model

`map` does **not** treat plugin-namespaced commands (e.g. `/superpowers:tdd`) as collisions with `/tdd`. Red findings are:

1. **Router conflict** — two packs both injecting session/process ownership
2. **Flat-install name collision** — same skill name when copied into `~/.claude/skills/`
3. **Auto-invocation trigger overlap** — similar auto-invoked skills fighting for the same intent
4. **Un-namespaced slash-command collision** — exact `/command` matches across packs

## How this stays current

- A **bundled snapshot** (`data/inventory.json`) ships with the package so `pick` / `map tokens` work immediately offline.
- `skillpack map fetch --refresh` downloads current GitHub tarballs, parses each pack's real layout (including `subPath` for monorepos like pstack), and updates the local cache.
- Every output line that depends on snapshot data includes a **timestamp and source** (`bundled` / `cache` / `live`).
- Scoring weights live in [`src/pick/scoring-rules.ts`](src/pick/scoring-rules.ts); pack URLs and install snippets live in [`src/config/packs.ts`](src/config/packs.ts). PRs welcome as the frameworks evolve.

## Development

```bash
git clone https://github.com/Onur45500/skillpack.git
cd skillpack
npm install
npm test
npm run build
npm run regenerate-snapshot   # network required
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add quiz questions, update pack config, and regenerate the bundled snapshot.

### Suggested GitHub topics

When you configure the repo on GitHub, add: `cli`, `claude-code`, `agent-skills`, `cursor`, `typescript`, `superpowers`, `pstack`.

## License

MIT © [Onur45500](https://github.com/Onur45500)
