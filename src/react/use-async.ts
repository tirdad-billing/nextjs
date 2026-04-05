/**
 * @tirdad/billing/react — Shared hook utilities
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Generic async data fetching hook with refetch support.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  const execute = useCallback(() => {
    const currentFetch = ++fetchCountRef.current;
    setIsLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (mountedRef.current && currentFetch === fetchCountRef.current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current && currentFetch === fetchCountRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  return { data, isLoading, error, refetch: execute };
}
