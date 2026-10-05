import { useHealth } from './api/health';

export function App() {
  const health = useHealth();

  return (
    <main className="app">
      <h1>Vinyl Tracker</h1>
      <p className="tagline">A listening log for records that streaming apps can't see.</p>
      <p role="status">
        API: {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status}
      </p>
    </main>
  );
}
