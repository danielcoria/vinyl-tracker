// ============================================================================
// format.ts (ratings): WORDS FOR STAR RATINGS
// ============================================================================

/** "1 star", "4.5 stars": used for screen readers and tooltips. */
export function starsLabel(rating: number): string {
  return `${rating} ${rating === 1 ? 'star' : 'stars'}`;
}
