import type { User } from '@/lib/chat-types';
import { cn } from '@/lib/utils';

type Photo = NonNullable<User['photo']>;

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

/** A cropped photo, framed the way its owner framed it in the editor. */
export function FramedPhoto({ photo, className }: { photo: Photo; className?: string }) {
  return (
    <img
      src={photo.dataUrl}
      alt=""
      className={cn('h-full w-full object-cover', className)}
      style={{ objectPosition: `${photo.x}% ${photo.y}%`, transform: `scale(${photo.zoom})` }}
    />
  );
}

/**
 * A person: their photo if they set one, otherwise initials on their colour.
 * The same everywhere a person appears — list, bubble, profile — so a face
 * set on one device is the face on every other.
 */
export function PersonAvatar({
  user,
  size = 40,
  showStatus = false,
  className,
}: {
  user: User;
  size?: number;
  showStatus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold text-white"
        style={{ backgroundColor: user.color, fontSize: Math.max(10, size * 0.36) }}
        aria-hidden
      >
        {user.photo ? <FramedPhoto photo={user.photo} /> : initialsOf(user.name)}
      </div>
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-surface',
            user.online ? 'bg-online' : 'bg-slate-300',
          )}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
          aria-label={user.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

export { initialsOf };
