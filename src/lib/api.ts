export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal; formData?: FormData } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body || init.formData ? "POST" : "GET"),
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.formData ?? (init.body ? JSON.stringify(init.body) : undefined),
      signal: init.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK", "Can't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON error page
  }
  if (!res.ok) {
    const err = (data.error ?? {}) as { code?: string; message?: string };
    if (!err.message && (res.status === 504 || res.status === 502 || res.status === 503)) {
      throw new ApiClientError(res.status, "TIMEOUT", "The server took too long to respond. Please try again.", data);
    }
    throw new ApiClientError(
      res.status,
      err.code ?? "ERROR",
      err.message ?? "Something went wrong. Please try again.",
      data
    );
  }
  return data as T;
}

export const errorMessage = (e: unknown): string =>
  e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.";
