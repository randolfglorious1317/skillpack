/** Rough LLM token estimate: chars/4 (no tokenizer dependency). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Always-loaded context: name + description (injected into skill catalogs). */
export function alwaysLoadedTokens(name: string, description: string): number {
  return estimateTokens(`${name}\n${description}`);
}

/** On-demand body tokens from SKILL.md content after frontmatter. */
export function bodyLoadedTokens(body: string): number {
  return estimateTokens(body.trim());
}
