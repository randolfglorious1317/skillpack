import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { PACKS, PACK_IDS, type PackId } from '../config/packs.js';
import { normalizeName } from '../shared/similarity.js';
import type { SkillEntry, SkillPackInventory } from '../shared/inventory.js';
import { loadInventory } from '../shared/loader.js';
import { contextTaxFor } from '../map/tokens.js';
import type { WorkflowPhase } from '../shared/tagging.js';

export interface ManifestSkill {
  packId: PackId;
  skillName: string;
  /** Relative dest folder name under skills root */
  destName: string;
  filePath: string;
  alwaysTokens: number;
  phase: string;
  processIntensity: string;
}

export interface CurateManifest {
  version: 1;
  name: string;
  createdAt: string;
  destRoot: string;
  skills: ManifestSkill[];
  contextTax: number;
}

export function profilesDir(): string {
  return (
    process.env.SKILLPACK_PROFILES_DIR ??
    join(homedir(), '.config', 'skillpack', 'profiles')
  );
}

export function activeManifestPath(destRoot: string): string {
  return join(destRoot, 'skillpack.manifest.json');
}

export function profilePath(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return join(profilesDir(), `${safe}.json`);
}

function skillKey(packId: PackId, name: string): string {
  return `${packId}:${normalizeName(name)}`;
}

/** Detect flat-name collisions within a selected subset. */
export function selectionConflicts(
  selected: Array<{ packId: PackId; skill: SkillEntry }>,
): string[] {
  const byName = new Map<string, Array<{ packId: PackId; name: string }>>();
  for (const { packId, skill } of selected) {
    const key = normalizeName(skill.name);
    const list = byName.get(key) ?? [];
    list.push({ packId, name: skill.name });
    byName.set(key, list);
  }
  const msgs: string[] = [];
  for (const [name, list] of byName) {
    const packs = new Set(list.map((l) => l.packId));
    if (packs.size >= 2) {
      msgs.push(
        `Name collision on "${name}": ${[...packs].map((id) => PACKS[id].displayName).join(' + ')}`,
      );
    }
  }
  return msgs;
}

function namespaceDest(
  packId: PackId,
  skillName: string,
  used: Set<string>,
): string {
  let dest = skillName;
  if (used.has(normalizeName(dest))) {
    dest = `${packId}-${skillName}`;
  }
  used.add(normalizeName(dest));
  return dest;
}

export function buildManifest(
  name: string,
  destRoot: string,
  selected: Array<{ packId: PackId; skill: SkillEntry }>,
): CurateManifest {
  const used = new Set<string>();
  const skills: ManifestSkill[] = selected.map(({ packId, skill }) => ({
    packId,
    skillName: skill.name,
    destName: namespaceDest(packId, skill.name, used),
    filePath: skill.filePath,
    alwaysTokens: skill.alwaysTokens,
    phase: skill.phase,
    processIntensity: skill.processIntensity,
  }));
  return {
    version: 1,
    name,
    createdAt: new Date().toISOString(),
    destRoot,
    skills,
    contextTax: contextTaxFor(selected.map((s) => s.skill)),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove only skillpack-managed dest folders listed in the previous active manifest.
 */
export async function cleanupPreviousManifest(
  destRoot: string,
): Promise<string[]> {
  const active = activeManifestPath(destRoot);
  if (!(await pathExists(active))) return [];
  const prev = JSON.parse(await readFile(active, 'utf8')) as CurateManifest;
  const removed: string[] = [];
  for (const skill of prev.skills ?? []) {
    const dir = join(destRoot, skill.destName);
    if (await pathExists(dir)) {
      await rm(dir, { recursive: true, force: true });
      removed.push(skill.destName);
    }
  }
  return removed;
}

/**
 * Install skills by copying SKILL.md directories from fixture/cache pack roots.
 * When source roots are unavailable, writes a stub SKILL.md from inventory metadata
 * so profiles remain reproducible offline.
 */
export async function applyManifest(
  manifest: CurateManifest,
  options: {
    packRoots?: Partial<Record<PackId, string>>;
    skipCleanup?: boolean;
  } = {},
): Promise<{ installed: string[]; removed: string[] }> {
  await mkdir(manifest.destRoot, { recursive: true });
  const removed = options.skipCleanup
    ? []
    : await cleanupPreviousManifest(manifest.destRoot);

  const installed: string[] = [];
  for (const skill of manifest.skills) {
    const destDir = join(manifest.destRoot, skill.destName);
    await mkdir(destDir, { recursive: true });

    const packRoot = options.packRoots?.[skill.packId];
    let copied = false;
    if (packRoot) {
      const srcSkillDir = join(packRoot, ...skill.filePath.split('/').slice(0, -1));
      if (await pathExists(srcSkillDir)) {
        await cp(srcSkillDir, destDir, { recursive: true, force: true });
        copied = true;
      }
    }
    if (!copied) {
      // Offline stub from inventory metadata
      const body = `---
name: ${skill.skillName}
description: Installed via skillpack curate profile "${manifest.name}" (pack ${skill.packId}). Re-run with live pack roots to replace stub.
---

# ${skill.skillName}

Installed by skillpack. Source: ${PACKS[skill.packId].repoUrl} (${skill.filePath}).
Phase: ${skill.phase}. Process intensity: ${skill.processIntensity}.
`;
      await writeFile(join(destDir, 'SKILL.md'), body, 'utf8');
    }
    installed.push(skill.destName);
  }

  await writeFile(
    activeManifestPath(manifest.destRoot),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
  return { installed, removed };
}

export async function saveProfile(manifest: CurateManifest): Promise<string> {
  await mkdir(profilesDir(), { recursive: true });
  const path = profilePath(manifest.name);
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return path;
}

export async function loadProfile(
  nameOrPath: string,
): Promise<CurateManifest> {
  const candidates = [
    nameOrPath,
    profilePath(nameOrPath),
    join(profilesDir(), nameOrPath),
    join(profilesDir(), `${nameOrPath}.json`),
  ];
  for (const c of candidates) {
    try {
      const raw = JSON.parse(await readFile(c, 'utf8')) as CurateManifest;
      if (raw.version === 1 && Array.isArray(raw.skills)) return raw;
    } catch {
      // try next
    }
  }
  throw new Error(`Profile not found: ${nameOrPath}`);
}

export async function listProfiles(): Promise<string[]> {
  const dir = profilesDir();
  if (!(await pathExists(dir))) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => e.endsWith('.json')).map((e) => e.replace(/\.json$/, ''));
}

const PHASE_ORDER: WorkflowPhase[] = [
  'research',
  'spec',
  'plan',
  'implement',
  'debug',
  'review',
  'docs',
];

function defaultDest(): string {
  return (
    process.env.SKILLPACK_CURATE_DEST ??
    join(homedir(), '.claude', 'skills')
  );
}

export async function runCurate(options: {
  apply?: string;
  saveAs?: string;
  dest?: string;
  yes?: boolean;
  list?: boolean;
}): Promise<void> {
  if (options.list) {
    const names = await listProfiles();
    if (names.length === 0) {
      console.log(pc.dim('No saved profiles yet. Run skillpack curate --save-as <name>.'));
      return;
    }
    console.log(pc.bold('Saved profiles'));
    for (const n of names) console.log(`  ${n}`);
    return;
  }

  if (options.apply) {
    const manifest = await loadProfile(options.apply);
    if (options.dest) manifest.destRoot = options.dest;
    const { installed, removed } = await applyManifest(manifest);
    console.log(
      pc.green(
        `✓ Applied profile "${manifest.name}" → ${manifest.destRoot}`,
      ),
    );
    if (removed.length) {
      console.log(pc.dim(`  Removed previous: ${removed.join(', ')}`));
    }
    console.log(pc.dim(`  Installed: ${installed.join(', ')}`));
    console.log(
      pc.dim(`  Context tax: ~${manifest.contextTax} always-loaded tokens`),
    );
    return;
  }

  const { inventory } = await loadInventory();
  const destRoot = options.dest ?? defaultDest();

  // Build phase-grouped options
  type Opt = {
    value: string;
    label: string;
    hint: string;
    packId: PackId;
    skill: SkillEntry;
  };
  const optionsByPhase = new Map<string, Opt[]>();
  for (const packId of PACK_IDS) {
    for (const skill of inventory.packs[packId].skills) {
      const opt: Opt = {
        value: skillKey(packId, skill.name),
        label: `${skill.name} (${PACKS[packId].displayName})`,
        hint: `~${skill.alwaysTokens} tok · ${skill.processIntensity}`,
        packId,
        skill,
      };
      const list = optionsByPhase.get(skill.phase) ?? [];
      list.push(opt);
      optionsByPhase.set(skill.phase, list);
    }
  }

  p.intro(pc.bgCyan(pc.black(' skillpack curate ')));
  const selectedKeys = new Set<string>();

  for (const phase of PHASE_ORDER) {
    const opts = optionsByPhase.get(phase);
    if (!opts || opts.length === 0) continue;
    const picked = await p.multiselect({
      message: `${phase} skills (optional)`,
      options: opts.map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.hint,
      })),
      required: false,
    });
    if (p.isCancel(picked)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    for (const v of picked as string[]) selectedKeys.add(v);
  }

  if (selectedKeys.size === 0) {
    p.cancel('No skills selected.');
    process.exit(0);
  }

  const lookup = new Map<string, Opt>();
  for (const opts of optionsByPhase.values()) {
    for (const o of opts) lookup.set(o.value, o);
  }
  const selected = [...selectedKeys]
    .map((k) => lookup.get(k))
    .filter((o): o is Opt => Boolean(o))
    .map((o) => ({ packId: o.packId, skill: o.skill }));

  const conflicts = selectionConflicts(selected);
  if (conflicts.length) {
    console.log(pc.yellow('\nConflicts in selection:'));
    for (const c of conflicts) console.log(pc.yellow(`  ! ${c}`));
    console.log(
      pc.dim('  Dest folders will be namespaced (packId-skillName) on collision.'),
    );
  }

  const tax = contextTaxFor(selected.map((s) => s.skill));
  console.log();
  console.log(
    pc.bold(`Selected ${selected.length} skills · context tax ~${tax} tokens`),
  );

  let profileName = options.saveAs;
  if (!profileName && !options.yes) {
    const name = await p.text({
      message: 'Save as profile name (or leave empty to install without saving)',
      placeholder: 'backend-api',
    });
    if (p.isCancel(name)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    profileName = (name as string).trim() || undefined;
  }

  const manifest = buildManifest(
    profileName ?? 'adhoc',
    destRoot,
    selected,
  );

  if (profileName) {
    const path = await saveProfile(manifest);
    console.log(pc.dim(`Saved profile → ${path}`));
  }

  const confirm =
    options.yes ||
    (await p.confirm({
      message: `Install ${selected.length} skills into ${destRoot}?`,
      initialValue: true,
    }));
  if (p.isCancel(confirm) || !confirm) {
    p.cancel('Not installed.');
    process.exit(0);
  }

  const { installed, removed } = await applyManifest(manifest);
  p.outro(
    `Installed ${installed.length} skills (removed ${removed.length} previous) · tax ~${tax} tok`,
  );
}
