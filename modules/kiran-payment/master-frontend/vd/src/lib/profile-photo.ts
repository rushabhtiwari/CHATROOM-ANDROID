import { useCallback } from "react";
import { useChat } from "./chat-store";

export interface ProfilePhoto {
  dataUrl: string;
  zoom: number;
  x: number;
  y: number;
}

/**
 * A person's profile photo, from the shared workspace.
 *
 * It used to live in this browser's storage, so nobody else ever saw it. Now
 * setting it is a `profile.update` op: every device in the workspace gets it.
 */
export function useUserProfilePhoto(userId: string) {
  const { userById, updateProfilePhoto } = useChat();
  const photo: ProfilePhoto | null = userById(userId).photo ?? null;

  const setOwnPhoto = useCallback(
    (actorUserId: string, value: ProfilePhoto | null) => {
      // Only your own: the op always applies to whoever sends it.
      if (actorUserId !== userId) return false;
      updateProfilePhoto(value);
      return true;
    },
    [userId, updateProfilePhoto],
  );

  return { photo, setOwnPhoto };
}

export async function prepareProfilePhoto(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode image"));
    element.src = source;
  });
  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.86);
}
