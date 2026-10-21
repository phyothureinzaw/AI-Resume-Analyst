import type { AnalysisResult } from './analysis.types.js';

export const SCORING_VERSION = 'coverage-v1';
export function scoreAnalysis(result: AnalysisResult): number {
  const ids = new Set<string>();
  let earned = 0;
  let possible = 0;
  for (const requirement of result.requirements) {
    if (ids.has(requirement.id)) throw new Error('Duplicate requirement identifier');
    ids.add(requirement.id);
    const weight = requirement.category === 'required' ? 2 : 1;
    const multiplier = requirement.evidenceStatus === 'supported' ? 1 : requirement.evidenceStatus === 'partial' ? 0.5 : 0;
    possible += weight;
    earned += weight * multiplier;
  }
  if (possible === 0) throw new Error('No valid requirements');
  return Math.round((100 * earned / possible) * 100) / 100;
}
