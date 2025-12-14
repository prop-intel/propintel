import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { UrlDetailContent } from "@/components/dashboard/url-detail-content";

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
    <UrlDetailContent
      url={{
        id: url.id,
        path: url.path,
        title: url.title,
        firstSeen: url.firstSeen,
        lastCrawled: url.lastCrawled,
        crawlCount: url.crawlCount,
        siteId: url.siteId,
      }}
    />
  );
}
