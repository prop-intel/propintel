/**
 * Utility for fetching external URLs with proper error handling
 * Works around SSL certificate issues in different environments
 */

interface FetchExternalOptions {
  timeout?: number;
  userAgent?: string;
}

export async function fetchExternal(
  url: string,
  options: FetchExternalOptions = {}
): Promise<Response> {
  const { timeout = 10000, userAgent } = options;

  // Build headers
  const headers: HeadersInit = {};
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }
  // Add Accept header to behave more like a browser
  headers["Accept"] = "text/html,text/plain,*/*";

  const fetchOptions: RequestInit = {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
    // Ensure we follow redirects
    redirect: "follow",
  };

  try {
    // First attempt with provided options
    const response = await fetch(url, fetchOptions);
    return response;
  } catch (error) {
    // If first attempt fails, try without custom User-Agent
    if (userAgent) {
      try {
        const fallbackResponse = await fetch(url, {
          method: "GET",
          headers: { Accept: "text/html,text/plain,*/*" },
          signal: AbortSignal.timeout(timeout),
          cache: "no-store",
          redirect: "follow",
        });
        return fallbackResponse;
      } catch {
        // Fall through to throw original error
      }
    }
    throw error;
  }
}
