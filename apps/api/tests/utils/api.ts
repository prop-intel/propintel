export interface ApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function makeApiRequest(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { method = "GET", headers = {}, body } = options;

  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    ...headers,
  });

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  return fetch(url, requestOptions);
}

export async function makeBackendApiRequest(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions & {
    apiKey?: string;
    sessionToken?: string;
    cookie?: string;
  } = {}
): Promise<Response> {
  const { apiKey, sessionToken, cookie, ...restOptions } = options;

  const headers: Record<string, string> = {
    ...restOptions.headers,
  };

  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  } else if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  } else if (cookie) {
    headers["Cookie"] = cookie;
  }

  return makeApiRequest(`${baseUrl}${path}`, {
    ...restOptions,
    headers,
  });
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }
}
