# Contributing

Thanks for helping keep skillpack current as the meta-skill frameworks evolve.

## Setup

```bash
git clone https://github.com/Onur45500/skillpack.git
cd skillpack
npm install
npm test
```

## Add a quiz question or change scoring

1. Edit [`src/pick/scoring-rules.ts`](src/pick/scoring-rules.ts).
2. Add a `Question` with short prompt + 2–4 punchy options and `scores` per outcome (`PackId` or `none`).
3. Keep the total quiz at ≤8 questions.
4. Add or update a fixture in `tests/scoring.test.ts` and an example under `examples/`.
5. Tie-breaks are deterministic via `TIE_BREAK_ORDER` (packs only; `none` does not win ties against packs) — do not re-ask questions.

## Update pack URLs / install snippets / keywords

Edit [`src/config/packs.ts`](src/config/packs.ts) only. Use `subPath` for monorepo packs (e.g. pstack under `cursor/plugins`). Do not hardcode skill counts in README or help text.

## Token estimates & tagging

- Token math lives in [`src/shared/tokens.ts`](src/shared/tokens.ts) (chars÷4).
- Phase / process-intensity heuristics live in [`src/shared/tagging.ts`](src/shared/tagging.ts).
- Adapters record both when parsing `SKILL.md`.

## Regenerate the bundled snapshot

Requires network access:

```bash
npm run regenerate-snapshot
```

This writes `data/inventory.json` from live GitHub tarballs (including pstack via `subPath`). Commit the updated file and note the date in the PR.

## Adapter layout drift

If a pack renames directories, update the matching parser in [`src/shared/adapters/index.ts`](src/shared/adapters/index.ts). Parsers **must** throw when they find 0 skills (parse-health guard). Generic repos use `parseGenericSkills` / `map fetch --repo`.

## Curate profiles

Profile I/O lives in [`src/curate/index.ts`](src/curate/index.ts). Profiles are stored under `~/.config/skillpack/profiles/` (override with `SKILLPACK_PROFILES_DIR`). Applying a profile only removes destinations listed in the previous `skillpack.manifest.json`.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

All tests are fixture/mocked — CI never clones live repos.

## Pull requests

Use the PR template checklist. Keep changes focused (scoring vs. adapters vs. docs in separate PRs when practical).
