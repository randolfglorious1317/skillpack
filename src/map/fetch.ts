import pc from 'picocolors';

import { PACKS, type PackId } from '../config/packs.js';
import {
  writeCachedInventory,
  readCachedInventory,
  defaultCacheDir,
} from '../shared/cache.js';
import { fetchAllPacks, fetchCustomRepo, parseRepoSpec } from '../shared/fetcher.js';
import type { SkillPackInventory } from '../shared/inventory.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runMapFetch(options: {
  refresh?: boolean;
  repo?: string;
}): Promise<void> {
  if (options.repo) {
    const parsed = parseRepoSpec(options.repo);
    const key = parsed.subPath
      ? `${parsed.owner}/${parsed.repo}/${parsed.subPath}`
      : `${parsed.owner}/${parsed.repo}`;

    const snap = await fetchCustomRepo(options.repo, {
      onProgress: (msg) => console.log(msg),
    });

    const cacheDir = defaultCacheDir();
    const customDir = join(cacheDir, 'custom');
    await mkdir(customDir, { recursive: true });
    const safeName = key.replace(/[\\/]/g, '__');
    const outPath = join(customDir, `${safeName}.json`);
    await writeFile(outPath, JSON.stringify(snap, null, 2), 'utf8');

    // Merge into cached inventory customPacks when a base inventory exists
    let base = await readCachedInventory();
    if (!base) {
      // Seed from a fresh fetch of official packs if nothing cached
      console.log(
        pc.dim('No official cache yet — fetching official packs first…'),
      );
      base = await fetchAllPacks({
        onProgress: (msg) => console.log(msg),
      });
    }
    const merged: SkillPackInventory = {
      ...base,
      customPacks: { ...(base.customPacks ?? {}), [key]: snap },
      source: 'cache',
      generatedAt: new Date().toISOString(),
    };
    const invPath = await writeCachedInventory(merged);
    console.log(
      pc.green(
        `\n✓ Custom pack "${key}": ${snap.skills.length} skills → ${outPath}`,
      ),
    );
    console.log(pc.dim(`Merged into inventory at ${invPath}`));
    return;
  }

  if (!options.refresh) {
    const cached = await readCachedInventory();
    if (cached) {
      for (const packId of Object.keys(PACKS) as PackId[]) {
        const snap = cached.packs[packId];
        if (!snap) continue;
        console.log(
          pc.dim(
            `using cached snapshot for ${PACKS[packId].displayName} from ${snap.fetchedAt} (${snap.skills.length} skills), use --refresh to update.`,
          ),
        );
      }
      console.log(
        pc.green(
          `\n✓ Cache ready (${Object.values(cached.packs).reduce((n, p) => n + p.skills.length, 0)} skills total). Run skillpack map diff or skillpack pick.`,
        ),
      );
      return;
    }
  }

  const inventory = await fetchAllPacks({
    onProgress: (msg) => console.log(msg),
  });
  const path = await writeCachedInventory(inventory);
  console.log(pc.green(`\n✓ Inventory saved to ${path}`));
}
