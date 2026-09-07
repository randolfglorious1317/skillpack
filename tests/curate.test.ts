import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  applyManifest,
  buildManifest,
  loadProfile,
  saveProfile,
  selectionConflicts,
} from '../src/curate/index.js';
import { parseInventory } from '../src/shared/inventory.js';

const repoRoot = pathJoin(dirname(fileURLToPath(import.meta.url)), '..');

describe('curate', () => {
  it('flags flat-name collisions in a selection', async () => {
    const inv = parseInventory(
      JSON.parse(
        await readFile(join(repoRoot, 'data', 'inventory.json'), 'utf8'),
      ),
    );
    const sp = inv.packs.superpowers.skills.find(
      (s) => s.name === 'test-driven-development',
    )!;
    const mp = inv.packs.mattPocock.skills.find(
      (s) => s.name === 'test-driven-development',
    )!;
    const conflicts = selectionConflicts([
      { packId: 'superpowers', skill: sp },
      { packId: 'mattPocock', skill: mp },
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('saves and applies a profile with cleanup of previous install', async () => {
    const inv = parseInventory(
      JSON.parse(
        await readFile(join(repoRoot, 'data', 'inventory.json'), 'utf8'),
      ),
    );
    const dest = await mkdtemp(join(tmpdir(), 'skillpack-curate-'));
    const profiles = await mkdtemp(join(tmpdir(), 'skillpack-profiles-'));
    process.env.SKILLPACK_PROFILES_DIR = profiles;

    try {
      const firstSkills = [
        {
          packId: 'mattPocock' as const,
          skill: inv.packs.mattPocock.skills.find((s) => s.name === 'tdd')!,
        },
      ];
      const m1 = buildManifest('test-a', dest, firstSkills);
      await saveProfile(m1);
      const { installed } = await applyManifest(m1);
      expect(installed).toContain('tdd');

      const secondSkills = [
        {
          packId: 'pstack' as const,
          skill: inv.packs.pstack.skills.find((s) => s.name === 'unslop')!,
        },
      ];
      const m2 = buildManifest('test-b', dest, secondSkills);
      const result = await applyManifest(m2);
      expect(result.removed).toContain('tdd');
      expect(result.installed).toContain('unslop');

      const loaded = await loadProfile('test-a');
      expect(loaded.skills[0]?.skillName).toBe('tdd');
      expect(m1.contextTax).toBeGreaterThan(0);
    } finally {
      await rm(dest, { recursive: true, force: true });
      await rm(profiles, { recursive: true, force: true });
      delete process.env.SKILLPACK_PROFILES_DIR;
    }
  });
});
