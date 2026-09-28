import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { prepareProfilePhoto } from '@/lib/profile-photo';
import type { User } from '@/lib/chat-types';
import { Sheet, SheetButton } from '~/components/Sheet';
import { FramedPhoto } from '~/components/Avatar';
import { choosePhoto } from '~/lib/photo';

type Photo = NonNullable<User['photo']>;

/**
 * Choose a photo, then frame it: drag to move, slide to zoom.
 *
 * Both the profile and the group editors land here. The frame is stored with
 * the image rather than baked into it, so the owner can re-frame later
 * without choosing the picture again — as the console's editor does.
 */
export function PhotoEditorSheet({
  title,
  current,
  onSave,
  onClose,
}: {
  title: string;
  current: Photo | null | undefined;
  onSave: (photo: Photo | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Photo | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  const choose = async (source: 'camera' | 'library') => {
    const file = await choosePhoto(source);
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await prepareProfilePhoto(file);
      setDraft({ dataUrl, zoom: 1, x: 50, y: 50 });
    } catch {
      toast.error('That image could not be read. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  if (!draft) {
    return (
      <Sheet onClose={onClose} title={title}>
        <SheetButton icon={<Camera className="h-5 w-5" />} onClick={() => choose('camera')}>
          Take photo
        </SheetButton>
        <SheetButton icon={<ImageIcon className="h-5 w-5" />} onClick={() => choose('library')}>
          Choose from library
        </SheetButton>
        {busy && <p className="px-4 py-3 text-center text-[13px] text-slate-500">Preparing…</p>}
        <SheetButton onClick={onClose}>Cancel</SheetButton>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3 px-6 pb-4 pt-2">
        <div
          className="h-48 w-48 touch-none overflow-hidden rounded-full bg-slate-100 ring-4 ring-accent"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: draft.x, y: draft.y, startX: event.clientX, startY: event.clientY };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            // Dragging the picture right shows more of its left side, so the
            // focus point moves the other way to the finger.
            const dx = ((event.clientX - start.startX) / 192) * (100 / draft.zoom);
            const dy = ((event.clientY - start.startY) / 192) * (100 / draft.zoom);
            setDraft({ ...draft, x: clamp(start.x - dx), y: clamp(start.y - dy) });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          aria-label="Drag to move the photo"
        >
          <FramedPhoto photo={draft} className="pointer-events-none select-none" />
        </div>
        <label className="flex w-full items-center gap-3 text-[13px] text-slate-500">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={draft.zoom}
            onChange={(event) => setDraft({ ...draft, zoom: Number(event.target.value) })}
            className="flex-1 accent-brand"
            aria-label="Zoom"
          />
        </label>
      </div>
      <SheetButton
        tone="brand"
        onClick={() => {
          onSave(draft);
          onClose();
        }}
      >
        Save photo
      </SheetButton>
      <SheetButton icon={<ImageIcon className="h-5 w-5" />} onClick={() => choose('library')}>
        Choose a different photo
      </SheetButton>
      {current && (
        <SheetButton
          tone="danger"
          icon={<Trash2 className="h-5 w-5" />}
          onClick={() => {
            onSave(null);
            onClose();
          }}
        >
          Remove photo
        </SheetButton>
      )}
      <SheetButton onClick={onClose}>Cancel</SheetButton>
    </Sheet>
  );
}
