import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import * as tar from 'tar';

import { PACKS, type PackId } from '../config/packs.js';
import {
  parseAgentSkills,
  parseGenericSkills,
  parseMattPocock,
  parsePstack,
  parseSuperpowers,
} from './adapters/index.js';
import { pathExists } from './adapters/common.js';
import type { PackSnapshot, SkillPackInventory } from './inventory.js';

export interface FetchProgress {
  (message: string): void;
}

export interface ResolveShaFn {
  (owner: string, repo: string, branch: string): Promise<string>;
}

export interface DownloadTarballFn {
  (owner: string, repo: string, sha: string, destDir: string): Promise<string>;
}

/** Resolve HEAD commit sha via GitHub API (no git binary). */
export async function resolveSha(
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'skillpack-cli',
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to resolve sha for ${owner}/${repo}@${branch}: ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { sha?: string };
  if (!data.sha) {
    throw new Error(`No sha in GitHub response for ${owner}/${repo}`);
  }
  return data.sha;
}

/**
 * Download and extract a GitHub tarball into destDir.
 * Returns the extracted root directory (codeload wraps in owner-repo-sha/).
 */
export async function downloadTarball(
  owner: string,
  repo: string,
  sha: string,
  destDir: string,
): Promise<string> {
  await mkdir(destDir, { recursive: true });
  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/${sha}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'skillpack-cli' },
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `Failed to download tarball ${owner}/${repo}@${sha}: ${res.status}`,
    );
  }

  const tgzPath = join(destDir, `${repo}-${sha}.tar.gz`);
  const fileStream = createWriteStream(tgzPath);
  // Node fetch body → Node stream
  const nodeStream = Readable.fromWeb(
    res.body as import('node:stream/web').ReadableStream,
  );
  await pipeline(nodeStream, fileStream);

  const extractDir = join(destDir, 'extracted');
  await mkdir(extractDir, { recursive: true });
  await tar.x({ file: tgzPath, cwd: extractDir });

  // GitHub tarballs extract to <repo>-<sha>/ or <owner>-<repo>-<shortsha>/
  const { readdir } = await import('node:fs/promises');
  const kids = await readdir(extractDir);
  if (kids.length !== 1 || !kids[0]) {
    throw new Error(
      `Unexpected tarball layout for ${owner}/${repo}: ${kids.join(', ')}`,
    );
  }
  return join(extractDir, kids[0]);
}

/** Apply pack subPath (e.g. pstack inside cursor/plugins). */
export async function resolvePackRoot(
  extractedRoot: string,
  subPath?: string,
): Promise<string> {
  if (!subPath) return extractedRoot;
  const nested = join(extractedRoot, ...subPath.split('/').filter(Boolean));
  if (!(await pathExists(nested))) {
    throw new Error(
      `Pack subPath "${subPath}" not found under extracted tarball root`,
    );
  }
  return nested;
}

async function parsePack(
  packId: PackId,
  rootDir: string,
  refUsed: string,
  fetchedAt: string,
): Promise<PackSnapshot> {
  const config = PACKS[packId];
  switch (packId) {
    case 'superpowers':
      return parseSuperpowers(rootDir, config, refUsed, fetchedAt);
    case 'agentSkills':
      return parseAgentSkills(rootDir, config, refUsed, fetchedAt);
    case 'mattPocock':
      return parseMattPocock(rootDir, config, refUsed, fetchedAt);
    case 'pstack':
      return parsePstack(rootDir, config, refUsed, fetchedAt);
  }
}

export interface FetchOptions {
  refresh?: boolean;
  onProgress?: FetchProgress;
  resolveShaFn?: ResolveShaFn;
  downloadTarballFn?: DownloadTarballFn;
  workDir?: string;
}

export async function fetchAllPacks(
  options: FetchOptions = {},
): Promise<SkillPackInventory> {
  const {
    onProgress = () => undefined,
    resolveShaFn = resolveSha,
    downloadTarballFn = downloadTarball,
  } = options;

  const workDir =
    options.workDir ?? (await mkdtemp(join(tmpdir(), 'skillpack-')));
  const fetchedAt = new Date().toISOString();
  const packs = {} as SkillPackInventory['packs'];

  try {
    for (const packId of Object.keys(PACKS) as PackId[]) {
      const config = PACKS[packId];
      onProgress(`Resolving ${config.displayName}…`);
      const sha = await resolveShaFn(
        config.owner,
        config.repo,
        config.defaultBranch,
      );
      onProgress(
        `Downloading ${config.displayName} @ ${sha.slice(0, 7)}…`,
      );
      const packWork = join(workDir, packId);
      await mkdir(packWork, { recursive: true });
      const extracted = await downloadTarballFn(
        config.owner,
        config.repo,
        sha,
        packWork,
      );
      const root = await resolvePackRoot(extracted, config.subPath);
      onProgress(`Parsing ${config.displayName}…`);
      packs[packId] = await parsePack(packId, root, sha, fetchedAt);
      onProgress(
        `✓ ${config.displayName}: ${packs[packId].skills.length} skills found`,
      );
    }

    return {
      generatedAt: fetchedAt,
      source: 'live',
      packs,
    };
  } finally {
    if (!options.workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export interface RepoSpec {
  owner: string;
  repo: string;
  /** Optional path inside the repo */
  subPath?: string;
  branch?: string;
}

/** Parse `owner/repo` or `owner/repo/path/to/pack`. */
export function parseRepoSpec(spec: string): RepoSpec {
  const parts = spec.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid --repo "${spec}". Expected owner/repo or owner/repo/sub/path`,
    );
  }
  const owner = parts[0]!;
  const repo = parts[1]!;
  const subPath =
    parts.length > 2 ? parts.slice(2).join('/') : undefined;
  return { owner, repo, subPath };
}

/**
 * Fetch and parse an arbitrary GitHub repo containing SKILL.md files.
 * Stored as a custom pack key `${owner}/${repo}` (with optional path suffix).
 */
export async function fetchCustomRepo(
  spec: string,
  options: FetchOptions = {},
): Promise<PackSnapshot> {
  const {
    onProgress = () => undefined,
    resolveShaFn = resolveSha,
    downloadTarballFn = downloadTarball,
  } = options;

  const parsed = parseRepoSpec(spec);
  const branch = parsed.branch ?? 'main';
  const workDir =
    options.workDir ?? (await mkdtemp(join(tmpdir(), 'skillpack-custom-')));
  const fetchedAt = new Date().toISOString();

  try {
    onProgress(`Resolving ${parsed.owner}/${parsed.repo}@${branch}…`);
    const sha = await resolveShaFn(parsed.owner, parsed.repo, branch);
    onProgress(`Downloading @ ${sha.slice(0, 7)}…`);
    const extracted = await downloadTarballFn(
      parsed.owner,
      parsed.repo,
      sha,
      workDir,
    );
    const root = await resolvePackRoot(extracted, parsed.subPath);
    onProgress('Parsing SKILL.md files…');
    const packKey = parsed.subPath
      ? `${parsed.owner}/${parsed.repo}/${parsed.subPath}`
      : `${parsed.owner}/${parsed.repo}`;
    // Use mattPocock as a stand-in PackId for schema; callers store under customPacks
    const snap = await parseGenericSkills(root, {
      packId: 'mattPocock',
      repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      refUsed: sha,
      fetchedAt,
    });
    // Preserve identity in repoUrl query-ish path note via ref; custom key is separate
    return { ...snap, repoUrl: `https://github.com/${packKey}` };
  } finally {
    if (!options.workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Parse packs from already-extracted directories (used by regenerate script / tests). */
export async function parseFromDirs(
  dirs: Record<PackId, { root: string; ref: string }>,
  source: SkillPackInventory['source'] = 'live',
): Promise<SkillPackInventory> {
  const fetchedAt = new Date().toISOString();
  const packs = {} as SkillPackInventory['packs'];
  for (const packId of Object.keys(dirs) as PackId[]) {
    const { root, ref } = dirs[packId];
    packs[packId] = await parsePack(packId, root, ref, fetchedAt);
  }
  return { generatedAt: fetchedAt, source, packs };
}
