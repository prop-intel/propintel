// Client-side cookie utilities

const SITE_COOKIE_NAME = "activeSiteId";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Set the active site ID cookie (client-side)
 */
export function setActiveSiteCookie(siteId: string): void {
  document.cookie = `${SITE_COOKIE_NAME}=${siteId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Clear the active site cookie (client-side)
 */
export function clearActiveSiteCookie(): void {
  document.cookie = `${SITE_COOKIE_NAME}=; path=/; max-age=0`;
}
