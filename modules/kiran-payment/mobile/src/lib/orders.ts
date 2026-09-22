/**
 * Orders and dispatches, behind a seam.
 *
 * Today both come from the console's seeded arrays — there is no orders API
 * yet, and building the app around that absence honestly is better than
 * pretending. What this module buys is that every screen already reads through
 * an async function, so when sub-project #3 lands the bodies change and no
 * screen does.
 */
import { mockSalesOrders } from '@/data/orders';
import { mockDispatches } from '@/data/dispatches';
import type { DispatchItem, SalesOrder } from '@/types';

/** The six stages a dispatch moves through, in order. */
export const DISPATCH_STAGES: DispatchItem['stage'][] = [
  'SLD generated',
  'Invoice raised',
  'ASN linked',
  'Dispatched',
  'POD/GRN pending',
  'Closed',
];

export const stageIndex = (stage: DispatchItem['stage']) => DISPATCH_STAGES.indexOf(stage);

export async function listOrders(): Promise<SalesOrder[]> {
  return mockSalesOrders;
}

export async function getOrder(id: string): Promise<SalesOrder | undefined> {
  return mockSalesOrders.find((order) => order.id === id);
}

export async function listDispatches(): Promise<DispatchItem[]> {
  return mockDispatches;
}

export async function getDispatch(id: string): Promise<DispatchItem | undefined> {
  return mockDispatches.find((dispatch) => dispatch.id === id);
}

/** How far through its purchase order an order is, as a percentage. */
export const executedPercent = (order: SalesOrder) =>
  order.poQty === 0 ? 0 : Math.round((order.executedQty / order.poQty) * 100);
