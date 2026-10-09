// ============================================================================
// Layout.tsx: THE FRAME AROUND EVERY SCREEN
//
// The header (app name + navigation) and footer (is the server reachable?)
// stay the same on every page. <Outlet /> is where the current page appears.
// ============================================================================

import { Link, NavLink, Outlet } from 'react-router';
import { useHealth } from '../api/health';
import { StylusBanner } from '../features/stylus/StylusBanner';

export function Layout() {
  const health = useHealth();
  const status = health.isPending
    ? 'checking…'
    : health.isError
      ? 'unreachable'
      : health.data.status;

  return (
    <div className="layout">
      <header className="site-header">
        {/* <Link> changes the page without reloading the whole website. */}
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Vinyl Tracker
        </Link>
        <nav aria-label="Main">
          {/* NavLink is a Link that knows when its page is the current one (for styling). */}
          <NavLink to="/" end>
            Collection
          </NavLink>
          <NavLink to="/diary">Diary</NavLink>
          <NavLink to="/stats">Stats</NavLink>
          <NavLink to="/dust">Dust</NavLink>
          <NavLink to="/stylus">Stylus</NavLink>
          <NavLink to="/discogs">Add from Discogs</NavLink>
        </nav>
      </header>

      {/* Appears only when the stylus is getting worn. */}
      <StylusBanner />

      <main className="page">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>A listening log for records that streaming apps can't see.</span>
        <span role="status">Server: {status}</span>
      </footer>
    </div>
  );
}
