// ============================================================================
// NewRecordPage.test.tsx: TESTS FOR THE "ADD A RECORD" SCREEN
//
// These fill in the form the way a person would (typing, clicking, choosing
// from menus) and check what gets sent to the (pretend) server.
// ============================================================================

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiError, json, makeRecord, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

describe('NewRecordPage', () => {
  it('sends the new record and opens its page', async () => {
    const created = makeRecord({ id: 42, title: 'Blue' });
    const api = mockApi({
      'POST /api/records': () => json(created, 201),
      'GET /api/records/42': () => json(created),
    });
    const { user } = renderApp('/records/new');

    await user.type(screen.getByLabelText('Title'), 'Blue');
    await user.type(screen.getByLabelText('Artist 1'), 'Joni Mitchell');
    await user.click(screen.getByRole('button', { name: '+ Add another artist' }));
    await user.type(screen.getByLabelText('Artist 2'), 'James Taylor');
    await user.type(screen.getByLabelText('Year'), '1971');
    await user.type(screen.getByLabelText('Length'), '36:15');
    await user.selectOptions(screen.getByLabelText('Media condition'), 'VG+ (Very Good Plus)');
    // Genres: press Enter to add each one.
    await user.type(screen.getByLabelText('Genres'), 'Rock{Enter}Folk, World, & Country{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add record' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/records/42'));
    const post = api.calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({
      title: 'Blue',
      artists: ['Joni Mitchell', 'James Taylor'],
      year: 1971,
      runtimeSeconds: 2175,
      mediaCondition: 'VG+',
      sleeveCondition: null,
      genres: ['Rock', 'Folk, World, & Country'],
      styles: [],
    });
  });

  it('shows problems next to the fields and sends nothing', async () => {
    const api = mockApi({});
    const { user } = renderApp('/records/new');

    await user.type(screen.getByLabelText('Length'), 'about 40 minutes');
    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('At least one artist is required')).toBeInTheDocument();
    expect(screen.getByText('Use minutes:seconds, like 42:49')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('lets you remove tags and extra artists', async () => {
    mockApi({});
    const { user } = renderApp('/records/new');

    await user.type(screen.getByLabelText('Styles'), 'Bebop{Enter}Modal{Enter}');
    await user.click(screen.getByRole('button', { name: 'Remove Bebop' }));
    expect(screen.queryByText('Bebop')).not.toBeInTheDocument();
    expect(screen.getByText('Modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add another artist' }));
    await user.click(screen.getByRole('button', { name: 'Remove artist 2' }));
    expect(screen.queryByLabelText('Artist 2')).not.toBeInTheDocument();
  });

  it("shows the server's message if saving fails", async () => {
    mockApi({
      'POST /api/records': () => apiError(400, 'VALIDATION', 'title: Keep the title short'),
    });
    const { user } = renderApp('/records/new');

    await user.type(screen.getByLabelText('Title'), 'Blue');
    await user.type(screen.getByLabelText('Artist 1'), 'Joni Mitchell');
    await user.click(screen.getByRole('button', { name: 'Add record' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('title: Keep the title short');
    expect(screen.getByTestId('location')).toHaveTextContent('/records/new');
  });
});
