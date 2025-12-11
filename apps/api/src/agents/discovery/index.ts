/**
 * Discovery Agents - Phase 1 of AEO Pipeline
 *
 * These agents analyze the target page and generate queries
 * that it should be answering in AI search results.
 */

export { analyzePageContent, analyzePages } from './page-analysis';
export { generateTargetQueries, generateFocusedQueries } from './query-generation';
export { discoverCompetitors, getTopCompetitors, extractDomain } from './competitor-discovery';

