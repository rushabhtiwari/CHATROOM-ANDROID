import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * jsdom gaps that WKWebView does not have. Blob.arrayBuffer/text and
 * URL.createObjectURL all shipped in Safari 14, and Capacitor 7 requires iOS 14,
 * so the app relies on them; jsdom still has none of the three. They are filled
 * here from jsdom's own FileReader, which is how a browser defines them.
 */
function read(blob: Blob, as: 'buffer' | 'text'): Promise<ArrayBuffer | string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer | string);
    reader.onerror = () => reject(reader.error);
    if (as === 'buffer') reader.readAsArrayBuffer(blob);
    else reader.readAsText(blob);
  });
}
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return read(this, 'buffer') as Promise<ArrayBuffer>;
  };
}
if (!Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob) {
    return read(this, 'text') as Promise<string>;
  };
}
if (!URL.createObjectURL) {
  let next = 0;
  URL.createObjectURL = () => `blob:test/${++next}`;
  URL.revokeObjectURL = () => {};
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Each test starts from the seeded workspace, not from what the last one sent.
  localStorage.clear();
});
