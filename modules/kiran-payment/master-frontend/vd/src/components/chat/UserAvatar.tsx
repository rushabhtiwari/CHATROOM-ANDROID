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
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#E9E9EE] font-semibold text-[#3A3A40]"
        style={{ fontSize: Math.max(10, size * 0.36) }}
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
            user.online ? "bg-online" : "bg-[#C4C4CC]",
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
  // Rooms are neutral tiles: colour is reserved for status, not decoration.
  void color;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden bg-[#F0F0F3] font-semibold text-[#3A3A40]"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        fontSize: Math.max(10, size * 0.34),
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
