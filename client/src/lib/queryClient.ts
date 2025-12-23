import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE_URL } from "./api/config";
import { getAuthHeaders, STORAGE_KEYS } from "./api/config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Prepend API_BASE_URL if the URL starts with /api/
  // API_BASE_URL already contains /api, so we remove it from the url
  const fullUrl = url.startsWith("/api/")
    ? `${API_BASE_URL}${url.substring(4)}` // Remove /api from url since API_BASE_URL already has it
    : url;

  // Attach authenticated player/club headers for all API requests so that
  // NestJS controllers that expect x-player-id / x-club-id always receive them.
  const playerId =
    localStorage.getItem(STORAGE_KEYS.PLAYER_ID) ||
    sessionStorage.getItem(STORAGE_KEYS.PLAYER_ID) ||
    undefined;
  const clubId =
    localStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
    sessionStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
    undefined;

  const authHeaders = getAuthHeaders(
    playerId as string | undefined,
    clubId as string | undefined,
  );

  const res = await fetch(fullUrl, {
    method,
    headers: data
      ? {
          ...authHeaders,
        }
      : {
          ...authHeaders,
        },
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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Frontend-only mode: Vite may return index.html with 200 status for unknown /api/* routes.
    // Avoid JSON parse errors by checking the content type and returning null when it's not JSON.
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null as any;
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
