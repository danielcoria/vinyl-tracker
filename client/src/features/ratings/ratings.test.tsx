// ============================================================================
// ratings.test.tsx: TESTS FOR STAR RATINGS AND REVIEWS ON THE WEBSITE
//
// Rating and reviewing a record on its page, rating a listen when logging it,
// and where the stars then show up.
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VinylRecord } from '@vinyl/shared';
import { json, makeRecord, makeSpin, mockApi } from '../../test/fake-api';
import { renderApp } from '../../test/render';

/** A pretend server that remembers the record's rating and review. */
function serverWithRecord(start: Partial<VinylRecord> = {}) {
  let record = makeRecord({ id: 1, ...start });
  const api = mockApi({
    'GET /api/records/1': () => json(record),
    'PUT /api/records/1/review': ({ body }) => {
      const { rating, review } = body as { rating: number | null; review: string | null };
      record = {
        ...record,
        rating,
        review: review || null,
        reviewedAt: '2026-10-11T12:00:00.000Z',
      };
      return json(record);
    },
    'POST /api/spins': ({ body }) => json(makeSpin(body as object), 201),
  });
  const sent = () => api.calls.filter((c) => c.method === 'PUT').map((c) => c.body);
  return { api, sent };
}

const yourRating = () => screen.findByRole('radiogroup', { name: 'Your rating' });

describe('rating a record', () => {
  it('saves the stars as soon as they are clicked', async () => {
    const { sent } = serverWithRecord();
    const { user } = renderApp('/records/1');

    const stars = await yourRating();
    await user.click(within(stars).getByRole('radio', { name: '4.5 stars' }));

    expect(sent()).toEqual([{ rating: 4.5, review: null }]);
    await waitFor(() =>
      expect(within(stars).getByRole('radio', { name: '4.5 stars' })).toBeChecked(),
    );
  });

  it('clears the rating, keeping the review', async () => {
    const { sent } = serverWithRecord({ rating: 3, review: 'Solid.' });
    const { user } = renderApp('/records/1');

    const section = await screen.findByRole('region', { name: 'Rating and review' });
    await user.click(within(section).getByRole('button', { name: 'Clear' }));

    expect(sent()).toEqual([{ rating: null, review: 'Solid.' }]);
    await waitFor(() =>
      expect(within(section).queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument(),
    );
    expect(within(section).getByText('Solid.')).toBeInTheDocument();
  });

  it('writes a review, keeping the rating', async () => {
    const { sent } = serverWithRecord({ rating: 5 });
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: 'Write a review' }));
    await user.type(screen.getByLabelText('Review'), 'Perfect late at night.');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    expect(await screen.findByText('Perfect late at night.')).toBeInTheDocument();
    expect(sent()).toEqual([{ rating: 5, review: 'Perfect late at night.' }]);
    // The box closes, and the button now offers to edit.
    expect(screen.getByRole('button', { name: 'Edit review' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Review')).not.toBeInTheDocument();
  });

  it('cancels a review without saving', async () => {
    const { sent } = serverWithRecord({ review: 'Old words.' });
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: 'Edit review' }));
    expect(screen.getByLabelText('Review')).toHaveValue('Old words.');
    await user.type(screen.getByLabelText('Review'), ' More.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(sent()).toEqual([]);
    expect(screen.getByText('Old words.')).toBeInTheDocument();
  });
});

describe('rating a listen', () => {
  it('sends the stars with the play', async () => {
    const { api } = serverWithRecord();
    const { user } = renderApp('/records/1');

    const button = await screen.findByRole('button', { name: '▶ Log a play' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const listen = screen.getByRole('radiogroup', { name: 'Rate this listen' });
    await user.click(within(listen).getByRole('radio', { name: '4 stars' }));
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({ rating: 4 }),
    );
  });

  it('sends no rating when the stars are left alone', async () => {
    const { api } = serverWithRecord();
    const { user } = renderApp('/records/1');

    const button = await screen.findByRole('button', { name: '▶ Log a play' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({ rating: null }),
    );
  });
});

describe('where the stars show up', () => {
  it('on rated records in the collection, and rated plays in the diary', async () => {
    mockApi({
      'GET /api/records': () =>
        json({
          records: [
            makeRecord({ id: 1, title: 'Starred LP', rating: 4.5 }),
            makeRecord({ id: 2, title: 'Plain LP' }),
          ],
        }),
      'GET /api/spins': () => json({ spins: [makeSpin({ rating: 3.5 })] }),
    });
    const { user } = renderApp('/');

    const rated = await screen.findByRole('link', { name: /Starred LP/ });
    expect(within(rated).getByRole('img', { name: '4.5 stars' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('link', { name: /Plain LP/ })).queryByRole('img', {
        name: /stars?$/,
      }),
    ).not.toBeInTheDocument();
    // "Highest rated" is one of the ways to sort.
    expect(screen.getByRole('option', { name: 'Highest rated' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Diary' }));
    expect(await screen.findByRole('img', { name: '3.5 stars' })).toBeInTheDocument();
  });
});
