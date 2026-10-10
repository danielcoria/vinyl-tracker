// ============================================================================
// AuthPages.test.tsx: TESTS FOR LOGGING IN, SIGNING UP AND LOGGING OUT
// ============================================================================

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from '@vinyl/shared';
import { safeNext } from '../features/auth/next';
import { apiError, json, mockApi, TEST_USER } from '../test/fake-api';
import { renderApp } from '../test/render';

const DANIEL: User = { ...TEST_USER, username: 'daniel', displayName: 'Daniel' };
const location = () => screen.getByTestId('location').textContent;

describe('when nobody is logged in', () => {
  it('pages send you to log in, remembering where you were going', async () => {
    mockApi({});

    renderApp('/stats?period=all', { loggedInAs: null });

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(location()).toBe('/login?next=%2Fstats%3Fperiod%3Dall');
    // No navigation or stylus warning for people who aren't logged in.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('logging in takes you where you were going', async () => {
    const api = mockApi({
      'POST /api/auth/login': () => json({ user: DANIEL }),
      'GET /api/stats': () => json({}),
    });
    const { user } = renderApp('/login?next=%2Fdiary', { loggedInAs: null });

    await user.type(screen.getByLabelText('Username'), 'Daniel');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(location()).toBe('/diary'));
    expect(api.calls.find((c) => c.path === '/api/auth/login')?.body).toEqual({
      username: 'daniel',
      password: 'correct horse',
    });
    expect(screen.getByText('Daniel')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('explains a wrong password', async () => {
    mockApi({
      'POST /api/auth/login': () => apiError(401, 'INVALID_LOGIN', 'Wrong username or password.'),
    });
    const { user } = renderApp('/login', { loggedInAs: null });

    await user.type(screen.getByLabelText('Username'), 'daniel');
    await user.type(screen.getByLabelText('Password'), 'nope nope');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.');
    expect(location()).toBe('/login');
  });

  it('asks for a username before sending anything', async () => {
    const api = mockApi({});
    const { user } = renderApp('/login', { loggedInAs: null });

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('signing up', () => {
  it('creates the account and opens your collection', async () => {
    const api = mockApi({
      'POST /api/auth/signup': () => json({ user: DANIEL }, 201),
      'GET /api/records': () => json({ records: [] }),
    });
    const { user } = renderApp('/signup', { loggedInAs: null });

    await user.type(screen.getByLabelText('Username'), 'Daniel');
    await user.type(screen.getByLabelText('Display name (optional)'), 'Daniel');
    await user.type(screen.getByLabelText('Password'), 'long enough');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(location()).toBe('/'));
    expect(api.calls.find((c) => c.path === '/api/auth/signup')?.body).toEqual({
      username: 'daniel',
      displayName: 'Daniel',
      password: 'long enough',
    });
  });

  it('shows problems next to the fields', async () => {
    const api = mockApi({});
    const { user } = renderApp('/signup', { loggedInAs: null });

    await user.type(screen.getByLabelText('Username'), 'no spaces!');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use only letters, numbers and _')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('says when a username is taken', async () => {
    mockApi({
      'POST /api/auth/signup': () =>
        apiError(409, 'USERNAME_TAKEN', 'That username is taken. Try another one.'),
    });
    const { user } = renderApp('/signup', { loggedInAs: null });

    await user.type(screen.getByLabelText('Username'), 'daniel');
    await user.type(screen.getByLabelText('Password'), 'long enough');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken.');
  });
});

describe('the demo', () => {
  it('offers "Try the demo" on the demo site', async () => {
    const api = mockApi({
      'GET /api/health': () => json({ status: 'ok', uptimeSeconds: 1, demo: true }),
      'POST /api/auth/demo': () => json({ user: { ...TEST_USER, username: 'demo' } }),
      'GET /api/records': () => json({ records: [] }),
    });
    const { user } = renderApp('/login', { loggedInAs: null });

    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));

    await waitFor(() => expect(location()).toBe('/'));
    expect(api.calls.some((c) => c.path === '/api/auth/demo')).toBe(true);
  });

  it('is not offered elsewhere', async () => {
    mockApi({});

    renderApp('/login', { loggedInAs: null });
    await screen.findByText('Server: ok');

    expect(screen.queryByRole('button', { name: 'Try the demo' })).not.toBeInTheDocument();
  });
});

describe('when logged in', () => {
  it('shows your name, and "Log out" takes you to the login page', async () => {
    const api = mockApi({
      'GET /api/records': () => json({ records: [] }),
      'POST /api/auth/logout': () => new Response(null, { status: 204 }),
    });
    const { user } = renderApp('/', { loggedInAs: DANIEL });

    expect(screen.getByText('Daniel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === '/api/auth/logout')).toBe(true);
    expect(screen.queryByText('Daniel')).not.toBeInTheDocument();
  });

  it('the login page sends you on to your collection', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/login');

    await waitFor(() => expect(location()).toBe('/'));
  });

  it('an expired login sends you back to the login page', async () => {
    mockApi({
      'GET /api/records': () => apiError(401, 'NOT_LOGGED_IN', 'Log in to continue.'),
    });

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('safeNext', () => {
  it('only allows pages on this site', () => {
    expect(safeNext('/stats?period=all')).toBe('/stats?period=all');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
  });
});
