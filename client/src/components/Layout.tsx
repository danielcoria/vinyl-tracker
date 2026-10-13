// ============================================================================
// Layout.tsx: THE FRAME AROUND EVERY SCREEN
//
// The header (app name, who's logged in, and the menu) and footer (is the
// server reachable?) stay the same on every page. <Outlet /> is where the
// current page appears. The menu and the stylus warning only show when
// someone is logged in. On the public demo, a note under the header says so.
//
// The menu is in three groups (your records, numbers about them, finding more)
// so eleven links stay easy to scan. On a phone it's tucked behind a "Menu"
// button. The browser tab's title follows the page ("Diary · Vinyl Tracker").
// ============================================================================

import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useLogout, useMe } from '../api/auth';
import { useHealth } from '../api/health';
import { StylusBanner } from '../features/stylus/StylusBanner';
import { titleFor } from './page-title';

/** The menu's groups. `end` = only "current" on exactly that address (for "/"). */
const NAV_GROUPS: { label: string; links: { to: string; text: string; end?: boolean }[] }[] = [
  {
    label: 'Your records',
    links: [
      { to: '/', text: 'Collection', end: true },
      { to: '/tonight', text: 'Tonight' },
      { to: '/diary', text: 'Diary' },
    ],
  },
  {
    label: 'Insights',
    links: [
      { to: '/stats', text: 'Stats' },
      { to: '/value', text: 'Value' },
      { to: '/dust', text: 'Dust' },
      { to: '/stylus', text: 'Stylus' },
    ],
  },
  {
    label: 'Find more',
    links: [
      { to: '/streaming', text: 'Streaming' },
      { to: '/discover', text: 'Discover' },
      { to: '/wishlist', text: 'Wishlist' },
    ],
  },
];

export function Layout() {
  const health = useHealth();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onAuthPage = pathname === '/login' || pathname === '/signup';
  const user = me.data?.user ?? null;
  const status = health.isPending
    ? 'checking…'
    : health.isError
      ? 'unreachable'
      : health.data.status;

  // The phone menu remembers which page it was opened on, so going to another
  // page closes it without any extra code.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;

  // useEffect runs after the page is drawn; here it keeps the browser tab's title in step.
  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);

  return (
    <div className="layout">
      {/* For keyboard users: jump past the menu, straight to the page. Hidden until focused. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-top">
          {/* <Link> changes the page without reloading the whole website. */}
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Vinyl Tracker
          </Link>
          {user && (
            <div className="account">
              {/* Only shown on phones (see .menu-toggle in index.css). */}
              <button
                type="button"
                className="button button-small menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="main-menu"
                onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
              >
                Menu
              </button>
              {/* The name links to your public profile (only you can see it until you share it). */}
              <Link
                to={`/u/${user.username}`}
                className="account-name"
                title={`Your profile (@${user.username})`}
              >
                {user.displayName}
              </Link>
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
          {/* Visitors looking at a public profile get a way in. */}
          {me.isSuccess && !user && !onAuthPage && (
            <div className="account">
              <Link to="/login" className="button button-small">
                Log in
              </Link>
            </div>
          )}
        </div>

        {user && (
          <nav
            id="main-menu"
            aria-label="Main"
            className={menuOpen ? 'main-menu is-open' : 'main-menu'}
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="menu-group" role="group" aria-label={group.label}>
                {group.links.map((link) => (
                  // NavLink is a Link that knows when its page is the current one (for styling).
                  <NavLink key={link.to} to={link.to} end={link.end}>
                    {link.text}
                  </NavLink>
                ))}
              </div>
            ))}
            <NavLink to="/discogs" className="menu-add">
              Add from Discogs
            </NavLink>
          </nav>
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

      {/* tabIndex -1: lets the "Skip to content" link move the keyboard here. */}
      <main id="main" className="page" tabIndex={-1}>
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
