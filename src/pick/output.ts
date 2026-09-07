import * as p from '@clack/prompts';
import pc from 'picocolors';

import { PACKS, type PackId } from '../config/packs.js';
import { safeCherryPicks } from '../shared/diff.js';
import type { SkillEntry, SkillPackInventory } from '../shared/inventory.js';
import { loadInventory } from '../shared/loader.js';
import {
  NONE_SEED_SKILLS,
  QUESTIONS,
  type OutcomeId,
  type QuestionId,
} from './scoring-rules.js';
import {
  scoreAnswers,
  validateAnswers,
  type Answers,
  type ScoreBreakdown,
} from './scoring.js';

export interface CherryPickRec {
  packId: PackId;
  skillName: string;
  description: string;
  ok: boolean;
  detail: string;
  caveat?: string;
  install: { claudeCode: string; other: string };
  alwaysTokens: number;
  bodyTokens: number;
  phase: string;
  processIntensity: string;
}

export interface Recommendation {
  framework: OutcomeId;
  displayName: string;
  scores: Record<OutcomeId, number>;
  tied: OutcomeId[];
  rationale: string;
  cherryPicks: CherryPickRec[];
  installPrimary: { claudeCode: string; other: string } | null;
  provenance: string;
  generatedAt: string;
  /** Present when framework === 'none' */
  skipRouters?: boolean;
}

function outcomeDisplayName(id: OutcomeId): string {
  if (id === 'none') return 'No framework (curate individually)';
  return PACKS[id].displayName;
}

function buildRationale(
  winner: OutcomeId,
  breakdown: ScoreBreakdown,
  _answers: Answers,
): string {
  const name = outcomeDisplayName(winner);
  const labels: string[] = [];

  for (const driver of breakdown.rationaleDrivers) {
    if (!driver.contributed.includes(winner)) continue;
    if (!labels.includes(driver.optionLabel)) {
      labels.push(driver.optionLabel);
    }
  }

  const uniqueBits = labels.slice(0, 3);
  let text: string;
  if (winner === 'none') {
    text =
      'Your answers point to skipping a full meta-skill router — keep a lean set of individual skills instead.';
    if (uniqueBits.length > 0) {
      text += ` Drivers: ${uniqueBits.map((l) => `"${l}"`).join(', ')}.`;
    }
  } else if (uniqueBits.length === 0) {
    text = `${name} scored highest on your answers.`;
  } else if (uniqueBits.length === 1) {
    text = `You chose "${uniqueBits[0]}" — ${name} fits that directly.`;
  } else {
    const last = uniqueBits[uniqueBits.length - 1];
    const head = uniqueBits.slice(0, -1).map((l) => `"${l}"`).join(', ');
    text = `You chose ${head}, and "${last}" — ${name} fits that profile directly.`;
  }

  if (breakdown.tied.length > 1) {
    const others = breakdown.tied
      .filter((t) => t !== winner)
      .map((t) => outcomeDisplayName(t))
      .join(' and ');
    text += ` It was close with ${others}; tie-break preferred ${name}.`;
  }
  return text;
}

function toCherryPick(
  packId: PackId,
  skill: SkillEntry,
  ok: boolean,
  detail: string,
): CherryPickRec {
  const cfg = PACKS[packId];
  return {
    packId,
    skillName: skill.name,
    description: skill.description,
    ok,
    detail,
    caveat: cfg.cherryPickCaveat,
    install: cfg.installSkill(skill.name),
    alwaysTokens: skill.alwaysTokens,
    bodyTokens: skill.bodyTokens,
    phase: skill.phase,
    processIntensity: skill.processIntensity,
  };
}

function noneSeedPicks(inventory: SkillPackInventory): CherryPickRec[] {
  const picks: CherryPickRec[] = [];
  for (const seed of NONE_SEED_SKILLS) {
    const skill = inventory.packs[seed.packId]?.skills.find(
      (s) => s.name === seed.name,
    );
    if (!skill) continue;
    picks.push(
      toCherryPick(
        seed.packId,
        skill,
        true,
        `community favorite · ~${skill.alwaysTokens} always-loaded tokens · ${skill.processIntensity}`,
      ),
    );
    if (picks.length >= 5) break;
  }
  // Fallback: leanest user-invoked skills across packs
  if (picks.length < 3) {
    const lean = Object.entries(inventory.packs)
      .flatMap(([packId, snap]) =>
        snap.skills
          .filter((s) => s.invocation === 'user')
          .map((skill) => ({ packId: packId as PackId, skill })),
      )
      .sort((a, b) => a.skill.alwaysTokens - b.skill.alwaysTokens);
    for (const { packId, skill } of lean) {
      if (picks.some((p) => p.skillName === skill.name && p.packId === packId)) {
        continue;
      }
      picks.push(
        toCherryPick(
          packId,
          skill,
          true,
          `lean user-invoked · ~${skill.alwaysTokens} always-loaded tokens`,
        ),
      );
      if (picks.length >= 5) break;
    }
  }
  return picks;
}

export function buildRecommendation(
  answers: Answers,
  inventory: SkillPackInventory,
  provenance: string,
): Recommendation {
  validateAnswers(answers);
  const breakdown = scoreAnswers(answers);
  const winner = breakdown.winner;

  if (winner === 'none') {
    return {
      framework: 'none',
      displayName: outcomeDisplayName('none'),
      scores: breakdown.scores,
      tied: breakdown.tied,
      rationale: buildRationale(winner, breakdown, answers),
      cherryPicks: noneSeedPicks(inventory),
      installPrimary: null,
      provenance,
      generatedAt: inventory.generatedAt,
      skipRouters: true,
    };
  }

  const picks = safeCherryPicks(inventory, winner, 5);
  const cherryPicks = picks.map((pick) =>
    toCherryPick(
      pick.packId,
      pick.skill,
      !pick.skip,
      pick.skip
        ? `SKIP: ${pick.skipReason}`
        : `${pick.reason} · ~${pick.skill.alwaysTokens} tok · ${pick.skill.phase}/${pick.skill.processIntensity}`,
    ),
  );

  return {
    framework: winner,
    displayName: PACKS[winner].displayName,
    scores: breakdown.scores,
    tied: breakdown.tied,
    rationale: buildRationale(winner, breakdown, answers),
    cherryPicks,
    installPrimary: PACKS[winner].installPrimary,
    provenance,
    generatedAt: inventory.generatedAt,
  };
}

export function printRecommendation(rec: Recommendation): void {
  console.log();
  if (rec.skipRouters) {
    console.log(
      pc.bold('Recommendation: ') + pc.bold(pc.cyan(rec.displayName)),
    );
    console.log();
    console.log(pc.dim(rec.rationale));
    console.log();
    console.log(
      pc.bold('Skip all routers. Start with these individual skills:'),
    );
  } else {
    console.log(
      pc.bold('Your primary router: ') + pc.bold(pc.cyan(rec.displayName)),
    );
    console.log();
    console.log(pc.dim(rec.rationale));
    console.log();
    console.log(
      pc.bold('Safe to cherry-pick alongside ' + rec.displayName + ':'),
    );
  }

  for (const pick of rec.cherryPicks) {
    const from = PACKS[pick.packId].displayName;
    const tok = pc.dim(
      ` ~${pick.alwaysTokens}+${pick.bodyTokens} tok · ${pick.phase} · ${pick.processIntensity}`,
    );
    if (pick.ok) {
      console.log(
        pc.green(`  ✓ ${pick.skillName}`) +
          pc.dim(` (from ${from}) — ${pick.detail}`) +
          tok,
      );
    } else {
      console.log(
        pc.red(`  ✗ ${pick.skillName}`) +
          pc.dim(` (from ${from}) — ${pick.detail}`),
      );
    }
  }
  console.log();
  console.log(pc.bold('Install snippets'));
  if (rec.installPrimary) {
    console.log(pc.dim('# Primary — Claude Code'));
    console.log(rec.installPrimary.claudeCode);
    console.log(pc.dim('# Primary — Cursor / Codex / other'));
    console.log(rec.installPrimary.other);
  } else {
    console.log(
      pc.dim(
        '# No primary router — use skillpack curate to install a minimal set',
      ),
    );
    console.log('skillpack curate');
  }
  for (const pick of rec.cherryPicks.filter((p) => p.ok).slice(0, 3)) {
    console.log(pc.dim(`# Cherry-pick ${pick.skillName}`));
    console.log(pick.install.claudeCode);
  }
  console.log();
  console.log(pc.dim(rec.provenance));
}

export async function runInteractiveQuiz(): Promise<Answers> {
  p.intro(pc.bgCyan(pc.black(' skillpack pick ')));
  const answers: Answers = {};
  const total = QUESTIONS.length;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]!;
    const value = await p.select({
      message: `Question ${i + 1} of ${total} — ${q.prompt}`,
      options: q.options.map((o) => ({
        value: o.id,
        label: o.label,
      })),
    });
    if (p.isCancel(value)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    answers[q.id as QuestionId] = value as string;
  }
  return answers;
}

export async function runPick(options: {
  yes?: boolean;
  answersPath?: string;
  json?: boolean;
}): Promise<void> {
  const { inventory, provenance } = await loadInventory();

  let answers: Answers;
  if (options.answersPath) {
    const { readFile } = await import('node:fs/promises');
    const raw = JSON.parse(await readFile(options.answersPath, 'utf8')) as Answers;
    answers = raw;
  } else if (options.yes) {
    throw new Error('--yes requires --answers <file.json>');
  } else {
    answers = await runInteractiveQuiz();
  }

  const rec = buildRecommendation(answers, inventory, provenance);

  if (options.json) {
    console.log(JSON.stringify(rec, null, 2));
  } else {
    if (!options.answersPath) {
      p.outro('Recommendation ready');
    }
    printRecommendation(rec);
  }
}
