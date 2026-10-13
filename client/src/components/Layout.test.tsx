// ============================================================================
// Layout.test.tsx: TESTS FOR THE HEADER, THE MENU AND PAGE TITLES
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { json, loggedOut, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';
import { titleFor } from './page-title';

describe('page titles', () => {
  it('name the page, then the app', () => {
    expect(titleFor('/')).toBe('Collection · Vinyl Tracker');
    expect(titleFor('/diary')).toBe('Diary · Vinyl Tracker');
    expect(titleFor('/records/12')).toBe('Record · Vinyl Tracker');
    expect(titleFor('/records/12/edit')).toBe('Edit record · Vinyl Tracker');
    expect(titleFor('/records/new')).toBe('Add a record · Vinyl Tracker');
    expect(titleFor('/u/daniel')).toBe('@daniel · Vinyl Tracker');
    expect(titleFor('/u/daniel/year/2026')).toBe('@daniel: 2026 in records · Vinyl Tracker');
  });

  it('fall back to the app name for addresses that are not pages', () => {
    expect(titleFor('/nowhere')).toBe('Vinyl Tracker');
  });

  it('follow the page as you move around', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });
    const { user } = renderApp('/');
    await waitFor(() => expect(document.title).toBe('Collection · Vinyl Tracker'));

    await user.click(screen.getByRole('link', { name: 'Diary' }));

    await waitFor(() => expect(document.title).toBe('Diary · Vinyl Tracker'));
  });
});

describe('the menu', () => {
  it('groups the links so they are easy to scan', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/');

    const menu = await screen.findByRole('navigation', { name: 'Main' });
    const linksIn = (group: string) =>
      within(within(menu).getByRole('group', { name: group }))
        .getAllByRole('link')
        .map((link) => link.textContent);
    expect(linksIn('Your records')).toEqual(['Collection', 'Tonight', 'Diary']);
    expect(linksIn('Insights')).toEqual(['Stats', 'Value', 'Dust', 'Stylus']);
    expect(linksIn('Find more')).toEqual(['Streaming', 'Discover', 'Wishlist']);
    expect(within(menu).getByRole('link', { name: 'Add from Discogs' })).toHaveAttribute(
      'href',
      '/discogs',
    );
  });

  it('opens with the Menu button (for phones) and closes when a page is chosen', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });
    const { user } = renderApp('/');
    const toggle = await screen.findByRole('button', { name: 'Menu' });
    const menu = screen.getByRole('navigation', { name: 'Main' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu).not.toHaveClass('is-open');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toHaveClass('is-open');

    await user.click(within(menu).getByRole('link', { name: 'Diary' }));

    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
    expect(menu).not.toHaveClass('is-open');
  });

  it('is not shown to visitors who are not logged in', async () => {
    mockApi({ 'GET /api/auth/me': loggedOut });

    renderApp('/login', { loggedInAs: null });

    await screen.findByRole('heading', { name: 'Log in' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('starts with a link to skip straight to the page', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/');

    const skip = await screen.findByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('the login page', () => {
  it('tells first-time visitors what the app is', async () => {
    mockApi({ 'GET /api/auth/me': loggedOut });

    renderApp('/login', { loggedInAs: null });

    const intro = await screen.findByRole('complementary', { name: 'About Vinyl Tracker' });
    expect(intro).toHaveTextContent('A diary for your record collection.');
    expect(within(intro).getAllByRole('listitem')).toHaveLength(5);
    // The page's main heading is still the form's.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in');
  });
});
