// ============================================================================
// CollectionPage.test.tsx: TESTS FOR THE COLLECTION SCREEN
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiError, json, makeRecord, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

const RECORDS = [
  makeRecord({ id: 1, title: 'Kind of Blue', artists: [{ id: 1, name: 'Miles Davis' }] }),
  makeRecord({
    id: 2,
    title: 'The Velvet Underground & Nico',
    artists: [
      { id: 2, name: 'The Velvet Underground' },
      { id: 3, name: 'Nico' },
    ],
    year: 1967,
    format: '2xLP',
  }),
];

describe('CollectionPage', () => {
  it('shows every record as a card linking to its page', async () => {
    mockApi({ 'GET /api/records': () => json({ records: RECORDS }) });

    renderApp('/');

    const card = await screen.findByRole('link', { name: /The Velvet Underground & Nico/ });
    expect(card).toHaveAttribute('href', '/records/2');
    expect(
      within(card).getByText('The Velvet Underground & Nico', { selector: '.record-card-artist' }),
    ).toBeInTheDocument();
    expect(within(card).getByText('1967 · 2xLP')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kind of Blue/ })).toHaveAttribute(
      'href',
      '/records/1',
    );
    expect(screen.getByRole('heading', { name: /Your collection/ })).toHaveTextContent('2');
  });

  it('searches as you type, after a short pause', async () => {
    const api = mockApi({
      'GET /api/records': ({ search }) =>
        json({ records: search.get('q') === 'nico' ? [RECORDS[1]] : RECORDS }),
    });
    const { user } = renderApp('/');
    await screen.findByRole('link', { name: /Kind of Blue/ });

    await user.type(screen.getByRole('searchbox', { name: 'Search records' }), 'nico');

    // Kind of Blue disappears once the filtered results arrive.
    await screen.findByText('1967 · 2xLP');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Kind of Blue/ })).not.toBeInTheDocument(),
    );
    // Only one search request was sent for the whole word, not one per letter.
    const searches = api.calls.filter((c) => c.path === '/api/records' && c.search.has('q'));
    expect(searches.map((c) => c.search.get('q'))).toEqual(['nico']);
    expect(screen.getByTestId('location')).toHaveTextContent('/?q=nico');
  });

  it('sends the chosen sort to the server and keeps it in the address', async () => {
    const api = mockApi({ 'GET /api/records': () => json({ records: RECORDS }) });
    const { user } = renderApp('/');
    await screen.findByRole('link', { name: /Kind of Blue/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Artist');

    await waitFor(() =>
      expect(api.calls.some((c) => c.search.get('sort') === 'artist')).toBe(true),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/?sort=artist');
  });

  it('invites you to add a record when the collection is empty', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Your shelf is empty' })).toBeInTheDocument();
  });

  it('says so when a search finds nothing', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp('/?q=zzz');

    expect(await screen.findByText('No records match “zzz”.')).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    let fail = true;
    mockApi({
      'GET /api/records': () =>
        fail ? apiError(500, 'INTERNAL', 'Something went wrong') : json({ records: RECORDS }),
    });
    const { user } = renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /Kind of Blue/ })).toBeInTheDocument();
  });
});
