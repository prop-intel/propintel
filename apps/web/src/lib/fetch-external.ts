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

// Create a custom HTTPS agent that skips SSL certificate verification
// This is necessary because Vercel's serverless runtime doesn't have all CA certificates
// and fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY for some Cloudflare-protected sites
// This is safe for our use case (fetching public robots.txt and page content)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

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
      port: parsedUrl.port ?? (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      timeout: options.timeout,
      agent: isHttps ? httpsAgent : undefined,
      headers: {
        Accept: "text/html,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "User-Agent":
          options.userAgent ??
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        // Handle relative redirects
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        httpsGet(redirectUrl, options).then(resolve).catch(reject);
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

    req.on("error", (err) => {
      console.error("HTTPS request error:", err.message);
      reject(err);
    });
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
    // Log the error for debugging
    console.error("fetchExternal error:", error);
    throw error;
  }
}
