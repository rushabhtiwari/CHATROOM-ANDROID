import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Does the chat store actually use the device attachment store?
 *
 * The store imports `./attachment-store` relatively, from inside the console's
 * source; vite.config.ts redirects that one import here. If the redirect
 * stopped working, the app would silently fall back to IndexedDB — which is
 * exactly the storage iOS may clear — and every other test would still pass.
 */
const put = vi.hoisted(() => vi.fn(async () => true));
vi.mock('~/native/attachment-store', async () => {
  const limits = await import('@/lib/attachment-store');
  return {
    INLINE_ATTACHMENT_LIMIT: limits.INLINE_ATTACHMENT_LIMIT,
    MAX_ATTACHMENT_BYTES: limits.MAX_ATTACHMENT_BYTES,
    blobStoreAvailable: async () => true,
    putAttachmentBlob: put,
    attachmentUrl: async () => null,
    rememberAttachmentUrl: () => {},
    collectOrphanBlobs: async () => 0,
  };
});

const { ChatProvider, useChat } = await import('@/lib/chat-store');
const { createLocalLog } = await import('@/lib/chat-log');

function SendPhoto() {
  const { sendAttachment, storageReady } = useChat();
  useEffect(() => {
    if (!storageReady) return;
    // Over the inline limit, so it has to go to the attachment store.
    const bytes = new Uint8Array(300_000);
    void sendAttachment('r1', new File([bytes], 'site.jpg', { type: 'image/jpeg' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageReady]);
  return null;
}

describe('chat store wiring', () => {
  it('stores attachments through the device store, not IndexedDB', async () => {
    // A log with no server: on the chat server attachments are uploaded
    // instead, and the device store is what holds them everywhere else.
    render(
      <ChatProvider log={createLocalLog({ failureRate: 0, latency: 10 })}>
        <SendPhoto />
      </ChatProvider>,
    );
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [, blob] = put.mock.calls[0] as unknown as [string, Blob];
    expect(blob.size).toBe(300_000);
  });
});
