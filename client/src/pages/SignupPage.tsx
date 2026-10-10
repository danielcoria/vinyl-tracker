// ============================================================================
// SignupPage.tsx: CREATING AN ACCOUNT (/signup)
//
// A username (letters, numbers and _; it will be part of your profile's
// address later), an optional display name, and a password of 8+ characters.
// Checked with the same rules the server uses before anything is sent.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PASSWORD_MIN_LENGTH, signupInputSchema } from '@vinyl/shared';
import { useSignup } from '../api/auth';
import { describeError } from '../api/client';
import { safeNext } from '../features/auth/next';

type Field = 'username' | 'displayName' | 'password';

export function SignupPage() {
  const id = useId();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const navigate = useNavigate();
  const signup = useSignup();
  const [values, setValues] = useState({ username: '', displayName: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = signupInputSchema.safeParse(values);
    if (!parsed.success) {
      const found: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        found[field] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    signup.mutate(parsed.data, { onSuccess: () => navigate(next, { replace: true }) });
  }

  const fieldProps = (field: Field) => ({
    id: `${id}-${field}`,
    value: values[field],
    onChange: (event: { target: { value: string } }) => set(field, event.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
  });

  const fieldError = (field: Field) =>
    errors[field] && (
      <span className="field-error" id={`${id}-${field}-error`}>
        {errors[field]}
      </span>
    );

  return (
    <section className="auth-page">
      <h1>Create an account</h1>
      <p className="muted">Your own collection, listening diary and stats.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-username`}>Username</label>
          <input {...fieldProps('username')} autoComplete="username" autoCapitalize="none" />
          <span className="hint">Letters, numbers and _ only.</span>
          {fieldError('username')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-displayName`}>Display name (optional)</label>
          <input {...fieldProps('displayName')} autoComplete="nickname" />
          {fieldError('displayName')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>Password</label>
          <input {...fieldProps('password')} type="password" autoComplete="new-password" />
          <span className="hint">At least {PASSWORD_MIN_LENGTH} characters.</span>
          {fieldError('password')}
        </div>

        {signup.error && (
          <div className="error-box" role="alert">
            <p>{describeError(signup.error)}</p>
          </div>
        )}

        <button type="submit" className="button button-primary" disabled={signup.isPending}>
          {signup.isPending ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="muted">
        Already have an account?{' '}
        <Link to={`/login${searchParams.size > 0 ? `?${searchParams}` : ''}`}>Log in</Link>
      </p>
    </section>
  );
}
