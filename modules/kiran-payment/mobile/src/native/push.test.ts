import { describe, expect, it } from 'vitest';
import { destinationFrom } from '~/native/push';

describe('destinationFrom', () => {
  it('opens the conversation a message notification names', () => {
    expect(destinationFrom({ roomId: 'r1', messageId: 'm9' })).toEqual({
      kind: 'room',
      roomId: 'r1',
      messageId: 'm9',
    });
    expect(destinationFrom({ roomId: 'r1' })).toEqual({
      kind: 'room',
      roomId: 'r1',
      messageId: undefined,
    });
  });

  it('opens a dispatch or an order', () => {
    expect(destinationFrom({ dispatchId: 'DSP-1' })).toEqual({
      kind: 'dispatch',
      dispatchId: 'DSP-1',
    });
    expect(destinationFrom({ orderId: 'SO-1' })).toEqual({ kind: 'order', orderId: 'SO-1' });
  });

  it('ignores payloads that name nowhere, or name it with the wrong type', () => {
    // A payload comes from a server; nothing about its shape is guaranteed.
    expect(destinationFrom(undefined)).toBeNull();
    expect(destinationFrom({})).toBeNull();
    expect(destinationFrom({ roomId: 42 })).toBeNull();
    expect(destinationFrom({ roomId: 'r1', messageId: 7 })).toEqual({
      kind: 'room',
      roomId: 'r1',
      messageId: undefined,
    });
  });
});
