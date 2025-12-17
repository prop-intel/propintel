import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: {
    default: "Brand-Sight - AI Crawler Analytics Dashboard",
    template: "%s | Brand-Sight",
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
  authors: [{ name: "Brand-Sight" }],
  creator: "Brand-Sight",
  publisher: "Brand-Sight",
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
    url: "https://brand-sight.com",
    title: "Brand-Sight - AI Crawler Analytics Dashboard",
    description:
      "Track and analyze AI crawler visits to your website. Monitor search engines, AI training bots, and research crawlers with real-time analytics.",
    siteName: "Brand-Sight",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Brand-Sight - AI Crawler Analytics Dashboard",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brand-Sight - AI Crawler Analytics Dashboard",
    description:
      "Track and analyze AI crawler visits to your website. Monitor search engines, AI training bots, and research crawlers with real-time analytics.",
    images: ["/opengraph-image.png"],
    creator: "@brandsight",
  },
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  metadataBase: new URL("https://brand-sight.com"),
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
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        {/* AI Crawler Tracking Pixel */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://brand-sight.com/api/pixel/3q4SCx-rqOqxlGnE"
          alt=""
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            border: 0,
          }}
        />
      </body>
    </html>
  );
}
