/**
 * Output Agents - Phase 4 of AEO Pipeline
 *
 * These agents generate the final outputs:
 * recommendations, Cursor prompts, and reports.
 */

export { generateAEORecommendations, generateQuickRecommendations } from './recommendation';
export { generateCursorPrompt, generateQuickCursorPrompt, formatCursorPromptForCopy } from './cursor-prompt';
export { generateAEOReport, generateMarkdownReport } from './report-generator';

