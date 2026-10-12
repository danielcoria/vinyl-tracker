// ============================================================================
// DiscoverPage.test.tsx: TESTS FOR RECOMMENDATIONS
// ============================================================================

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Recommendation, Recommendations } from '@vinyl/shared';
import { formatList } from '../features/streaming/format';
import { apiError, json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function recommendation(
  artist: string,
  title: string,
  because: string[],
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    title,
    artist,
    coverImageUrl: null,
    lastfmUrl: null,
    because,
    wishlistItemId: null,
    ...overrides,
  };
}

const RESULT: Recommendations = {
  recommendations: [
    recommendation('Charles Mingus', 'Mingus Ah Um', ['Miles Davis', 'John Coltrane']),
    recommendation('Herbie Hancock', 'Head Hunters', ['Miles Davis'], { wishlistItemId: 4 }),
  ],
  basedOn: ['Miles Davis', 'John Coltrane'],
  sample: false,
};

const PRICE = {
  found: true,
  releaseId: 9,
  releaseTitle: 'Charles Mingus - Mingus Ah Um',
  lowestPrice: 18.5,
  currency: 'USD',
  numForSale: 40,
};

function server(result: Recommendations = RESULT) {
  return mockApi({
    'GET /api/recommendations': () => json(result),
    'GET /api/streaming/price': () => json(PRICE),
    'POST /api/wishlist': ({ body }) =>
      json(
        { id: 9, addedAt: '2026-10-12T12:00:00.000Z', playCount: null, ...(body as object) },
        201,
      ),
  });
}

describe('lists of names', () => {
  it('are written as a sentence would', () => {
    expect(formatList(['Miles Davis'])).toBe('Miles Davis');
    expect(formatList(['Miles Davis', 'John Coltrane'])).toMatch(/^Miles Davis \S+ John Coltrane$/);
    expect(formatList(['A', 'B', 'C'])).toMatch(/^A, B,? \S+ C$/);
  });
});

describe('DiscoverPage', () => {
  it('shows each suggestion with its reason and price', async () => {
    server();

    renderApp('/discover');

    const list = await screen.findByRole('list', { name: 'Recommendations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Mingus Ah Um');
    expect(rows[0]).toHaveTextContent('Charles Mingus');
    expect(rows[0]).toHaveTextContent(
      `Because you own ${formatList(['Miles Davis', 'John Coltrane'])}`,
    );
    expect(await within(rows[0] as HTMLElement).findByText(/From .*18\.50/)).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: 'Find on Discogs' }),
    ).toHaveAttribute('href', '/discogs?q=Charles+Mingus+Mingus+Ah+Um');
    expect(screen.getByText(/Albums you don't own/)).toHaveTextContent(
      formatList(['Miles Davis', 'John Coltrane']),
    );
  });

  it('adds a suggestion to the wishlist, and shows ones already there', async () => {
    const api = server();
    const { user } = renderApp('/discover');
    const list = await screen.findByRole('list', { name: 'Recommendations' });
    const [mingus, hancock] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement];

    // Head Hunters is on the wishlist already.
    expect(within(hancock).getByText('✓ On your wishlist')).toBeInTheDocument();
    expect(within(hancock).queryByRole('button', { name: '+ Wishlist' })).not.toBeInTheDocument();

    await user.click(within(mingus).getByRole('button', { name: '+ Wishlist' }));

    expect(await within(mingus).findByText('✓ On your wishlist')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      title: 'Mingus Ah Um',
      artist: 'Charles Mingus',
      coverImageUrl: null,
    });
  });

  it('explains an empty shelf', async () => {
    server({ recommendations: [], basedOn: [], sample: false });

    renderApp('/discover');

    expect(
      await screen.findByRole('heading', { name: 'Nothing to go on yet' }),
    ).toBeInTheDocument();
    // (The menu has an "Add from Discogs" link too; this is the one on the page itself.)
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Add from Discogs' }),
    ).toHaveAttribute('href', '/discogs');
  });

  it('says so when there is a shelf but nothing to suggest', async () => {
    server({ recommendations: [], basedOn: ['Obscure Band'], sample: false });

    renderApp('/discover');

    expect(await screen.findByText(/No suggestions this time/)).toBeInTheDocument();
  });

  it('labels sample data', async () => {
    server({ ...RESULT, sample: true });

    renderApp('/discover');

    expect(await screen.findByRole('note')).toHaveTextContent('Sample data');
  });

  it('explains when Last.fm is not set up, or cannot be reached', async () => {
    mockApi({
      'GET /api/recommendations': () =>
        apiError(503, 'LASTFM_NOT_CONFIGURED', 'Last.fm is not set up.'),
    });
    const first = renderApp('/discover');
    expect(
      await screen.findByRole('heading', { name: "Last.fm isn't set up on this server" }),
    ).toBeInTheDocument();
    first.unmount();

    mockApi({
      'GET /api/recommendations': () =>
        apiError(502, 'LASTFM_UNAVAILABLE', "Couldn't reach Last.fm. Try again later."),
    });
    renderApp('/discover');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach Last.fm");
  });

  it('is in the main menu', async () => {
    server();
    renderApp('/discover');

    expect(await screen.findByRole('link', { name: 'Discover' })).toHaveAttribute(
      'href',
      '/discover',
    );
  });
});
