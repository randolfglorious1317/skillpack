import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PACKS } from '../src/config/packs.js';
import {
  fetchAllPacks,
  parseRepoSpec,
  resolvePackRoot,
} from '../src/shared/fetcher.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('fetcher (mocked network)', () => {
  it('builds inventory via injected resolve/download without network', async () => {
    const inventory = await fetchAllPacks({
      resolveShaFn: async () => 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      downloadTarballFn: async (owner, _repo, _sha, _dest) => {
        if (owner === 'obra') return join(fixtures, 'superpowers');
        if (owner === 'addyosmani') return join(fixtures, 'agent-skills');
        if (owner === 'mattpocock') return join(fixtures, 'matt-pocock');
        if (owner === 'cursor') return join(fixtures, 'pstack-repo-root');
        throw new Error(`unexpected owner ${owner}`);
      },
      workDir: join(fixtures, '..', '.tmp-fetch-work'),
    });

    expect(inventory.source).toBe('live');
    expect(inventory.packs.superpowers.skills.length).toBeGreaterThan(0);
    expect(inventory.packs.agentSkills.commands.length).toBeGreaterThan(0);
    expect(
      inventory.packs.mattPocock.skills.every((s) => s.invocation === 'user'),
    ).toBe(true);
    expect(inventory.packs.pstack.skills.length).toBeGreaterThan(0);
    expect(PACKS.superpowers.repoUrl).toContain('obra/superpowers');
  });

  it('parses owner/repo/path specs', () => {
    expect(parseRepoSpec('cursor/plugins/pstack')).toEqual({
      owner: 'cursor',
      repo: 'plugins',
      subPath: 'pstack',
    });
    expect(parseRepoSpec('obra/superpowers')).toEqual({
      owner: 'obra',
      repo: 'superpowers',
      subPath: undefined,
    });
  });

  it('resolves pack subPath under extracted root', async () => {
    const resolved = await resolvePackRoot(
      join(fixtures, 'pstack-repo-root'),
      'pstack',
    );
    expect(resolved.replace(/\\/g, '/')).toMatch(/pstack$/);
  });
});
