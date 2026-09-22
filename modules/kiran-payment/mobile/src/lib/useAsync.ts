import { useEffect, useState } from 'react';

/**
 * Run a promise and report its three states.
 *
 * Small on purpose. The data layer is async today only so that it can become
 * genuinely remote later; until then this is all the machinery the screens
 * need, and a query library would be scaffolding for a server that does not
 * exist yet.
 */
export function useAsync<T>(run: () => Promise<T>, deps: unknown[]) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    run()
      .then((result) => {
        if (live) {
          setValue(result);
          setError(null);
        }
      })
      .catch((caught) => live && setError(caught))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { value, error, loading };
}
