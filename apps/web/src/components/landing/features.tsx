"use client";

import { motion } from "motion/react";
import {
  Bot,
  Code2,
  GitCompare,
  LineChart,
  Search,
  Target
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Active AI Simulation",
    description: "Our agents query Perplexity, SearchGPT, and Google in real-time to see if your content is the answer."
  },
  {
    icon: Target,
    title: "Triple Score System",
    description: "We present distinct AEO, LLMEO, and SEO scores for a holistic view of your brand's total AI visibility."
  },
  {
    icon: GitCompare,
    title: "Competitor Benchmarking",
    description: "Compare your scores side-by-side with top performers to identify exact gaps."
  },
  {
    icon: Code2,
    title: "Cursor Prompts",
    description: "One-click generation of detailed coding prompts. Paste them into Cursor to instantly optimize your page."
  },
  {
    icon: Bot,
    title: "Bot Analytics",
    description: "Track actual visits from AI crawlers (GPTBot, ClaudeBot) to verify they can access your optimized content."
  },
  {
    icon: LineChart,
    title: "Progress Tracking",
    description: "Monitor your optimization journey over time. See how each improvement moves you closer to your goals."
  }
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Your Path to Better Visibility</h2>
          <p className="text-muted-foreground text-lg">
            Stop guessing what AI thinks of your site. BrandSight delivers clear insights into your brand&apos;s visibility, giving you the tools to measure, analyze, and improve your standing in the Answer Engine era.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-background border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <feature.icon className="size-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
