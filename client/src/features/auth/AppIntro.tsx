// ============================================================================
// AppIntro.tsx: WHAT THIS APP IS, FOR SOMEONE SEEING IT FOR THE FIRST TIME
//
// Shown beside the login form. A visitor (say, from a resume link) should know
// in a few seconds what Vinyl Tracker does before deciding to try the demo.
// ============================================================================

const FEATURES: [string, string][] = [
  [
    'Your collection',
    'Add records by hand or import them from Discogs, covers and tracklists included.',
  ],
  ['A listening diary', 'Log what you play, one side at a time, then rate and review it.'],
  ['Things only vinyl needs', 'Records gathering dust, stylus wear, and what to play tonight.'],
  ['Streaming vs. shelf', 'Albums you stream a lot but don’t own yet, with today’s vinyl prices.'],
  ['Stats and value', 'Most-played artists, a year in records, and what the collection is worth.'],
];

export function AppIntro() {
  return (
    <aside className="app-intro" aria-label="About Vinyl Tracker">
      <p className="app-intro-tagline">A diary for your record collection.</p>
      <p>
        Streaming services remember everything you play. Nothing remembers what goes on the
        turntable. Vinyl Tracker does.
      </p>
      <ul>
        {FEATURES.map(([name, description]) => (
          <li key={name}>
            <strong>{name}.</strong> {description}
          </li>
        ))}
      </ul>
    </aside>
  );
}
