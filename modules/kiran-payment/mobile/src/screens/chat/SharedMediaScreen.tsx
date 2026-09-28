import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, FileText, Forward, Link2, MessageSquare, X } from 'lucide-react';
import { toServerUrl } from '~/api/origin';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { sharedContentOf } from '@/lib/shared-content';
import { isSafeHref } from '@/lib/link-preview';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { RoomPickerSheet } from '~/components/Pickers';
import { useOpenMessage } from '~/components/MessageList';
import { formatBytes, relativeTime } from '~/lib/format';
import { selection } from '~/native/haptics';

type Tab = 'media' | 'docs' | 'links';

/** One photo, filling the screen, with the two things you do next. */
export function PhotoViewer({ message, onClose }: { message: SharedMessage; onClose: () => void }) {
  const { userById, forwardMessage } = useChat();
  const open = useOpenMessage();
  const [forwarding, setForwarding] = useState(false);
  const attachment = message.attachment!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Photo">
      <div className="flex items-center gap-2 px-2 pt-safe-top text-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{userById(message.senderId).name}</p>
          <p className="text-[12px] text-white/70">{relativeTime(message.timestamp)}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <img
          src={toServerUrl(attachment.dataUrl)}
          alt={attachment.name}
          className="max-h-full max-w-full"
        />
      </div>
      <div className="flex justify-around px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 text-white">
        <button
          type="button"
          onClick={() => {
            onClose();
            open(message);
          }}
          className="flex flex-col items-center gap-1 text-[12px]"
        >
          <MessageSquare className="h-5 w-5" /> Show in chat
        </button>
        <button
          type="button"
          onClick={() => setForwarding(true)}
          className="flex flex-col items-center gap-1 text-[12px]"
        >
          <Forward className="h-5 w-5" /> Forward
        </button>
      </div>
      {forwarding && (
        <RoomPickerSheet
          title="Forward photo"
          action="Forward"
          onPick={(roomIds) => {
            forwardMessage(message.id, roomIds);
            toast.success('Forwarded');
          }}
          onClose={() => setForwarding(false)}
        />
      )}
    </div>
  );
}

/** Everything a conversation has shared, sorted into what you are looking for. */
export function SharedMediaScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const { messages, rooms, roomTitle, userById } = useChat();
  const open = useOpenMessage();
  const [tab, setTab] = useState<Tab>('media');
  const [viewing, setViewing] = useState<SharedMessage | null>(null);
  const room = rooms.find((candidate) => candidate.id === roomId);

  const { media, docs, links } = useMemo(
    () => sharedContentOf(messages.filter((message) => message.roomId === roomId)),
    [messages, roomId],
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'media', label: 'Media', count: media.length },
    { id: 'docs', label: 'Docs', count: docs.length },
    { id: 'links', label: 'Links', count: links.length },
  ];

  return (
    <Screen back title="Media, links and docs" subtitle={room ? roomTitle(room) : undefined}>
      <div className="sticky top-0 z-10 bg-surface px-4 py-2">
        <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-0.5" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => {
                selection();
                setTab(item.id);
              }}
              className={cn(
                'h-8 rounded-md text-[13px] font-medium',
                tab === item.id ? 'bg-surface text-ink shadow-sm' : 'text-slate-500',
              )}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {tab === 'media' &&
        (media.length ? (
          <div className="grid grid-cols-3 gap-0.5">
            {media.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => setViewing(message)}
                className="aspect-square overflow-hidden bg-slate-100"
                aria-label={`Photo from ${userById(message.senderId).name}`}
              >
                {message.attachment!.type.startsWith('video/') ? (
                  <video
                    src={toServerUrl(message.attachment!.dataUrl)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={toServerUrl(message.attachment!.dataUrl)}
                    alt={message.attachment!.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
          </div>
        ) : (
          <Empty title="No photos or videos yet" detail="Photos sent in this chat show up here." />
        ))}

      {tab === 'docs' &&
        (docs.length ? (
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {docs.map((message) => (
              <li key={message.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="rounded-lg bg-accent p-2 text-brand">
                  <FileText className="h-5 w-5" />
                </span>
                <button
                  type="button"
                  onClick={() => open(message)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[15px] text-ink">
                    {message.attachment!.name}
                  </span>
                  <span className="block text-[12px] text-slate-500">
                    {formatBytes(message.attachment!.size)} · {userById(message.senderId).name} ·{' '}
                    {relativeTime(message.timestamp)}
                  </span>
                </button>
                {message.attachment!.dataUrl && (
                  <a
                    href={toServerUrl(message.attachment!.dataUrl)}
                    download={message.attachment!.name}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${message.attachment!.name}`}
                    className="flex h-10 w-10 items-center justify-center text-brand"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No documents yet" />
        ))}

      {tab === 'links' &&
        (links.length ? (
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {links.map(({ message, preview }, index) => (
              <li key={`${message.id}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="rounded-lg bg-accent p-2 text-brand">
                  <Link2 className="h-5 w-5" />
                </span>
                <button
                  type="button"
                  onClick={() => open(message)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[15px] text-ink">{preview.title}</span>
                  <span className="block truncate text-[12px] text-slate-500">{preview.url}</span>
                </button>
                {isSafeHref(preview.url) && (
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${preview.url}`}
                    className="flex h-10 w-10 items-center justify-center text-brand"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No links yet" />
        ))}

      {viewing && <PhotoViewer message={viewing} onClose={() => setViewing(null)} />}
    </Screen>
  );
}
