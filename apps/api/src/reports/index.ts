/**
 * Reports Module
 *
 * Provides diff generation, reproducibility scoring,
 * and historical tracking functionality.
 */

export {
  generateDiffReport,
  generateDiffMarkdown,
  type ContentDiff,
  type FieldChange,
  type DiffReport,
  type HighlightedChange,
} from './diff-generator';

export {
  calculateReproducibilityScore,
  createHistoricalSnapshot,
  compareSnapshots,
  type ReproducibilityScore,
  type HistoricalData,
} from './reproducibility';

