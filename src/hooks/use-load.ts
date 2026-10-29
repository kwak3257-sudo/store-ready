import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Loads data each time the screen comes into view, so changes made on other screens show up. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    load()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  useFocusEffect(reload);
  return { data, error, reload };
}
