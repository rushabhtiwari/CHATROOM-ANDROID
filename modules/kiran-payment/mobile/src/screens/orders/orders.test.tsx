import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockSalesOrders } from '@/data/orders';
import { mockDispatches } from '@/data/dispatches';
import { renderApp } from '~/test/render';
import { DISPATCH_STAGES, executedPercent } from '~/lib/orders';

const location = () => screen.getByTestId('location').textContent;

describe('orders', () => {
  it('lists every sales order', async () => {
    await renderApp('/orders');
    for (const order of mockSalesOrders) {
      expect(await screen.findByText(order.poNumber)).toBeInTheDocument();
    }
    expect(screen.getByText(`${mockSalesOrders.length} sales orders`)).toBeInTheDocument();
  });

  it('shows how far through its PO each order is', async () => {
    await renderApp('/orders');
    const order = mockSalesOrders[0]!;
    const bar = (await screen.findAllByRole('progressbar'))[0]!;
    expect(bar).toHaveAttribute('aria-valuenow', String(executedPercent(order)));
  });

  it('searches by customer, PO number or part number', async () => {
    await renderApp('/orders');
    const search = await screen.findByRole('textbox', { name: 'Search orders' });

    fireEvent.change(search, { target: { value: 'alstom' } });
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);

    fireEvent.change(search, { target: { value: 'PO-MOTH-2026-881' } });
    expect(screen.getByText('Motherson Sumi Systems Ltd')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'KU-VAR-0400-H' } });
    expect(screen.getByText('Alstom Transport India Ltd')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'nobody orders this' } });
    expect(screen.getByText('No orders match')).toBeInTheDocument();
  });

  it('opens an order and moves between its schedule, work orders and dispatches', async () => {
    await renderApp('/orders');
    fireEvent.click(await screen.findByText('Motherson Sumi Systems Ltd'));
    expect(location()).toBe('/orders/SO-2026-0741');

    // Schedule is the default tab: the weekly buckets. The detail loads
    // asynchronously — it is shaped for a server — so wait for it.
    expect(await screen.findByText('W1 (01-07 Aug)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Work orders/ }));
    expect(screen.getByText('WO-881-A')).toBeInTheDocument();
    expect(screen.queryByText('W1 (01-07 Aug)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Dispatches/ }));
    expect(screen.getByText('INV-2026-0711')).toBeInTheDocument();
  });

  it('reports an unknown order rather than rendering an empty page', async () => {
    await renderApp('/orders/SO-NOPE');
    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });
});

describe('dispatches', () => {
  it('lists every dispatch, and counts the ones not yet closed as in flight', async () => {
    await renderApp('/dispatches');
    const open = mockDispatches.filter((d) => d.stage !== 'Closed');
    expect(open.length).toBeLessThan(mockDispatches.length); // the mock has a closed one
    expect(await screen.findByText(`${open.length} in flight`)).toBeInTheDocument();
    for (const dispatch of mockDispatches) {
      expect(screen.getByText(new RegExp(dispatch.dispatchNumber))).toBeInTheDocument();
    }
  });

  it('filters by stage, and All brings everything back', async () => {
    await renderApp('/dispatches');
    const closed = mockDispatches.filter((d) => d.stage === 'Closed');
    const chips = await screen.findByText('All');

    fireEvent.click(screen.getByRole('button', { name: /^Closed/ }));
    for (const dispatch of mockDispatches) {
      const row = screen.queryByText(new RegExp(dispatch.dispatchNumber));
      if (closed.includes(dispatch)) expect(row).toBeInTheDocument();
      else expect(row).not.toBeInTheDocument();
    }

    fireEvent.click(chips);
    expect(screen.getByText(new RegExp(mockDispatches[0]!.dispatchNumber))).toBeInTheDocument();
  });

  it('draws the full stage timeline, marking where a dispatch has reached', async () => {
    const dispatch = mockDispatches.find((d) => d.stage === 'ASN linked')!;
    await renderApp(`/dispatches/${dispatch.id}`);
    const timeline = (await screen.findByText('Progress')).closest('section')!;
    for (const stage of DISPATCH_STAGES) {
      expect(within(timeline).getByText(stage)).toBeInTheDocument();
    }
    // The current stage is the one set in bold.
    expect(within(timeline).getByText('ASN linked')).toHaveClass('font-semibold');
  });

  it('warns when a dispatch is blocked on an overdue account', async () => {
    const blocked = mockDispatches.find((d) => d.stopDispatchBlocked)!;

    await renderApp(`/dispatches/${blocked.id}`);
    expect(await screen.findByText('Dispatch blocked')).toBeInTheDocument();
  });

  it('shows no block warning on a dispatch that is clear', async () => {
    const clear = mockDispatches.find((d) => !d.stopDispatchBlocked)!;
    await renderApp(`/dispatches/${clear.id}`);
    await screen.findByText('Progress');
    expect(screen.queryByText('Dispatch blocked')).not.toBeInTheDocument();
  });
});

describe('tab bar', () => {
  it('moves between sections', async () => {
    await renderApp('/chats');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    fireEvent.click(within(nav).getByRole('link', { name: /Orders/ }));
    expect(location()).toBe('/orders');
    fireEvent.click(within(nav).getByRole('link', { name: /Dispatches/ }));
    expect(location()).toBe('/dispatches');
    fireEvent.click(within(nav).getByRole('link', { name: /Me/ }));
    expect(location()).toBe('/me');
  });

  it('sends the root to the chat list', async () => {
    await renderApp('/');
    expect(location()).toBe('/chats');
  });
});
