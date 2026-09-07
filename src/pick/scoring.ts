import type { PackId } from '../config/packs.js';
import {
  QUESTIONS,
  QUESTIONS_BY_ID,
  TIE_BREAK_ORDER,
  type OutcomeId,
  type QuestionId,
} from './scoring-rules.js';

export type Answers = Partial<Record<QuestionId, string>>;

export interface ScoreBreakdown {
  scores: Record<OutcomeId, number>;
  winner: OutcomeId;
  tied: OutcomeId[];
  rationaleDrivers: Array<{
    questionId: QuestionId;
    optionId: string;
    optionLabel: string;
    contributed: OutcomeId[];
  }>;
}

function emptyScores(): Record<OutcomeId, number> {
  return {
    superpowers: 0,
    agentSkills: 0,
    mattPocock: 0,
    pstack: 0,
    none: 0,
  };
}

export function scoreAnswers(answers: Answers): ScoreBreakdown {
  const scores = emptyScores();
  const rationaleDrivers: ScoreBreakdown['rationaleDrivers'] = [];

  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!optionId) continue;
    const option = question.options.find((o) => o.id === optionId);
    if (!option) {
      throw new Error(
        `Unknown option "${optionId}" for question "${question.id}"`,
      );
    }
    const contributed: OutcomeId[] = [];
    for (const [outcomeId, pts] of Object.entries(option.scores) as Array<
      [OutcomeId, number]
    >) {
      scores[outcomeId] += pts;
      contributed.push(outcomeId);
    }
    rationaleDrivers.push({
      questionId: question.id,
      optionId: option.id,
      optionLabel: option.label,
      contributed,
    });
  }

  const max = Math.max(...Object.values(scores));
  const tied = (Object.keys(scores) as OutcomeId[]).filter(
    (id) => scores[id] === max,
  );

  let winner: OutcomeId;
  if (tied.length === 1) {
    winner = tied[0]!;
  } else if (tied.includes('none') && tied.length === 1) {
    winner = 'none';
  } else {
    // Prefer real packs over none on ties; then TIE_BREAK_ORDER
    const packTied = tied.filter((t): t is PackId => t !== 'none');
    if (packTied.length === 0) {
      winner = 'none';
    } else {
      winner =
        TIE_BREAK_ORDER.find((id) => packTied.includes(id)) ?? packTied[0]!;
    }
  }

  return { scores, winner, tied, rationaleDrivers };
}

export function validateAnswers(answers: Answers): void {
  for (const q of QUESTIONS) {
    const opt = answers[q.id];
    if (!opt) {
      throw new Error(`Missing answer for question "${q.id}"`);
    }
    if (!QUESTIONS_BY_ID[q.id].options.some((o) => o.id === opt)) {
      throw new Error(`Invalid option "${opt}" for question "${q.id}"`);
    }
  }
}
