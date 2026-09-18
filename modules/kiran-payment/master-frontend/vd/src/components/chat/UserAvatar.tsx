import { cn } from "@/lib/utils";
import { initials, type Room, type User } from "@/lib/chat-types";
import { useUserProfilePhoto } from "@/lib/profile-photo";

export function UserAvatar({
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
  const { photo } = useUserProfilePhoto(user.id);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 font-semibold text-white"
        style={{
          background: user.color,
          fontSize: size * 0.36,
        }}
      >
        {photo ? (
          <img
            src={photo.dataUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${photo.x}% ${photo.y}%`,
              transform: `scale(${photo.zoom})`,
            }}
          />
        ) : (
          initials(user.name)
        )}
      </div>
      {showStatus && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface",
            user.online ? "bg-online animate-pulse-ring" : "bg-muted-foreground",
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export function GroupAvatar({
  name,
  color,
  photo,
  size = 40,
}: {
  name: string;
  color?: string | undefined;
  photo?: Room["photo"] | undefined;
  size?: number;
}) {
  const c = color ?? "#4cc9f0";
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden border border-white/80 font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: c,
        fontSize: size * 0.36,
        clipPath: "polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%)",
      }}
    >
      {photo ? (
        <img
          src={photo.dataUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${photo.x}% ${photo.y}%`,
            transform: `scale(${photo.zoom})`,
          }}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
