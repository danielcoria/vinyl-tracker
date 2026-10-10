// ============================================================================
// guards.tsx: WHO MAY SEE WHICH PAGES
//
//   <RequireLogin>  pages for logged-in people. Anyone else is sent to /login,
//                   remembering where they were going (?next=/stats), so they
//                   land there after logging in.
//   <GuestOnly>     the login and sign-up pages. Someone already logged in is
//                   sent on to where they were going (or the collection).
// ============================================================================

import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useMe } from '../../api/auth';
import { safeNext } from './next';

export function RequireLogin() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <p className="muted">Loading…</p>;
  if (!me.data?.user) {
    const next = location.pathname + location.search;
    const to = next === '/' ? '/login' : `/login?${new URLSearchParams({ next })}`;
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  const me = useMe();
  const [searchParams] = useSearchParams();

  if (me.isPending) return <p className="muted">Loading…</p>;
  if (me.data?.user) return <Navigate to={safeNext(searchParams.get('next'))} replace />;
  return <Outlet />;
}
