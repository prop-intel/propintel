import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: {
    default: "BrandSight - AI Crawler Analytics Dashboard",
    template: "%s | BrandSight",
  },
  description:
    "Track and analyze AI crawler visits to your website. Monitor search engines, AI training bots, and research crawlers with real-time analytics and insights.",
  keywords: [
    "AI crawler tracking",
    "bot analytics",
    "web crawler monitoring",
    "AI training data",
    "search engine analytics",
    "website crawler insights",
    "bot detection",
    "crawler heatmap",
  ],
  authors: [{ name: "BrandSight" }],
  creator: "BrandSight",
  publisher: "BrandSight",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://brandsight.com",
    title: "BrandSight - AI Crawler Analytics Dashboard",
    description:
      "Track and analyze AI crawler visits to your website. Monitor search engines, AI training bots, and research crawlers with real-time analytics.",
    siteName: "BrandSight",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrandSight - AI Crawler Analytics Dashboard",
    description:
      "Track and analyze AI crawler visits to your website. Monitor search engines, AI training bots, and research crawlers with real-time analytics.",
    creator: "@brandsight",
  },
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  metadataBase: new URL("https://brandsight.com"),
  alternates: {
    canonical: "/",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
