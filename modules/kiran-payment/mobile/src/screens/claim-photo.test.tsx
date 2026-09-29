import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { takeReceiptPhoto } from '~/native/camera';
import { renderApp } from '~/test/render';
import state from '~/test/fixtures/state.json';

// The camera is the one thing a test cannot hold up to a receipt.
vi.mock('~/native/camera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/native/camera')>()),
  takeReceiptPhoto: vi.fn(async () => new File(['jpeg'], 'photo-1.jpeg', { type: 'image/jpeg' })),
}));

/** What the model reads off a fuel bill. */
const READING = {
  receipts: [{ id: 'RCP-1', fileName: 'photo-1.jpeg', sizeKb: 1, uploadedOn: '2026-09-29' }],
  extraction: {
    title: 'Fuel - Pune client visit',
    category: 'FUEL',
    amount: 1840,
    currency: 'INR',
    vendor: 'HP Petrol Pump, Wakad',
    lineItems: [],
    confidence: {},
    overallConfidence: 0.92,
    policyFindings: [],
    source: 'openai',
    receiptIds: ['RCP-1'],
  },
};

/** What the model says about a photo of a room: nothing, with nothing invented. */
const NO_RECEIPT = {
  receipts: [{ id: 'RCP-0', fileName: 'photo-1.jpeg', sizeKb: 1, uploadedOn: '2026-09-29' }],
  extraction: {
    ...READING.extraction,
    title: 'Home decor purchase',
    category: 'OTHER',
    amount: null,
    vendor: null,
    overallConfidence: 0,
    notes: 'The photo shows a living room, not a receipt.',
    receiptIds: ['RCP-0'],
  },
};

/**
 * The server, for everything a claim touches after the app has loaded. Each
 * reading answers one photo, in turn; the last answers any after it.
 */
function claimServer(readings: unknown[] = [READING]) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const queue = [...readings];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/api/state')) return Response.json(state);
      if (url.endsWith('/api/receipts/extract')) {
        calls.push({ path: '/api/receipts/extract', body: init?.body });
        return Response.json(queue.length > 1 ? queue.shift() : queue[0]);
      }
      if (url.endsWith('/api/requests')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        calls.push({ path: '/api/requests', body });
        return Response.json({ ...body, id: 'REQ-2026-9001' });
      }
      return new Response('Not in the test server', { status: 404 });
    }),
  );
  return calls;
}

async function openClaim(readings?: unknown[]) {
  await renderApp('/chats/d1');
  const calls = claimServer(readings);
  fireEvent.click(await screen.findByRole('button', { name: 'Attach' }));
  fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
  return { calls, sheet: screen.getByRole('dialog', { name: 'Reimbursement claim' }) };
}

describe('a claim from a photo of the receipt', () => {
  it('reads the photo as soon as it is taken, and files what it says', async () => {
    const { calls, sheet } = await openClaim();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Take a photo of the receipt' }));

    // No second tap: the reading is already in the form.
    expect(await within(sheet).findByDisplayValue('Fuel - Pune client visit')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Amount')).toHaveValue('1840');
    expect(within(sheet).getByLabelText('Category')).toHaveValue('FUEL');
    const sent = calls[0]!.body as FormData;
    expect((sent.getAll('files')[0] as File).name).toBe('photo-1.jpeg');

    fireEvent.click(within(sheet).getByRole('button', { name: 'Send to Ananya' }));
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toEqual(['/api/receipts/extract', '/api/requests']),
    );
    expect(calls[1]!.body).toMatchObject({
      title: 'Fuel - Pune client visit',
      category: 'FUEL',
      amount: 1840,
      receiptIds: ['RCP-1'],
      files: [{ fileName: 'photo-1.jpeg' }],
      status: 'SUBMITTED',
    });
    expect(
      await screen.findByText('Filed a reimbursement claim for Ananya Iyer to review.'),
    ).toBeInTheDocument();
  });

  it('says so when the photo shows no receipt, invents nothing, and takes another', async () => {
    vi.mocked(takeReceiptPhoto)
      .mockResolvedValueOnce(new File(['room'], 'photo-1.jpeg', { type: 'image/jpeg' }))
      .mockResolvedValueOnce(new File(['bill'], 'photo-2.jpeg', { type: 'image/jpeg' }));
    const { calls, sheet } = await openClaim([NO_RECEIPT, READING]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Take a photo of the receipt' }));

    expect(
      await within(sheet).findByText(/No receipt could be read: The photo shows a living room/),
    ).toBeInTheDocument();
    expect(within(sheet).queryByText(/This is what the receipt says/)).not.toBeInTheDocument();
    // Not "Home decor purchase": a guess is not a reading.
    expect(within(sheet).getByLabelText('What is it for')).toHaveValue('');
    expect(within(sheet).getByLabelText('Amount')).toHaveValue('');

    fireEvent.click(within(sheet).getByRole('button', { name: 'Take another photo' }));
    expect(await within(sheet).findByDisplayValue('Fuel - Pune client visit')).toBeInTheDocument();
    // The second photo replaced the first rather than joining it.
    const second = calls[1]!.body as FormData;
    expect((second.getAll('files') as File[]).map((file) => file.name)).toEqual(['photo-2.jpeg']);
    expect(within(sheet).getByText('1 receipt attached')).toBeInTheDocument();
  });

  it('leaves the form as it was when the camera closes without a photo', async () => {
    vi.mocked(takeReceiptPhoto).mockResolvedValueOnce(null);
    const { calls, sheet } = await openClaim();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Take a photo of the receipt' }));
    await waitFor(() => expect(takeReceiptPhoto).toHaveBeenCalled());
    expect(
      within(sheet).getByRole('button', { name: 'Take a photo of the receipt' }),
    ).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: /Read the receipt/ })).toBeDisabled();
    expect(calls).toEqual([]);
  });

  it('still takes files, as before', async () => {
    const { sheet } = await openClaim();
    expect(within(sheet).getByRole('button', { name: 'choose a file' })).toBeInTheDocument();
  });
});
