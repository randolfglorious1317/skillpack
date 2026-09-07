/**
 * Pack registry — repo URLs, install snippets, and keyword lists.
 * Edit this file (not logic) when frameworks evolve.
 */

export type PackId =
  | 'superpowers'
  | 'agentSkills'
  | 'mattPocock'
  | 'pstack';

export interface PackConfig {
  id: PackId;
  displayName: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  repoUrl: string;
  /**
   * Optional subdirectory inside the repo tarball that contains the pack root.
   * e.g. pstack lives under `pstack/` inside cursor/plugins.
   */
  subPath?: string;
  /** Install the whole pack as primary router */
  installPrimary: {
    claudeCode: string;
    other: string;
  };
  /** Install a single skill by name */
  installSkill: (skillName: string) => {
    claudeCode: string;
    other: string;
  };
  /** Caveat shown when cherry-picking from this pack */
  cherryPickCaveat?: string;
}

export const PACKS: Record<PackId, PackConfig> = {
  superpowers: {
    id: 'superpowers',
    displayName: 'Superpowers',
    owner: 'obra',
    repo: 'superpowers',
    defaultBranch: 'main',
    repoUrl: 'https://github.com/obra/superpowers',
    installPrimary: {
      claudeCode: '/plugin install superpowers@claude-plugins-official',
      other: 'npx skills add obra/superpowers',
    },
    installSkill: (skillName) => ({
      claudeCode: `npx skills add obra/superpowers --skill ${skillName}`,
      other: `npx skills add obra/superpowers --skill ${skillName}`,
    }),
  },
  agentSkills: {
    id: 'agentSkills',
    displayName: 'Agent Skills',
    owner: 'addyosmani',
    repo: 'agent-skills',
    defaultBranch: 'main',
    repoUrl: 'https://github.com/addyosmani/agent-skills',
    installPrimary: {
      claudeCode: 'npx skills add addyosmani/agent-skills',
      other: 'npx skills add addyosmani/agent-skills',
    },
    installSkill: (skillName) => ({
      claudeCode: `npx skills add addyosmani/agent-skills --skill ${skillName}`,
      other: `npx skills add addyosmani/agent-skills --skill ${skillName}`,
    }),
    cherryPickCaveat:
      'Per-skill install may omit shared references/ (see addyosmani/agent-skills#361). Prefer whole-repo install when possible.',
  },
  mattPocock: {
    id: 'mattPocock',
    displayName: "Matt Pocock's skills",
    owner: 'mattpocock',
    repo: 'skills',
    defaultBranch: 'main',
    repoUrl: 'https://github.com/mattpocock/skills',
    installPrimary: {
      claudeCode: 'claude plugins install mattpocock-skills',
      other: 'npx skills@latest add mattpocock/skills',
    },
    installSkill: (skillName) => ({
      claudeCode: `npx skills@latest add mattpocock/skills --skill ${skillName}`,
      other: `npx skills@latest add mattpocock/skills --skill ${skillName}`,
    }),
  },
  pstack: {
    id: 'pstack',
    displayName: 'pstack',
    owner: 'cursor',
    repo: 'plugins',
    defaultBranch: 'main',
    repoUrl: 'https://github.com/cursor/plugins',
    subPath: 'pstack',
    installPrimary: {
      claudeCode:
        'Clone cursor/plugins and copy pstack/skills into ~/.cursor/skills/',
      other:
        'npx skills add cursor/plugins --path pstack (or copy pstack/skills manually)',
    },
    installSkill: (skillName) => ({
      claudeCode: `Copy pstack/skills/${skillName} from cursor/plugins into ~/.cursor/skills/`,
      other: `Copy pstack/skills/${skillName} from cursor/plugins into your skills dir`,
    }),
    cherryPickCaveat:
      'pstack lives under the cursor/plugins monorepo (path pstack/). Prefer skillpack curate for installs.',
  },
};

export const PACK_IDS: PackId[] = [
  'superpowers',
  'agentSkills',
  'mattPocock',
  'pstack',
];

/**
 * Significant keywords used for description-overlap detection.
 * Keep short and domain-specific; edit as packs evolve.
 */
export const OVERLAP_KEYWORDS: string[] = [
  'tdd',
  'test-driven',
  'brainstorm',
  'plan',
  'review',
  'debug',
  'architecture',
  'spec',
  'prd',
  'ship',
  'deploy',
  'security',
  'performance',
  'refactor',
  'grill',
  'interview',
  'verify',
  'worktree',
  'subagent',
  'code-review',
  'accessibility',
  'unslop',
  'implement',
  'research',
];

/** Categories included when parsing Matt Pocock's repo */
export const MATTpocock_INCLUDED_CATEGORIES = [
  'engineering',
  'productivity',
] as const;

/** Categories explicitly skipped */
export const MATTpocock_SKIPPED_CATEGORIES = [
  'deprecated',
  'in-progress',
  'misc',
] as const;
