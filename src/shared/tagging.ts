export type WorkflowPhase =
  | 'research'
  | 'spec'
  | 'plan'
  | 'implement'
  | 'debug'
  | 'review'
  | 'docs';

export type ProcessIntensity = 'light' | 'interactive' | 'heavy-process';

const PHASE_RULES: Array<{ phase: WorkflowPhase; patterns: RegExp[] }> = [
  {
    phase: 'research',
    patterns: [
      /\bresearch\b/i,
      /\bwayfinder\b/i,
      /\bbrainstorm\b/i,
      /\bexplore\b/i,
      /\binvestigat/i,
    ],
  },
  {
    phase: 'spec',
    patterns: [
      /\bspec\b/i,
      /\bprd\b/i,
      /\brequirements?\b/i,
      /\bgrill\b/i,
      /\binterview\b/i,
      /\bto-prd\b/i,
      /\bto-spec\b/i,
    ],
  },
  {
    phase: 'plan',
    patterns: [
      /\bplan\b/i,
      /\btask[- ]?break/i,
      /\bwriting-plans\b/i,
      /\bbreakdown\b/i,
    ],
  },
  {
    phase: 'debug',
    patterns: [
      /\bdebug\b/i,
      /\bdiagnos/i,
      /\broot[- ]?cause\b/i,
      /\bsystematic-debugging\b/i,
    ],
  },
  {
    phase: 'review',
    patterns: [
      /\breview\b/i,
      /\bcode-review\b/i,
      /\bverif/i,
      /\baudit\b/i,
      /\bunslop\b/i,
    ],
  },
  {
    phase: 'docs',
    patterns: [
      /\bdocstring\b/i,
      /\bdocumentation\b/i,
      /\bwriting-for-agents\b/i,
      /\bwriting-great-skills\b/i,
      /\bwriting-skills\b/i,
      /\bhandoff\b/i,
    ],
  },
  {
    phase: 'implement',
    patterns: [
      /\bimplement\b/i,
      /\btdd\b/i,
      /\btest-driven\b/i,
      /\bbuild\b/i,
      /\bexecut/i,
      /\bship\b/i,
      /\bdeploy\b/i,
      /\bworktree\b/i,
      /\bsubagent\b/i,
    ],
  },
];

const HEAVY_PATTERNS: RegExp[] = [
  /\bgrill\b/i,
  /\binterview\b/i,
  /\bspawn(ing)?\s+(additional\s+)?(issues?|questions?)/i,
  /\bmulti[- ]?step\b/i,
  /\bcheckpoint/i,
  /\buntil\s+(edge\s+cases|resolved|approved)/i,
  /\bhuman\s+approval\b/i,
  /\bstop\s+for\b/i,
  /\bissue\s+creat/i,
  /\bspec[- ]driven\b/i,
  /\bprd\b/i,
  /\bgenerate\s+(a\s+)?(spec|prd|plan|issues?)/i,
];

const INTERACTIVE_PATTERNS: RegExp[] = [
  /\bask\b/i,
  /\bquestion/i,
  /\bconfirm\b/i,
  /\bclarif/i,
  /\bpair\b/i,
  /\bdiscuss/i,
  /\buser\s+must\b/i,
  /\binvoke/i,
];

/**
 * Classify workflow phase from skill name + description + optional body.
 * First matching rule wins (research → … → implement fallback).
 */
export function detectPhase(
  name: string,
  description: string,
  body = '',
): WorkflowPhase {
  const haystack = `${name}\n${description}\n${body}`;
  for (const rule of PHASE_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) {
      return rule.phase;
    }
  }
  return 'implement';
}

/**
 * Classify process intensity — how much interactive / process overhead the skill adds.
 */
export function detectProcessIntensity(
  name: string,
  description: string,
  body = '',
): ProcessIntensity {
  const haystack = `${name}\n${description}\n${body}`;
  if (HEAVY_PATTERNS.some((p) => p.test(haystack))) {
    return 'heavy-process';
  }
  if (INTERACTIVE_PATTERNS.some((p) => p.test(haystack))) {
    return 'interactive';
  }
  return 'light';
}
