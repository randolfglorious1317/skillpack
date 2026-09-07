import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectPhase, detectProcessIntensity } from '../src/shared/tagging.js';
import { alwaysLoadedTokens, estimateTokens } from '../src/shared/tokens.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data', 'inventory.json');
const inv = JSON.parse(readFileSync(path, 'utf8')) as {
  packs: Record<
    string,
    {
      skills: Array<{
        name: string;
        description: string;
        [key: string]: unknown;
      }>;
    }
  >;
};

function enrich(s: { name: string; description: string; [key: string]: unknown }) {
  return {
    ...s,
    alwaysTokens: alwaysLoadedTokens(s.name, s.description),
    bodyTokens: Math.max(estimateTokens(s.description) * 6, 80),
    phase: detectPhase(s.name, s.description),
    processIntensity: detectProcessIntensity(s.name, s.description),
  };
}

for (const packId of Object.keys(inv.packs)) {
  inv.packs[packId]!.skills = inv.packs[packId]!.skills.map(enrich);
}

writeFileSync(path, JSON.stringify(inv, null, 2) + '\n');

const grill = inv.packs.mattPocock!.skills.find((s) => s.name === 'grill-me');
const unslop = inv.packs.pstack!.skills.find((s) => s.name === 'unslop');
console.log('grill-me', grill?.phase, grill?.processIntensity);
console.log('unslop', unslop?.phase, unslop?.processIntensity);
