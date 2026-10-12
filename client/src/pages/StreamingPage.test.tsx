// ============================================================================
// StreamingPage.test.tsx: TESTS FOR STREAMING VS. SHELF AND THE WISHLIST
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StreamedAlbum, Streaming, VinylPrice, WishlistItem } from '@vinyl/shared';
import { formatPrice, formatStreams } from '../features/streaming/format';
import { apiError, json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function album(rank: number, title: string, overrides: Partial<StreamedAlbum> = {}): StreamedAlbum {
  return {
    rank,
    title,
    artist: `Artist ${rank}`,
    playCount: 500 - rank * 50,
    coverImageUrl: null,
    lastfmUrl: null,
    ownedRecordId: null,
    otherEdition: null,
    wishlistItemId: null,
    ...overrides,
  };
}

const PRICE: VinylPrice = {
  found: true,
  releaseId: 123,
  releaseTitle: 'Artist 1 - In Rainbows',
  lowestPrice: 24.99,
  currency: 'USD',
  numForSale: 37,
};

/** A pretend server that remembers the Last.fm username and the wishlist. */
function server({
  username = 'vinyl_fan' as string | null,
  streaming = {} as Partial<Streaming>,
  wishlist = [] as WishlistItem[],
} = {}) {
  let saved = username;
  let items = [...wishlist];
  const albums = [
    album(1, 'In Rainbows'),
    album(2, 'Kind of Blue', { ownedRecordId: 7 }),
    album(3, 'Blonde'),
  ];
  const api = mockApi({
    'GET /api/settings': () =>
      json({ dustThresholdDays: 90, profilePublic: false, lastfmUsername: saved }),
    'PUT /api/settings': ({ body }) => {
      saved = (body as { lastfmUsername: string | null }).lastfmUsername;
      return json({ dustThresholdDays: 90, profilePublic: false, lastfmUsername: saved });
    },
    'GET /api/streaming': ({ search }) =>
      json({
        username: saved,
        period: search.get('period'),
        sample: false,
        albums: albums.map((a) => ({
          ...a,
          wishlistItemId: items.find((i) => i.title === a.title)?.id ?? null,
        })),
        ...streaming,
      }),
    'GET /api/streaming/price': () => json(PRICE),
    'GET /api/wishlist': () => json({ items }),
    'POST /api/wishlist': ({ body }) => {
      const input = body as Pick<WishlistItem, 'title' | 'artist' | 'coverImageUrl' | 'playCount'>;
      const item = { id: items.length + 1, addedAt: '2026-10-12T12:00:00.000Z', ...input };
      items = [item, ...items];
      return json(item, 201);
    },
    'DELETE /api/wishlist/1': () => {
      items = items.filter((i) => i.id !== 1);
      return new Response(null, { status: 204 });
    },
  });
  return api;
}

const wish = (id: number, title: string, playCount: number | null = 412): WishlistItem => ({
  id,
  title,
  artist: 'Radiohead',
  coverImageUrl: null,
  playCount,
  addedAt: '2026-10-01T12:00:00.000Z',
});

describe('wording', () => {
  it('writes play counts and prices', () => {
    expect(formatStreams(1)).toBe('Streamed once');
    expect(formatStreams(412)).toBe('Streamed 412 times');
    expect(formatPrice(24.99, 'USD')).toContain('24.99');
    // A currency code the browser doesn't know still shows something sensible.
    expect(formatPrice(5, 'not-a-currency')).toBe('5.00 not-a-currency');
  });
});

describe('StreamingPage', () => {
  it('asks for a Last.fm username first, then compares', async () => {
    const api = server({ username: null });
    const { user } = renderApp('/streaming');

    const input = await screen.findByLabelText('Last.fm username');
    // Help for people who don't have Last.fm yet.
    expect(screen.getByText("Don't have a Last.fm username?")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'last.fm/join' })).toHaveAttribute(
      'href',
      'https://www.last.fm/join',
    );
    // Nothing is asked of Last.fm before there's a username.
    expect(api.calls.some((c) => c.path === '/api/streaming')).toBe(false);

    await user.type(input, 'has spaces');
    await user.click(screen.getByRole('button', { name: 'Compare with my shelf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a Last.fm username');

    await user.clear(input);
    await user.type(input, 'vinyl_fan');
    await user.click(screen.getByRole('button', { name: 'Compare with my shelf' }));

    expect(await screen.findByRole('region', { name: 'Not on your shelf' })).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      lastfmUsername: 'vinyl_fan',
    });
  });

  it('splits streamed albums into missing and owned, with play counts and prices', async () => {
    server();

    renderApp('/streaming');

    const missing = await screen.findByRole('region', { name: 'Not on your shelf' });
    const rows = within(missing).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('In Rainbows');
    expect(rows[0]).toHaveTextContent('Streamed 450 times');
    expect(await within(rows[0] as HTMLElement).findByText(/From .*24\.99/)).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: /37 for sale/ }),
    ).toHaveAttribute('href', 'https://www.discogs.com/sell/release/123');
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: 'Find on Discogs' }),
    ).toHaveAttribute('href', '/discogs?q=Artist+1+In+Rainbows');

    const owned = screen.getByRole('region', { name: 'Already on your shelf' });
    expect(within(owned).getByRole('link', { name: 'Kind of Blue' })).toHaveAttribute(
      'href',
      '/records/7',
    );
    expect(screen.getByText(/most-streamed albums/)).toHaveTextContent(
      'You own 1 of your 3 most-streamed albums on vinyl.',
    );
  });

  it('lists albums owned in a different edition separately, still open to wishlisting', async () => {
    server({
      streaming: {
        albums: [
          album(1, 'In Rainbows'),
          album(2, 'Rumours (Super Deluxe)', { otherEdition: { recordId: 3, title: 'Rumours' } }),
          album(3, 'Kind of Blue', { ownedRecordId: 7 }),
        ],
      },
    });

    renderApp('/streaming');

    const editions = await screen.findByRole('region', { name: 'You own a different edition' });
    const row = within(editions).getByRole('listitem');
    expect(row).toHaveTextContent('Rumours (Super Deluxe)');
    // It says which edition is on the shelf, and links to it...
    expect(within(row).getByRole('link', { name: 'Rumours' })).toHaveAttribute(
      'href',
      '/records/3',
    );
    // ...and a collector can still want this one.
    expect(within(row).getByRole('button', { name: '+ Wishlist' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Check price' })).toBeInTheDocument();
    // It's in neither of the other groups.
    expect(screen.getByRole('region', { name: 'Not on your shelf' })).not.toHaveTextContent(
      'Rumours',
    );
    expect(screen.getByRole('region', { name: 'Already on your shelf' })).not.toHaveTextContent(
      'Rumours',
    );
    expect(screen.getByText(/most-streamed albums/)).toHaveTextContent(
      'You own 1 of your 3 most-streamed albums on vinyl, and a different edition of 1 more.',
    );
  });

  it('adds an album to the wishlist', async () => {
    const api = server();
    const { user } = renderApp('/streaming');
    const missing = await screen.findByRole('region', { name: 'Not on your shelf' });
    const first = within(missing).getAllByRole('listitem')[0] as HTMLElement;

    await user.click(within(first).getByRole('button', { name: '+ Wishlist' }));

    expect(await within(first).findByText('✓ On your wishlist')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      title: 'In Rainbows',
      artist: 'Artist 1',
      coverImageUrl: null,
      playCount: 450,
    });
    // The other album can still be added.
    expect(within(missing).getAllByRole('button', { name: '+ Wishlist' })).toHaveLength(1);
  });

  it('asks again for another period, and keeps it in the address', async () => {
    const api = server();
    const { user } = renderApp('/streaming');
    await screen.findByRole('region', { name: 'Not on your shelf' });

    await user.selectOptions(screen.getByLabelText('Period'), 'All time');

    await waitFor(() =>
      expect(
        api.calls.filter((c) => c.path === '/api/streaming').map((c) => c.search.get('period')),
      ).toEqual(['12month', 'overall']),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/streaming?period=overall');
  });

  it('only looks up the first few prices by itself; the rest have a button', async () => {
    const api = server({
      streaming: { albums: Array.from({ length: 7 }, (_, i) => album(i + 1, `Album ${i + 1}`)) },
    });
    const { user } = renderApp('/streaming');
    const missing = await screen.findByRole('region', { name: 'Not on your shelf' });

    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/api/streaming/price')).toHaveLength(5),
    );
    const buttons = within(missing).getAllByRole('button', { name: 'Check price' });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[0] as HTMLElement);

    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/api/streaming/price')).toHaveLength(6),
    );
  });

  it('labels the demo’s sample data', async () => {
    server({ streaming: { sample: true } });

    renderApp('/streaming');

    expect(await screen.findByRole('note')).toHaveTextContent('Sample data');
  });

  it('explains when Last.fm is not set up, or the user does not exist', async () => {
    mockApi({
      'GET /api/settings': () =>
        json({ dustThresholdDays: 90, profilePublic: false, lastfmUsername: 'vinyl_fan' }),
      'GET /api/streaming': ({ search }) =>
        search.get('period') === '12month'
          ? apiError(503, 'LASTFM_NOT_CONFIGURED', 'Last.fm is not set up.')
          : apiError(404, 'LASTFM_USER_NOT_FOUND', 'Last.fm has no user called “vinyl_fan”.'),
    });
    const { user } = renderApp('/streaming');

    expect(
      await screen.findByRole('heading', { name: "Last.fm isn't set up on this server" }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Period'), 'Last month');

    expect(await screen.findByRole('alert')).toHaveTextContent('Last.fm has no user called');
  });

  it('lets you change or disconnect the username', async () => {
    const api = server();
    const { user } = renderApp('/streaming');
    await screen.findByRole('region', { name: 'Not on your shelf' });

    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Last.fm username')).toHaveValue('vinyl_fan');
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(
      await screen.findByRole('button', { name: 'Compare with my shelf' }),
    ).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ lastfmUsername: null });
  });
});

describe('WishlistPage', () => {
  it('lists wished-for albums with why they are here and what they cost', async () => {
    server({ wishlist: [wish(1, 'In Rainbows'), wish(2, 'Kid A', null)] });

    renderApp('/wishlist');

    const list = await screen.findByRole('list', { name: 'Wishlist' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('In Rainbows');
    expect(rows[0]).toHaveTextContent('Streamed 412 times when added');
    expect(rows[1]).not.toHaveTextContent('Streamed');
    expect(await within(rows[0] as HTMLElement).findByText(/From .*24\.99/)).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: 'Find on Discogs' }),
    ).toHaveAttribute('href', '/discogs?q=Radiohead+In+Rainbows');
  });

  it('removes an album', async () => {
    server({ wishlist: [wish(1, 'In Rainbows'), wish(2, 'Kid A')] });
    const { user } = renderApp('/wishlist');

    await user.click(
      await screen.findByRole('button', { name: 'Remove In Rainbows from the wishlist' }),
    );

    await waitFor(() => expect(screen.queryByText('In Rainbows')).not.toBeInTheDocument());
    expect(screen.getByText('Kid A')).toBeInTheDocument();
  });

  it('points to streaming vs. shelf when empty', async () => {
    server();

    renderApp('/wishlist');

    expect(
      await screen.findByRole('heading', { name: 'Your wishlist is empty' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compare streaming vs. shelf' })).toHaveAttribute(
      'href',
      '/streaming',
    );
  });

  it('says when Discogs has no price', async () => {
    mockApi({
      'GET /api/wishlist': () => json({ items: [wish(1, 'Rare One'), wish(2, 'Unknown One')] }),
      'GET /api/streaming/price': ({ search }) =>
        search.get('title') === 'Rare One'
          ? json({ ...PRICE, lowestPrice: null, currency: null, numForSale: 0 })
          : json({ ...PRICE, found: false, releaseId: null, releaseTitle: null }),
    });

    renderApp('/wishlist');

    expect(await screen.findByText('None for sale on Discogs right now')).toBeInTheDocument();
    expect(await screen.findByText('No vinyl pressing found on Discogs')).toBeInTheDocument();
  });
});
