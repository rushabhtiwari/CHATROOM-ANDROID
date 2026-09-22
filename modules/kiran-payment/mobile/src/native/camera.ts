/**
 * Photos, for chat attachments.
 *
 * The chat store's `sendAttachment` takes a `File`, which is what an <input>
 * hands it on the web. The native pickers return a URI or a base64 payload
 * instead, so this converts back to a `File` and the store stays unaware that
 * a camera was involved.
 */
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './platform';

const filenameFor = (format: string) => `photo-${Date.now()}.${format || 'jpeg'}`;

async function toFile(webPath: string, name: string): Promise<File> {
  const blob = await (await fetch(webPath)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

/**
 * Take a photo, or pick one from the library.
 *
 * Returns null when the user backs out, which is an ordinary outcome and not
 * an error — a cancelled picker should leave the composer exactly as it was.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<File | null> {
  if (!isNative) return null;

  try {
    const photo = await Camera.getPhoto({
      quality: 82,
      // The phone's full-resolution capture is several megabytes and the chat
      // stores attachments locally; the long edge is capped so a conversation
      // does not fill the device.
      width: 2048,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    });
    if (!photo.webPath) return null;
    return await toFile(photo.webPath, filenameFor(photo.format));
  } catch {
    // The plugin rejects on cancellation as well as on failure, and the two
    // are not distinguishable from here.
    return null;
  }
}
