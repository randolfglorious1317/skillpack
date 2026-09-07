import { z } from 'zod';

import type { PackId } from '../config/packs.js';

export type InvocationMode = 'user' | 'auto' | 'unknown';
export type RouterStyle = 'aggressive' | 'checkpointed' | 'none';
export type WorkflowPhase =
  | 'research'
  | 'spec'
  | 'plan'
  | 'implement'
  | 'debug'
  | 'review'
  | 'docs';
export type ProcessIntensity = 'light' | 'interactive' | 'heavy-process';

export interface SkillEntry {
  name: string;
  description: string;
  filePath: string;
  category?: string;
  invocation: InvocationMode;
  /** Flat-install slash command if discoverable, e.g. "/tdd" */
  slashCommand?: string;
  /** Estimated tokens from name+description (always loaded into skill catalogs) */
  alwaysTokens: number;
  /** Estimated tokens from SKILL.md body (loaded on invocation) */
  bodyTokens: number;
  /** Workflow phase this skill primarily serves */
  phase: WorkflowPhase;
  /** How much interactive / process overhead the skill adds */
  processIntensity: ProcessIntensity;
}

export interface CommandEntry {
  name: string;
  /** e.g. "/spec", "/superpowers:brainstorming" */
  slashCommand: string;
  filePath: string;
}

export interface PackSnapshot {
  packId: PackId;
  repoUrl: string;
  refUsed: string;
  fetchedAt: string;
  skills: SkillEntry[];
  commands: CommandEntry[];
  hasSessionHook: boolean;
  routerStyle: RouterStyle;
}

export interface SkillPackInventory {
  generatedAt: string;
  source: 'bundled' | 'cache' | 'live';
  packs: Record<PackId, PackSnapshot>;
  /** Optional custom packs fetched via `map fetch --repo` */
  customPacks?: Record<string, PackSnapshot>;
}

const InvocationSchema = z.enum(['user', 'auto', 'unknown']);
const RouterStyleSchema = z.enum(['aggressive', 'checkpointed', 'none']);
const PhaseSchema = z.enum([
  'research',
  'spec',
  'plan',
  'implement',
  'debug',
  'review',
  'docs',
]);
const ProcessIntensitySchema = z.enum([
  'light',
  'interactive',
  'heavy-process',
]);

const SkillEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  filePath: z.string(),
  category: z.string().optional(),
  invocation: InvocationSchema,
  slashCommand: z.string().optional(),
  alwaysTokens: z.number().int().nonnegative(),
  bodyTokens: z.number().int().nonnegative(),
  phase: PhaseSchema,
  processIntensity: ProcessIntensitySchema,
});

const CommandEntrySchema = z.object({
  name: z.string().min(1),
  slashCommand: z.string().min(1),
  filePath: z.string(),
});

const PackIdSchema = z.enum([
  'superpowers',
  'agentSkills',
  'mattPocock',
  'pstack',
]);

const PackSnapshotSchema = z.object({
  packId: PackIdSchema,
  repoUrl: z.string().url(),
  refUsed: z.string().min(1),
  fetchedAt: z.string(),
  skills: z.array(SkillEntrySchema),
  commands: z.array(CommandEntrySchema),
  hasSessionHook: z.boolean(),
  routerStyle: RouterStyleSchema,
});

export const SkillPackInventorySchema = z.object({
  generatedAt: z.string(),
  source: z.enum(['bundled', 'cache', 'live']),
  packs: z.object({
    superpowers: PackSnapshotSchema,
    agentSkills: PackSnapshotSchema,
    mattPocock: PackSnapshotSchema,
    pstack: PackSnapshotSchema,
  }),
  customPacks: z.record(PackSnapshotSchema).optional(),
});

export function parseInventory(raw: unknown): SkillPackInventory {
  return SkillPackInventorySchema.parse(raw);
}

export function skillCount(inventory: SkillPackInventory): number {
  return Object.values(inventory.packs).reduce(
    (n, p) => n + p.skills.length,
    0,
  );
}
