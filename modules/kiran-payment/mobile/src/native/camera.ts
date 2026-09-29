/**
 * Photos, for chat attachments and claim receipts.
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

/**
 * Photograph a receipt for a claim.
 *
 * On a phone, the camera itself. In a browser, the file picker, asking for
 * the rear camera — which a phone's browser opens directly. Null when the
 * person backs out.
 */
export async function takeReceiptPhoto(): Promise<File | null> {
  if (isNative) return pickPhoto('camera');
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}
