import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { SearchVsAI } from "@/components/landing/search-vs-ai";
import { Features } from "@/components/landing/features";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <div className="min-h-screen bg-background font-sans antialiased">
        <Navbar />
        <main>
          <Hero />
          <SearchVsAI />
          <Features />
          <CTA />
        </main>
        <Footer />
      </div>
    </HydrateClient>
  );
}
