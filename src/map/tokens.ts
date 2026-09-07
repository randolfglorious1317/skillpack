import pc from 'picocolors';

import { PACKS, PACK_IDS, type PackId } from '../config/packs.js';
import type { SkillEntry, SkillPackInventory } from '../shared/inventory.js';
import { loadInventory } from '../shared/loader.js';

export interface PackTokenSummary {
  packId: PackId;
  displayName: string;
  skillCount: number;
  contextTax: number;
  bodyTotal: number;
  heaviest: Array<{
    name: string;
    alwaysTokens: number;
    bodyTokens: number;
    phase: string;
    processIntensity: string;
  }>;
}

export interface TokensReport {
  generatedAt: string;
  source: SkillPackInventory['source'];
  packs: PackTokenSummary[];
  topSkills: Array<{
    packId: PackId;
    name: string;
    alwaysTokens: number;
    bodyTokens: number;
    total: number;
    phase: string;
    processIntensity: string;
  }>;
  comparison: string[];
}

function packSummary(packId: PackId, inventory: SkillPackInventory): PackTokenSummary {
  const snap = inventory.packs[packId];
  const contextTax = snap.skills.reduce((n, s) => n + s.alwaysTokens, 0);
  const bodyTotal = snap.skills.reduce((n, s) => n + s.bodyTokens, 0);
  const heaviest = [...snap.skills]
    .sort(
      (a, b) =>
        b.alwaysTokens + b.bodyTokens - (a.alwaysTokens + a.bodyTokens),
    )
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      alwaysTokens: s.alwaysTokens,
      bodyTokens: s.bodyTokens,
      phase: s.phase,
      processIntensity: s.processIntensity,
    }));

  return {
    packId,
    displayName: PACKS[packId].displayName,
    skillCount: snap.skills.length,
    contextTax,
    bodyTotal,
    heaviest,
  };
}

export function buildTokensReport(
  inventory: SkillPackInventory,
): TokensReport {
  const packs = PACK_IDS.map((id) => packSummary(id, inventory));

  const all: TokensReport['topSkills'] = [];
  for (const packId of PACK_IDS) {
    for (const s of inventory.packs[packId].skills) {
      all.push({
        packId,
        name: s.name,
        alwaysTokens: s.alwaysTokens,
        bodyTokens: s.bodyTokens,
        total: s.alwaysTokens + s.bodyTokens,
        phase: s.phase,
        processIntensity: s.processIntensity,
      });
    }
  }
  all.sort((a, b) => b.total - a.total);

  const comparison = packs.map(
    (p) =>
      `Installing all of ${p.displayName} costs ~${p.contextTax} tokens per session before you type anything (${p.skillCount} skills; ~${p.bodyTotal} more if every skill body is loaded).`,
  );

  return {
    generatedAt: inventory.generatedAt,
    source: inventory.source,
    packs,
    topSkills: all.slice(0, 10),
    comparison,
  };
}

export function formatTokensTerminal(
  report: TokensReport,
  provenance: string,
): void {
  console.log(pc.dim(provenance));
  console.log(
    pc.dim(`snapshot ${report.generatedAt} · source=${report.source}`),
  );
  console.log();
  console.log(pc.bold('Context tax by pack (always-loaded name+description)'));
  console.log(pc.dim('─'.repeat(56)));
  for (const p of report.packs) {
    console.log(
      `  ${pc.cyan(p.displayName.padEnd(22))} ${String(p.contextTax).padStart(6)} tok  (${p.skillCount} skills · body Σ ${p.bodyTotal})`,
    );
  }
  console.log();
  console.log(pc.bold('Top 10 heaviest skills (always + body)'));
  console.log(pc.dim('─'.repeat(56)));
  for (const s of report.topSkills) {
    console.log(
      `  ${String(s.total).padStart(6)}  ${s.name} ${pc.dim(`(${PACKS[s.packId].displayName} · ${s.phase} · ${s.processIntensity})`)}`,
    );
  }
  console.log();
  for (const line of report.comparison) {
    console.log(pc.dim(`• ${line}`));
  }
  console.log();
  console.log(
    pc.dim(
      'Estimates use chars÷4 (no tokenizer). Process-intensity flags grilling/spec loops that burn more than tokens.',
    ),
  );
}

export async function runMapTokens(options: {
  json?: boolean;
}): Promise<void> {
  const { inventory, provenance } = await loadInventory();
  const report = buildTokensReport(inventory);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    formatTokensTerminal(report, provenance);
  }
}

/** Sum always-loaded tokens for a skill subset. */
export function contextTaxFor(skills: SkillEntry[]): number {
  return skills.reduce((n, s) => n + s.alwaysTokens, 0);
}
