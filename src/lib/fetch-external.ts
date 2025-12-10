/**
 * Utility for fetching external URLs with proper error handling
 * Works around SSL certificate issues in different environments
 */
import https from "https";
import http from "http";

interface FetchExternalOptions {
  timeout?: number;
  userAgent?: string;
}

/**
 * Make an HTTPS request using Node's native https module
 * This bypasses some of the fetch SSL issues on Vercel
 */
function httpsGet(
  url: string,
  options: { timeout: number; userAgent?: string }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      timeout: options.timeout,
      headers: {
        Accept: "text/html,text/plain,*/*",
        "User-Agent":
          options.userAgent ??
          "Mozilla/5.0 (compatible; PropIntel/1.0; +https://propintel.app)",
      },
    };

    const req = client.request(requestOptions, (res) => {
      // Handle redirects
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        httpsGet(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 200, body });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

export async function fetchExternal(
  url: string,
  options: FetchExternalOptions = {}
): Promise<Response> {
  const { timeout = 10000, userAgent } = options;

  try {
    // Use native https module which handles SSL better on Vercel
    const result = await httpsGet(url, { timeout, userAgent });

    // Create a Response-like object
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    // Fallback to fetch if https fails
    console.error("httpsGet failed, falling back to fetch:", error);

    const headers: Record<string, string> = {
      Accept: "text/html,text/plain,*/*",
    };
    if (userAgent) {
      headers["User-Agent"] = userAgent;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
      redirect: "follow",
    });
    return response;
  }
}
