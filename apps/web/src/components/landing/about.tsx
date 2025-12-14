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
              The way people find answers has changed. Consumers aren&apos;t searching anymore—they&apos;re asking AI.
              Decisions are being made before a website is ever visited, and the first impression of your brand now
              lives inside an AI-driven response.
            </p>
            <p>
              This shift has created a blind spot in marketing. Most brands have no visibility into how AI
              perceives them—whether they&apos;re seen as the answer or completely overlooked.
            </p>
            <p>
              Our mission is to bring clarity to this new landscape. By unifying AEO, LLMEO, and SEO strategies,
              we give you clear insights into your brand&apos;s presence across every AI-driven journey.
            </p>
            <p>
              This isn&apos;t about resisting change. It&apos;s about seeing clearly where it matters most. Join us, and
              let&apos;s bring your brand into focus.
            </p>
          </div>

          {/* Mobile Content (< 768px) */}
          <div className="md:hidden space-y-6 text-lg text-muted-foreground">
            <p>
              Consumers aren&apos;t searching anymore—they&apos;re asking AI. Decisions happen before a site is ever visited.
            </p>
            <p>
              Most brands have no visibility into how AI perceives them—seen as the answer, or completely overlooked.
            </p>
            <p>
              We bring clarity to this new landscape with unified AEO, LLMEO, and SEO strategies. See clearly
              where it matters most. Join us and bring your brand into focus.
            </p>
          </div>

          <div className="pt-4">
            <Link href="/contact">
              <Button size="lg" className="h-12 px-8 text-base">
                See Clearly <span className="ml-2">→</span> Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
