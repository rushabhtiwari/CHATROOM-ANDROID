import { pickPhoto } from '~/native/camera';
import { isNative } from '~/native/platform';

/**
 * Ask for one image: the native camera or library on a phone, a file picker
 * in a browser. Resolves null if the person backs out.
 *
 * The browser branch builds its input on the spot rather than keeping one in
 * the page, so any screen can ask for a photo without carrying markup for it.
 * It must be called from a tap, or the browser refuses to open the picker.
 */
export function choosePhoto(source: 'camera' | 'library'): Promise<File | null> {
  if (isNative) return pickPhoto(source);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'user');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
