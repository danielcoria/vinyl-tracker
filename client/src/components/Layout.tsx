// ============================================================================
// Layout.tsx: THE FRAME AROUND EVERY SCREEN
//
// The header (app name, navigation, and who's logged in) and footer (is the
// server reachable?) stay the same on every page. <Outlet /> is where the
// current page appears. The navigation and the stylus warning only show when
// someone is logged in. On the public demo, a note under the header says so.
// ============================================================================

import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useMe } from '../api/auth';
import { useHealth } from '../api/health';
import { StylusBanner } from '../features/stylus/StylusBanner';

export function Layout() {
  const health = useHealth();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const user = me.data?.user ?? null;
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
        {user && (
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
        )}
        {user && (
          <div className="account">
            <span className="account-name" title={`@${user.username}`}>
              {user.displayName}
            </span>
            <button
              type="button"
              className="button button-small"
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {health.data?.demo && (
        <div className="demo-notice" role="note">
          <strong>Demo:</strong> click around and try anything. It’s sample data, and any changes
          reset when the site restarts.
        </div>
      )}

      {/* Appears only when the stylus is getting worn. */}
      {user && <StylusBanner />}

      <main className="page">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>A diary for your record collection.</span>
        {/* Discogs' terms ask apps that use their data to credit them. */}
        <span>
          Record data and covers from{' '}
          <a href="https://www.discogs.com" target="_blank" rel="noreferrer">
            Discogs
          </a>
        </span>
        <span role="status">Server: {status}</span>
      </footer>
    </div>
  );
}
