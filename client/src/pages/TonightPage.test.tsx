// ============================================================================
// TonightPage.test.tsx: TESTS FOR "WHAT SHOULD I PLAY TONIGHT?"
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Suggestion, Suggestions } from '@vinyl/shared';
import { formatDaysAgo } from '../features/dust/time-ago';
import { reasonsFor } from '../features/tonight/reasons';
import { json, makeSpin, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function suggestion(id: number, title: string, overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    record: { id, title, artists: [{ id, name: `Artist ${id}` }], coverImageUrl: null },
    year: 1970,
    genres: ['Jazz'],
    rating: null,
    spinCount: 2,
    lastPlayedAt: '2026-06-01T20:00:00.000Z',
    daysSince: 120,
    sides: null,
    durationSeconds: 2700,
    ...overrides,
  };
}

const PICKS: Suggestions = {
  suggestions: [
    suggestion(1, 'Kind of Blue', { rating: 4.5 }),
    suggestion(2, 'Blue Train', { lastPlayedAt: null, spinCount: 0, daysSince: 300 }),
    suggestion(3, 'Mingus Ah Um'),
  ],
  matchCount: 5,
  genres: ['Jazz', 'Rock'],
};

/** A pretend server: the first three picks, then two more once those are left out. */
function server() {
  return mockApi({
    'GET /api/suggestions': ({ search }) =>
      search.get('exclude')
        ? json({
            ...PICKS,
            suggestions: [suggestion(4, 'A Love Supreme'), suggestion(5, 'Giant Steps')],
          })
        : json(PICKS),
    'POST /api/spins': ({ body }) => json(makeSpin(body as object), 201),
  });
}

const asked = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter((c) => c.path === '/api/suggestions').map((c) => c.search.toString());

describe('the reasons for a suggestion', () => {
  it('says when it was last played, the rating, and what fits', () => {
    const s = suggestion(1, 'Kind of Blue', { rating: 4.5, sides: ['A'], durationSeconds: 1435 });

    expect(reasonsFor(s, 25)).toEqual([
      `Last played ${formatDaysAgo(120)}`,
      'You gave it 4.5 stars',
      'Side A fits your 25 minutes (23:55)',
    ]);
  });

  it('handles never played, several sides, whole records and no time limit', () => {
    const never = suggestion(2, 'Blue Train', { lastPlayedAt: null });
    expect(reasonsFor(never, null)).toEqual(['Never played', 'Runs 45:00']);
    expect(reasonsFor(never, 60)).toContain('The whole record fits (45:00)');
    expect(
      reasonsFor(suggestion(3, 'Double', { sides: ['A', 'B'], durationSeconds: 2400 }), 45),
    ).toContain('Sides A & B fit your 45 minutes (40:00)');
    // Nothing about length when it isn't known.
    expect(reasonsFor(suggestion(4, 'Mystery', { durationSeconds: null }), null)).toHaveLength(1);
  });
});

describe('TonightPage', () => {
  it('shows three picks with their reasons', async () => {
    server();

    renderApp('/tonight');

    const list = await screen.findByRole('list', { name: 'Suggestions' });
    const cards = within(list).getAllByRole('heading', { level: 2 });
    expect(cards.map((c) => c.textContent)).toEqual(['Kind of Blue', 'Blue Train', 'Mingus Ah Um']);
    expect(within(list).getByText('You gave it 4.5 stars')).toBeInTheDocument();
    expect(within(list).getByText('Never played')).toBeInTheDocument();
    expect(within(list).getAllByText('Put on the whole record')).toHaveLength(3);
  });

  it('says which sides to put on when only part of the record fits', async () => {
    mockApi({
      'GET /api/suggestions': () =>
        json({
          suggestions: [suggestion(1, 'Double LP', { sides: ['A', 'B'], durationSeconds: 2400 })],
          matchCount: 1,
          genres: [],
        }),
    });

    renderApp('/tonight?minutes=45');

    expect(await screen.findByText('Put on sides A & B')).toBeInTheDocument();
  });

  it('says how many records the picks came from, and links to them', async () => {
    server();

    renderApp('/tonight');

    await screen.findByRole('list', { name: 'Suggestions' });
    expect(screen.getByText('Picked from 5 records that fit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kind of Blue' })).toHaveAttribute(
      'href',
      '/records/1',
    );
  });

  it('asks again when the time, mood or genre changes, and keeps them in the address', async () => {
    const api = server();
    const { user } = renderApp('/tonight');
    await screen.findByRole('list', { name: 'Suggestions' });
    expect(asked(api)).toEqual(['mood=any']);

    await user.click(screen.getByRole('button', { name: '45 min' }));
    await user.click(screen.getByRole('button', { name: 'Neglected' }));
    await user.selectOptions(screen.getByLabelText('Genre'), 'Rock');

    await waitFor(() => expect(asked(api).at(-1)).toBe('mood=neglected&minutes=45&genre=Rock'));
    expect(screen.getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/tonight?minutes=45&mood=neglected&genre=Rock',
    );
  });

  it('reads the question from the address', async () => {
    const api = server();

    renderApp('/tonight?minutes=30&mood=favorites');

    await screen.findByRole('list', { name: 'Suggestions' });
    expect(asked(api)).toEqual(['mood=favorites&minutes=30']);
    expect(screen.getByRole('button', { name: 'Favorites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shuffles to different records, then offers to start over', async () => {
    const api = server();
    const { user } = renderApp('/tonight');
    await screen.findByRole('heading', { name: 'Kind of Blue' });

    await user.click(screen.getByRole('button', { name: '↻ Shuffle' }));

    expect(await screen.findByRole('heading', { name: 'A Love Supreme' })).toBeInTheDocument();
    expect(asked(api).at(-1)).toBe('mood=any&exclude=1%2C2%2C3');
    expect(screen.queryByRole('heading', { name: 'Kind of Blue' })).not.toBeInTheDocument();
    // All five have now been shown.
    expect(screen.getByText("That's everything that fits.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '↻ Shuffle' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(await screen.findByRole('heading', { name: 'Kind of Blue' })).toBeInTheDocument();
  });

  it('logs the play in one click, as starting now', async () => {
    const api = server();
    const { user } = renderApp('/tonight?minutes=30');
    const list = await screen.findByRole('list', { name: 'Suggestions' });
    const first = within(list).getAllByRole('listitem')[0] as HTMLElement;

    await user.click(within(first).getByRole('button', { name: '▶ Play this now' }));

    expect(await within(first).findByRole('status')).toHaveTextContent('Logged. Enjoy!');
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      recordId: 1,
      sides: null,
      durationSeconds: 2700,
    });
    // The other picks stay where they were.
    expect(within(list).getAllByRole('button', { name: '▶ Play this now' })).toHaveLength(2);
  });

  it('links to the record instead when its length is unknown', async () => {
    mockApi({
      'GET /api/suggestions': () =>
        json({
          suggestions: [suggestion(9, 'Mystery LP', { durationSeconds: null })],
          matchCount: 1,
          genres: [],
        }),
    });

    renderApp('/tonight');

    expect(await screen.findByRole('link', { name: 'Open record' })).toHaveAttribute(
      'href',
      '/records/9',
    );
    expect(screen.getByText('1 of your records fits')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '↻ Shuffle' })).not.toBeInTheDocument();
  });

  it('explains an empty shelf, and a question nothing fits', async () => {
    mockApi({
      'GET /api/suggestions': ({ search }) =>
        json({ suggestions: [], matchCount: 0, genres: search.get('minutes') ? ['Jazz'] : [] }),
    });
    const { user } = renderApp('/tonight');

    expect(
      await screen.findByRole('heading', { name: 'Nothing to suggest yet' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '20 min' }));

    expect(
      await screen.findByRole('heading', { name: 'Nothing on your shelf fits' }),
    ).toBeInTheDocument();
  });

  it('is in the main menu', async () => {
    server();
    renderApp('/tonight');

    expect(await screen.findByRole('link', { name: 'Tonight' })).toHaveAttribute(
      'href',
      '/tonight',
    );
  });
});
