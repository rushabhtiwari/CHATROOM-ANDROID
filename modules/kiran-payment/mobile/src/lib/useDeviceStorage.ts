import { useEffect, useState } from 'react';
import { onStorageFailure, storageError } from '~/native/storage';

/**
 * Whether this phone is keeping what the app saves.
 *
 * The chat store's own `storageStatus` cannot answer that on a device: it
 * saves into the durable-storage shim's memory, which never fails, so it
 * would report "Healthy" while nothing was reaching the phone. This reads the
 * shim's own view instead, and updates the moment a save fails or recovers.
 */
export function useDeviceStorageFailing(): boolean {
  const [failing, setFailing] = useState(() => storageError() !== null);
  useEffect(() => onStorageFailure((error) => setFailing(error !== null)), []);
  return failing;
}
