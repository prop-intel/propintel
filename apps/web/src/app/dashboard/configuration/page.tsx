import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { api } from "@/trpc/server";
import { ConfigurationContent } from "@/components/configuration/configuration-content";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function ConfigurationPage() {
  noStore(); // Ensure page is always dynamically rendered

  const sites = await api.site.list();

  if (sites.length === 0) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>
            Select a site to view configuration options.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const cookieStore = await cookies();
  const cookieSiteId = cookieStore.get("activeSiteId")?.value ?? null;
  const activeSite = cookieSiteId
    ? sites.find((s) => s.id === cookieSiteId) ?? sites[0]
    : sites[0];

  if (!activeSite) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>No site selected</AlertTitle>
          <AlertDescription>
            Select a site to view configuration options.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [robots, llms, llmsFull, permissions] = await Promise.all([
    api.robots.fetchRobotsTxt({ siteId: activeSite.id }),
    api.robots.fetchLlmsTxt({ siteId: activeSite.id }),
    api.robots.fetchLlmsFullTxt({ siteId: activeSite.id }),
    api.robots.analyzePermissions({ siteId: activeSite.id }),
  ]);

  return (
    <ConfigurationContent
      site={{
        id: activeSite.id,
        domain: activeSite.domain,
        name: activeSite.name,
        trackingId: activeSite.trackingId,
      }}
      sites={sites.map((s) => ({
        id: s.id,
        domain: s.domain,
        name: s.name,
        trackingId: s.trackingId,
      }))}
      initialData={{
        robots,
        llms,
        llmsFull,
        permissions,
      }}
    />
  );
}
