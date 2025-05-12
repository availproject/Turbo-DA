import { useEffect, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type Params = Record<string, string | number | boolean | undefined>;

const buildUrl = (url: string, params?: Params): string => {
  if (!params) return url;

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");

  return query ? `${url}?${query}` : url;
};

export const useFetch = <T = unknown>({
  url,
  params,
  options,
}: {
  url: string;
  params?: Params;
  options?: RequestInit;
}) => {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const finalUrl = buildUrl(url, params);

    setState({ data: null, loading: true, error: null });

    fetch(finalUrl, { ...options, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const data = (await response.json()) as T;
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ data: null, loading: false, error: error.message });
        }
      });

    return () => controller.abort();
  }, [url, JSON.stringify(params), JSON.stringify(options)]);

  return state;
};
