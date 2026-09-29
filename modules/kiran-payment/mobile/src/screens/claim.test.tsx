import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '~/test/render';

const location = () => screen.getByTestId('location').textContent;

describe('a claim, opened from its card', () => {
  it('shows the claim instead of falling through to the chat list', async () => {
    await renderApp('/reimbursements/REQ-2026-0103');
    expect(
      await screen.findByRole('heading', { name: 'Vendor audit - Bengaluru' }),
    ).toBeInTheDocument();
    expect(location()).toBe('/reimbursements/REQ-2026-0103');
    expect(screen.getAllByText('₹26,800').length).toBeGreaterThan(0);
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('says so when the claim does not exist, and offers the way back', async () => {
    await renderApp('/reimbursements/REQ-NOPE');
    expect(await screen.findByText('Claim not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
