// ============================================================================
// LoginPage.tsx: LOGGING IN (/login)
//
// Username and password. On the demo site, "Try the demo" logs in to the
// shared demo account with one click. After logging in you go to the page you
// were trying to open (?next=...), or your collection.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loginInputSchema } from '@vinyl/shared';
import { useDemoLogin, useLogin } from '../api/auth';
import { describeError } from '../api/client';
import { useHealth } from '../api/health';
import { safeNext } from '../features/auth/next';

export function LoginPage() {
  const id = useId();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const navigate = useNavigate();
  const login = useLogin();
  const demoLogin = useDemoLogin();
  const health = useHealth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = loginInputSchema.safeParse({ username, password });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    setProblem(null);
    login.mutate(parsed.data, { onSuccess: () => navigate(next, { replace: true }) });
  }

  const error = problem ?? (login.error ? describeError(login.error) : null);

  return (
    <section className="auth-page">
      <h1>Log in</h1>

      {health.data?.demo && (
        <div className="auth-demo">
          <p>Just looking around? Use the demo collection, no account needed.</p>
          <button
            type="button"
            className="button button-primary"
            disabled={demoLogin.isPending}
            onClick={() =>
              demoLogin.mutate(undefined, { onSuccess: () => navigate(next, { replace: true }) })
            }
          >
            {demoLogin.isPending ? 'Opening the demo…' : 'Try the demo'}
          </button>
          {demoLogin.error && (
            <p className="field-error" role="alert">
              {describeError(demoLogin.error)}
            </p>
          )}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-username`}>Username</label>
          <input
            id={`${id}-username`}
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Password</label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        <button type="submit" className="button button-primary" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="muted">
        New here?{' '}
        <Link to={`/signup${searchParams.size > 0 ? `?${searchParams}` : ''}`}>
          Create an account
        </Link>
      </p>
    </section>
  );
}
