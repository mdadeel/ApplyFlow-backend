/**
 * Shared validation constants — Phase 6.5
 *
 * Single source of truth for banned words, action verbs, AI transitions,
 * and other reusable lists used across validators.
 *
 * Import from this file instead of duplicating lists in each validator.
 */

// ─── Banned AI vocabulary ─────────────────────────────────────────────
// Words/phrases that indicate AI-generated content or cliché resume writing.
export const BANNED_WORDS = [
  'passionate', 'cutting-edge', 'cutting edge', 'dynamic', 'leveraged',
  'utilized', 'innovative', 'game-changing', 'game changing', 'world-class',
  'world class', 'robust', 'spearheaded', 'orchestrated',
  'synergy', 'synergize', 'best-in-class', 'best in class',
  'state-of-the-art', 'state of the art', 'bleeding-edge', 'bleeding edge',
  'next-level', 'next level', 'mission-critical', 'mission critical',
  'results-driven', 'results driven', 'proven track record',
  'highly-skilled', 'highly skilled',
] as const

// ─── Recruiter clichés ───────────────────────────────────────────────
// Overused phrases that reduce credibility with human recruiters.
export const RECRUITER_CLICHES = [
  'results-driven', 'proven track record', 'highly motivated',
  'team player', 'go-getter',
] as const

// ─── AI transition phrases ───────────────────────────────────────────
// Common LLM transition patterns that make text sound generated.
export const AI_TRANSITIONS = [
  'additionally,', 'furthermore,', 'moreover,', 'in addition,',
  'in conclusion,', 'to summarize,', 'as a result,',
  'it is worth noting', 'it is important to note',
  'needless to say', 'it goes without saying',
  'it should be noted', 'it is noteworthy',
  'of note,', 'importantly,',
] as const

// ─── AI cover-letter / email phrases ────────────────────────────────
// Formulaic openings that signal an auto-generated application.
export const AI_COVER_LETTER_PHRASES = [
  /I am writing to (express|apply)\b/i,
  /I am excited to (apply|submit|present)\b/i,
  /This role (aligns with|matches) my (skills|experience|background)\b/i,
  /I am confident that my (skills|experience|background)\b/i,
  /As a highly (skilled|motivated|experienced)\b/i,
  /I possess a (strong|deep|thorough) (understanding|knowledge)\b/i,
  /With my (extensive|strong|proven) background\b/i,
] as const

// ─── Weak / vague language patterns ─────────────────────────────────
export const WEAK_LANGUAGE_PATTERNS = [
  /^responsible for/i,
  /^involved in/i,
  /^helped with/i,
  /\b(?:simple|basic|easy)\s+(?:app|application|system|platform|solution)\b/i,
  /\bjust\s+(?:a|an)\s+(?:simple|basic)\b/i,
  /\b(?:nothing|not)\s+(?:complex|complicated|fancy)\b/i,
] as const

// ─── Strong action verbs ─────────────────────────────────────────────
// Used to score bullet quality and suggest improvements.
export const ACTION_VERBS = [
  'built', 'developed', 'designed', 'created', 'implemented', 'architected',
  'led', 'managed', 'directed', 'coordinated', 'delivered', 'shipped',
  'improved', 'optimized', 'increased', 'reduced', 'decreased', 'cut',
  'automated', 'migrated', 'transformed', 'modernized', 'refactored',
  'launched', 'deployed', 'integrated', 'configured', 'established',
  'mentored', 'trained', 'coached', 'guided', 'advised',
  'negotiated', 'presented', 'communicated', 'collaborated',
  'analyzed', 'researched', 'evaluated', 'investigated',
  'wrote', 'authored', 'documented', 'standardized',
  'troubleshot', 'resolved', 'debugged', 'tested', 'validated',
] as const

// ─── Metric regex patterns ───────────────────────────────────────────
// Used to find quantifiable claims in generated content.
export const METRIC_PATTERNS = [
  /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%/g,
  /\b(?:reduced|increased|improved|decreased|cut|lowered|boosted|accelerated)\s+\w+\s+by\s+\d+(?:\.\d+)?%/gi,
  /\b(?:reduced|increased|improved|decreased|cut|lowered|boosted|accelerated)\s+\w+\s+by\s+\d+(?:\.\d+)?[xX]/gi,
  /\b\d+(?:\.\d+)?\s*(?:ms|seconds?|minutes?|hours?|days?)\b/gi,
  /\b(?:over|more than|less than|approximately|about)\s+\d+(?:,\d{3})*(?:\.\d+)?/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:users?|customers?|clients?|students?|members?|employees?|developers?|engineers?)\b/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:repos?|repositories?|commits?|PRs?|issues?|tests?|bugs?|features?)\b/gi,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:requests?|queries?|transactions?|payments?|orders?)\b/gi,
] as const

// ─── Language replacement map (for humanization cleanup) ────────────
export const LANGUAGE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(results-driven)\b/gi, replacement: 'focused on outcomes' },
  { pattern: /\b(passionate)\b/gi, replacement: '' },
  { pattern: /\b(thrilled)\b/gi, replacement: '' },
  { pattern: /\b(excited)\b/gi, replacement: '' },
  { pattern: /\b(seasoned)\b/gi, replacement: 'experienced' },
  { pattern: /\b(dynamic)\b/gi, replacement: '' },
  { pattern: /\b(highly motivated)\b/gi, replacement: '' },
  { pattern: /\b(proven track record)\b/gi, replacement: 'track record' },
  { pattern: /\b(fast-paced)\b/gi, replacement: 'dynamic' },
  { pattern: /\b(cutting-edge|cuttings? edge)\b/gi, replacement: 'modern' },
  { pattern: /\b(state-of-the-art)\b/gi, replacement: 'modern' },
  { pattern: /\b(leveraged?)\b/gi, replacement: 'used' },
  { pattern: /\b(utilized?)\b/gi, replacement: 'used' },
  { pattern: /\b(innovative)\b/gi, replacement: '' },
  { pattern: /\b(synergy|synergize)\b/gi, replacement: 'collaboration' },
  { pattern: /\b(deep dive|deep-dive)\b/gi, replacement: 'thorough analysis' },
  { pattern: /\b(drill down|drill-down)\b/gi, replacement: 'detailed review' },
  { pattern: /\b(think outside the box)\b/gi, replacement: 'approach creatively' },
  { pattern: /\b(game[- ]?changer?)\b/gi, replacement: 'significant impact' },
  { pattern: /\b(best[- ]?in[- ]?class)\b/gi, replacement: 'high-quality' },
  { pattern: /\b(thought leader)\b/gi, replacement: 'expert' },
  { pattern: /\b(learnings)\b/gi, replacement: 'lessons' },
  { pattern: /\b(ask)\b(?:\s+for\s+help)?/gi, replacement: 'request' },
] as const
