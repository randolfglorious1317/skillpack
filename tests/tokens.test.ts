import { describe, expect, it } from 'vitest';

import {
  estimateTokens,
  alwaysLoadedTokens,
  bodyLoadedTokens,
} from '../src/shared/tokens.js';
import {
  detectPhase,
  detectProcessIntensity,
} from '../src/shared/tagging.js';
import { buildTokensReport } from '../src/map/tokens.js';
import { parseInventory } from '../src/shared/inventory.js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('tokens', () => {
  it('estimates chars/4', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(alwaysLoadedTokens('tdd', 'Test driven')).toBeGreaterThan(0);
    expect(bodyLoadedTokens('hello world body')).toBeGreaterThan(0);
  });
});

describe('tagging', () => {
  it('detects phase and process intensity', () => {
    expect(detectPhase('grill-me', 'Grill the user on requirements')).toBe(
      'spec',
    );
    expect(
      detectProcessIntensity(
        'grill-me',
        'Grill the user until edge cases are resolved',
      ),
    ).toBe('heavy-process');
    expect(detectPhase('systematic-debugging', 'Root cause debug')).toBe(
      'debug',
    );
    expect(detectPhase('unslop', 'Strip AI slop from review')).toBe('review');
    expect(detectProcessIntensity('tdd', 'Write failing tests')).toBe('light');
  });
});

describe('map tokens report', () => {
  it('builds per-pack context tax from bundled inventory', async () => {
    const raw = JSON.parse(
      await readFile(join(repoRoot, 'data', 'inventory.json'), 'utf8'),
    );
    const inv = parseInventory(raw);
    const report = buildTokensReport(inv);
    expect(report.packs.length).toBe(4);
    expect(report.packs.every((p) => p.contextTax > 0)).toBe(true);
    expect(report.topSkills.length).toBeGreaterThan(0);
    expect(report.comparison.length).toBe(4);
  });
});
