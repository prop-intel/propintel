import { notFound } from "next/navigation";
import { api } from "@/trpc/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UrlDetailPage({ params }: Props) {
  const { id } = await params;

  const url = await api.url.getById({ id }).catch(() => null);

  if (!url) {
    notFound();
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold truncate">{url.path}</h1>
        <p className="text-muted-foreground">
          First seen: {url.firstSeen.toLocaleDateString()}
          {url.lastCrawled && ` | Last crawled: ${url.lastCrawled.toLocaleDateString()}`}
        </p>
      </div>

      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p>URL analytics coming soon</p>
        <p className="text-sm mt-2">
          This page will show crawler visit details for this specific URL.
        </p>
      </div>
    </div>
  );
}
