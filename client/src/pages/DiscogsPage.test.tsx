// ============================================================================
// DiscogsPage.test.tsx: TESTS FOR SEARCHING AND IMPORTING FROM DISCOGS
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DiscogsSearchResult } from '@vinyl/shared';
import { apiError, json, makeRecord, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function makeResult(overrides: Partial<DiscogsSearchResult> = {}): DiscogsSearchResult {
  return {
    releaseId: 2772432,
    title: 'Kind Of Blue',
    artist: 'Miles Davis',
    year: 2010,
    format: 'LP',
    label: 'Columbia',
    catalogNumber: 'CS 8163',
    country: 'France',
    thumbUrl: null,
    inCollectionId: null,
    ...overrides,
  };
}

const page = (results: DiscogsSearchResult[], pageNumber = 1, pages = 3) =>
  json({ results, page: pageNumber, pages });

describe('DiscogsPage', () => {
  it("doesn't search until you press Search", async () => {
    const api = mockApi({ 'GET /api/discogs/search': () => page([makeResult()]) });
    const { user } = renderApp('/discogs');

    await user.type(screen.getByRole('searchbox', { name: 'Search Discogs' }), 'kind of blue');
    expect(api.calls.some((c) => c.path === '/api/discogs/search')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    const row = (await screen.findByText('Kind Of Blue')).closest('li') as HTMLElement;
    expect(within(row).getByText('2010 · LP · France')).toBeInTheDocument();
    expect(within(row).getByText('Columbia · CS 8163')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/discogs?q=kind+of+blue');
  });

  it('adds a release to the collection and then shows it as owned', async () => {
    let owned: number | null = null;
    const api = mockApi({
      'GET /api/discogs/search': () => page([makeResult({ inCollectionId: owned })]),
      'POST /api/discogs/import': () => {
        owned = 5;
        return json(makeRecord({ id: 5, title: 'Kind Of Blue' }), 201);
      },
    });
    const { user } = renderApp('/discogs?q=kind+of+blue');

    await user.click(await screen.findByRole('button', { name: 'Add to collection' }));

    expect(await screen.findByText(/Added “Kind Of Blue” to your collection/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'In your collection →' })).toHaveAttribute(
      'href',
      '/records/5',
    );
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ releaseId: 2772432 });
  });

  it('pages through the results', async () => {
    const api = mockApi({
      'GET /api/discogs/search': ({ search }) =>
        page(
          [makeResult({ title: `Result page ${search.get('page')}` })],
          Number(search.get('page')),
        ),
    });
    const { user } = renderApp('/discogs?q=blue');

    await screen.findByText('Result page 1');
    expect(screen.getByRole('button', { name: '← Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next →' }));

    expect(await screen.findByText('Result page 2')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(api.calls.at(-1)?.search.get('page')).toBe('2');
  });

  it('explains when Discogs is not set up', async () => {
    mockApi({
      'GET /api/discogs/search': () =>
        apiError(503, 'DISCOGS_NOT_CONFIGURED', 'Discogs is not set up. Add DISCOGS_TOKEN.'),
    });

    renderApp('/discogs?q=blue');

    expect(await screen.findByRole('alert')).toHaveTextContent('Discogs is not set up');
  });

  it('says when nothing is found', async () => {
    mockApi({ 'GET /api/discogs/search': () => page([], 1, 0) });

    renderApp('/discogs?q=zzzz');

    expect(await screen.findByText('No vinyl releases found for “zzzz”.')).toBeInTheDocument();
  });

  describe('finding the release for a record you already have', () => {
    it('links the chosen release to the record and goes back to it', async () => {
      const record = makeRecord({ id: 9, title: 'Kind of Blue' });
      const api = mockApi({
        'GET /api/records/9': () => json(record),
        'GET /api/discogs/search': () => page([makeResult()]),
        'POST /api/discogs/link': () => json({ ...record, discogsReleaseId: 2772432 }),
      });
      const { user } = renderApp('/discogs?link=9&q=Miles+Davis+Kind+of+Blue');

      expect(await screen.findByText('“Kind of Blue”')).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toHaveValue('Miles Davis Kind of Blue');
      await user.click(await screen.findByRole('button', { name: 'Use this release' }));

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(/^\/records\/9$/),
      );
      expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
        recordId: 9,
        releaseId: 2772432,
      });
    });
  });
});
