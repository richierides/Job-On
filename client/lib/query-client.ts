import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server.
 *
 * Prefer EXPO_PUBLIC_API_URL when it is set to a full URL. EXPO_PUBLIC_DOMAIN
 * is kept for compatibility with the original Replit setup and may be either a
 * host name or a full URL.
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_DOMAIN;

  if (!configuredUrl) {
    throw new Error("EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN is not set");
  }

  if (/^https?:\/\//i.test(configuredUrl)) {
    return new URL(configuredUrl).href;
  }

  const protocol =
    configuredUrl.startsWith("localhost") ||
    configuredUrl.startsWith("127.0.0.1") ||
    configuredUrl.startsWith("10.") ||
    configuredUrl.startsWith("192.168.")
      ? "http"
      : "https";

  return new URL(`${protocol}://${configuredUrl}`).href;
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${getApiUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
