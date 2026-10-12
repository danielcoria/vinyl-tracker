// ============================================================================
// ProfilePage.test.tsx: TESTS FOR PUBLIC PROFILES AND "YEAR IN RECORDS"
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Profile, YearInRecords } from '@vinyl/shared';
import { apiError, json, loggedOut, mockApi, TEST_USER } from '../test/fake-api';
import { renderApp } from '../test/render';
// The year page is loaded lazily (it brings the chart code). Loading it here,
// before the tests run, keeps the first test from waiting on that download.
import './YearInRecordsPage';

const KIND_OF_BLUE = {
  id: 1,
  title: 'Kind of Blue',
  artists: [{ id: 1, name: 'Miles Davis' }],
  coverImageUrl: null,
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user: { username: 'alex', displayName: 'Alex', memberSince: '2025-03-15T12:00:00.000Z' },
    isPublic: true,
    isOwner: false,
    totals: { recordCount: 2, spinCount: 3, listeningSeconds: 7200 },
    topRecords: [{ record: KIND_OF_BLUE, spinCount: 3, listeningSeconds: 7200 }],
    topArtists: [{ id: 1, name: 'Miles Davis', spinCount: 3, listeningSeconds: 7200 }],
    recentPlays: [
      {
        playedAt: '2026-10-06T19:00:00.000Z',
        durationSeconds: 1435,
        sides: ['A'],
        rating: 4.5,
        record: KIND_OF_BLUE,
      },
    ],
    highestRated: [{ record: KIND_OF_BLUE, rating: 5 }],
    reviews: [
      {
        record: KIND_OF_BLUE,
        rating: 5,
        review: 'Perfect late at night.',
        reviewedAt: '2026-09-01T12:00:00.000Z',
      },
    ],
    shelf: [
      { ...KIND_OF_BLUE, year: 1959, spinCount: 3, rating: 5 },
      {
        id: 2,
        title: 'Blue Train',
        artists: [],
        coverImageUrl: null,
        year: 1957,
        spinCount: 0,
        rating: null,
      },
    ],
    years: [2026, 2025],
    ...overrides,
  };
}

const notFound = () =>
  apiError(404, 'PROFILE_NOT_FOUND', 'There is no public profile with that name.');

describe('ProfilePage', () => {
  it('shows a public profile to a visitor who is not logged in', async () => {
    mockApi({ 'GET /api/auth/me': loggedOut, 'GET /api/profiles/alex': () => json(makeProfile()) });

    renderApp('/u/alex', { loggedInAs: null });

    expect(await screen.findByRole('heading', { level: 1, name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByText(/@alex · Collecting since March 2025/)).toBeInTheDocument();
    // Stays on the profile instead of being sent to log in.
    expect(screen.getByTestId('location')).toHaveTextContent('/u/alex');
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();

    const shelf = screen.getByRole('region', { name: 'Shelf' });
    expect(within(shelf).getByText('1959 · 3 plays')).toBeInTheDocument();
    expect(within(shelf).getByText('1957 · Not played yet')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Most-played records' })).toHaveTextContent(
      'Kind of Blue',
    );
    expect(screen.getByRole('region', { name: 'Recent plays' })).toHaveTextContent('Side A');
    // Ratings and reviews are shared too.
    const best = screen.getByRole('region', { name: 'Highest rated' });
    expect(within(best).getByRole('img', { name: '5 stars' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Reviews' })).toHaveTextContent(
      'Perfect late at night.',
    );
    expect(
      within(screen.getByRole('region', { name: 'Recent plays' })).getByRole('img', {
        name: '4.5 stars',
      }),
    ).toBeInTheDocument();
    // No switch for visitors.
    expect(screen.queryByRole('checkbox', { name: 'Public profile' })).not.toBeInTheDocument();
  });

  it('links to each year in records', async () => {
    mockApi({ 'GET /api/profiles/alex': () => json(makeProfile()) });

    renderApp('/u/alex');

    const years = await screen.findByRole('navigation', { name: 'Year in records' });
    expect(within(years).getByRole('link', { name: '2025' })).toHaveAttribute(
      'href',
      '/u/alex/year/2025',
    );
  });

  it('copies the link with the Share button', async () => {
    mockApi({ 'GET /api/profiles/alex': () => json(makeProfile()) });
    const { user } = renderApp('/u/alex');

    await user.click(await screen.findByRole('button', { name: 'Share profile' }));

    expect(await screen.findByText('Link copied!')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/u/alex`);
  });

  it('says "no profile here" for private or missing profiles', async () => {
    mockApi({ 'GET /api/profiles/nobody': notFound });

    renderApp('/u/nobody', { loggedInAs: null });

    expect(await screen.findByRole('heading', { name: 'No profile here' })).toBeInTheDocument();
  });

  it('lets the owner make a private profile public', async () => {
    let isPublic = false;
    const api = mockApi({
      'GET /api/profiles/tester': () =>
        json(
          makeProfile({
            user: {
              username: 'tester',
              displayName: 'Test Listener',
              memberSince: TEST_USER.createdAt,
            },
            isOwner: true,
            isPublic,
          }),
        ),
      'PUT /api/settings': ({ body }) => {
        isPublic = (body as { profilePublic: boolean }).profilePublic;
        return json({ dustThresholdDays: 90, profilePublic: isPublic, lastfmUsername: null });
      },
    });
    const { user } = renderApp('/u/tester');

    const toggle = await screen.findByRole('checkbox', { name: 'Public profile' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/Only you can see this page/)).toBeInTheDocument();
    // Nothing to share while it's private.
    expect(screen.queryByRole('button', { name: 'Share profile' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ profilePublic: true });
    await waitFor(() => expect(toggle).toBeChecked());
    expect(screen.getByText('Anyone with the link can see this page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share profile' })).toBeInTheDocument();
  });

  it("puts a link to the owner's profile in the header", async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Test Listener' })).toHaveAttribute(
      'href',
      '/u/tester',
    );
  });
});

function makeYear(overrides: Partial<YearInRecords> = {}): YearInRecords {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    listeningSeconds: i === 2 ? 5400 : i === 0 ? 1800 : 0,
  }));
  return {
    user: { username: 'alex', displayName: 'Alex', memberSince: '2025-03-15T12:00:00.000Z' },
    isPublic: true,
    isOwner: false,
    year: 2026,
    totals: { spinCount: 4, listeningSeconds: 7200, recordCount: 1, artistCount: 1 },
    topRecords: [{ record: KIND_OF_BLUE, spinCount: 4, listeningSeconds: 7200 }],
    topArtists: [{ id: 1, name: 'Miles Davis', spinCount: 4, listeningSeconds: 7200 }],
    months,
    topGenres: [{ name: 'Jazz', listeningSeconds: 7200 }],
    addedCount: 1,
    highestRated: { record: KIND_OF_BLUE, rating: 5 },
    ...overrides,
  };
}

describe('YearInRecordsPage', () => {
  it("shows the year's highlights, chart and top lists", async () => {
    mockApi({ 'GET /api/profiles/alex/years/2026': () => json(makeYear()) });
    const { user } = renderApp('/u/alex/year/2026', { loggedInAs: null });

    expect(await screen.findByRole('heading', { name: '2026 in records' })).toBeInTheDocument();
    expect(screen.getByText('Record of the year')).toBeInTheDocument();
    expect(screen.getByText('Artist of the year').nextSibling).toHaveTextContent('Miles Davis');
    expect(screen.getByText('Busiest month').nextSibling).toHaveTextContent(/Mar.*1 h 30 min/);
    expect(screen.getByText('New on the shelf').nextSibling).toHaveTextContent('1 record');
    expect(screen.getByText('Highest rated').nextSibling).toHaveTextContent('Kind of Blue');
    expect(screen.getByRole('region', { name: 'Top genres' })).toHaveTextContent('Jazz');
    expect(screen.getByRole('link', { name: '← Alex' })).toHaveAttribute('href', '/u/alex');

    // The chart's numbers are also available as a table.
    const chart = screen.getByRole('region', { name: 'Listening by month' });
    await user.click(within(chart).getByRole('button', { name: 'Show as table' }));
    expect(within(chart).getAllByRole('row')).toHaveLength(13); // header + 12 months
    expect(within(chart).getByRole('row', { name: /Mar.*1 h 30 min/ })).toBeInTheDocument();
  });

  it('says so when the year has no plays', async () => {
    mockApi({
      'GET /api/profiles/alex/years/2019': () =>
        json(
          makeYear({
            year: 2019,
            totals: { spinCount: 0, listeningSeconds: 0, recordCount: 0, artistCount: 0 },
            topRecords: [],
            topArtists: [],
            topGenres: [],
          }),
        ),
    });

    renderApp('/u/alex/year/2019');

    expect(
      await screen.findByRole('heading', { name: 'No plays logged in 2019' }),
    ).toBeInTheDocument();
  });

  it('is "not found" when the profile is private', async () => {
    mockApi({ 'GET /api/profiles/alex/years/2026': notFound });

    renderApp('/u/alex/year/2026', { loggedInAs: null });

    expect(await screen.findByRole('heading', { name: 'No profile here' })).toBeInTheDocument();
  });
});
