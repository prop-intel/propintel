import Link from "next/link";
import { Button } from "@/components/ui/button";

export function About() {
  return (
    <section className="py-24 bg-muted/50">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">About Us</h2>

          {/* Desktop Content (>= 768px) */}
          <div className="hidden md:block space-y-6 text-lg text-muted-foreground">
            <p>
              The way people find answers has changed. Consumers aren’t searching anymore—they’re asking AI.
              Decisions are being made before a website is ever visited, and the first impression of your brand now
              lives inside an AI-driven response.
            </p>
            <p>
              That shift has created a new, unmapped ocean in marketing. Brands are either part of the
              conversation—visible, trusted, and sailing forward—or they’re invisible and sinking.
            </p>
            <p>
              Our mission is to help every client, across every vertical, navigate these waters with confidence. By
              unifying AEO, LLMEO, and SEO strategies, we provide the map and tools to maximize your presence in
              AI-driven journeys.
            </p>
            <p>
              This isn’t about resisting change. It’s about showing up where it matters most. Join us, and let’s chart
              your course together.
            </p>
          </div>

          {/* Mobile Content (< 768px) */}
          <div className="md:hidden space-y-6 text-lg text-muted-foreground">
            <p>
              Consumers aren’t searching anymore—they’re asking AI. Decisions happen before a site is ever visited.
            </p>
            <p>
              Brands are either part of the AI conversation—visible and sailing—or invisible and sinking.
            </p>
            <p>
              We help every client navigate this new ocean with unified AEO, LLMEO, and SEO strategies. Show up
              where it matters most. Join us and chart your course.
            </p>
          </div>

          <div className="pt-4">
            <Link href="/contact">
              <Button size="lg" className="h-12 px-8 text-base">
                Chart Your Course <span className="ml-2">→</span> Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
