// ============================================================================
// App.tsx: THE MAIN SCREEN (a React "component")
//
// Right now this screen only shows the title and whether the server is
// reachable. In M3 it becomes the record collection.
// ============================================================================

import { useHealth } from './api/health';

export function App() {
  // Ask the server "are you OK?". `health` tells us the state of that request:
  //   health.isPending -> still waiting for an answer
  //   health.isError   -> the request failed (server down, etc.)
  //   health.data      -> the answer, once it arrives
  // When the answer arrives, React automatically redraws this component.
  const health = useHealth();

  return (
    // `className` is JSX's name for HTML's `class` (used for styling in index.css).
    <main className="app">
      <h1>Vinyl Tracker</h1>
      <p className="tagline">A listening log for records that streaming apps can't see.</p>
      <p role="status">
        {/* Show a different word depending on how the request is going. */}
        API: {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status}
      </p>
    </main>
  );
}
