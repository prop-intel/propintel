"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import Link from "next/link";
import { Bot, CheckCircle2, Sparkles, Terminal } from "lucide-react";
import { useState } from "react";

export function Hero() {
  const [url, setUrl] = useState("");

  const handleAnalyze = () => {
    if (!url) return;
    window.location.href = `/dashboard?url=${encodeURIComponent(url)}`;
  };
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50 backdrop-blur-sm text-sm font-medium mb-6"
          >
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent font-bold">New:</span>
            Generate Cursor Prompts to fix your content
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            Win the <span className="text-primary">AI Answer</span> Slot
            <br className="hidden md:block" /> with AEO Agents
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-8 max-w-2xl leading-relaxed"
          >
            PropIntel doesn&apos;t just track bots—it <strong>simulates</strong> them. Our agents actively search Perplexity, Google, and SearchGPT to see if you&apos;re cited, then write the code to fix your ranking.
          </motion.p>

          {/* URL Input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="w-full max-w-lg mb-8"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-background rounded-lg p-1 pr-1 border shadow-sm">
                <Input
                  placeholder="Enter your website URL (e.g. example.com)"
                  className="border-0 shadow-none focus-visible:ring-0 h-10 md:text-base text-base bg-transparent"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Button
              size="lg"
              className="h-12 px-8 text-base shadow-lg shadow-primary/20"
              onClick={handleAnalyze}
            >
              Analyze My Site
              <Sparkles className="ml-2 size-4" />
            </Button>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                See How It Works
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur shadow-2xl overflow-hidden p-2 md:p-4">
            <div className="rounded-lg bg-background border border-border/50 overflow-hidden relative min-h-[400px]">
              {/* Mock Header */}
              <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 gap-2 justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-500/20" />
                    <div className="size-3 rounded-full bg-yellow-500/20" />
                    <div className="size-3 rounded-full bg-green-500/20" />
                  </div>
                  <div className="h-6 w-48 bg-muted rounded-md flex items-center px-2 text-[10px] text-muted-foreground font-mono">
                    AEO Analysis: pricing-page
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground">Agents Active</span>
                </div>
              </div>

              {/* Mock Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                {/* Sidebar / Stats */}
                <div className="border-r p-6 space-y-6 bg-muted/10">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">AEO Visibility Score</div>
                    <div className="text-4xl font-bold flex items-baseline gap-2">
                      65
                      <span className="text-sm font-normal text-muted-foreground">/100</span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 w-[65%]" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Top Competitors</div>
                    {[
                      { name: "stripe.com", score: 92 },
                      { name: "paddle.com", score: 88 },
                      { name: "lemonsqueezy.com", score: 81 }
                    ].map((c, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span>{c.name}</span>
                        <span className="font-mono text-muted-foreground">{c.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content / Analysis */}
                <div className="col-span-2 p-6">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-500 bg-blue-500/10 w-fit px-3 py-1 rounded-full">
                      <Bot className="size-4" />
                      <span>Analysis by Tavily & OpenAI Agent</span>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-card border rounded-lg p-4 shadow-sm">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-green-500" />
                          Winning Query
                        </h3>
                        <p className="text-sm text-muted-foreground">&quot;Best payment processor for SaaS&quot;</p>
                        <div className="mt-3 text-xs bg-muted p-2 rounded border-l-2 border-green-500">
                          Cited in <strong>Perplexity</strong> and <strong>SearchGPT</strong> results.
                        </div>
                      </div>

                      <div className="bg-card border rounded-lg p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                        <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">Missed Opportunity</h3>
                        <p className="text-sm text-muted-foreground mb-3">&quot;SaaS pricing models comparison&quot;</p>

                        <div className="bg-zinc-950 text-zinc-50 rounded-lg p-3 font-mono text-xs overflow-x-auto relative group">
                          <div className="absolute top-2 right-2 opacity-100 bg-zinc-800 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <Terminal className="size-3" />
                            Cursor Prompt Ready
                          </div>
                          <div className="text-zinc-500"># Generated optimization task</div>
                          <div><span className="text-purple-400">### 1. Add Pricing Comparison Table</span></div>
                          <div className="pl-4 border-l border-zinc-800 ml-1 mt-1">
                            Add a markdown table comparing flat-rate vs tiered pricing.<br />
                            Use &apos;PaymentModel&apos; schema markup...
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-4 top-20 md:-left-12 md:top-32 bg-background border p-3 rounded-lg shadow-xl flex items-center gap-3 z-20"
          >
            <div className="bg-blue-100 p-2 rounded-md dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="text-xs font-semibold">Tavily Agent</div>
              <div className="text-[10px] text-muted-foreground">Simulating 12 queries...</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -right-4 bottom-20 md:-right-12 md:bottom-32 bg-background border p-3 rounded-lg shadow-xl flex items-center gap-3 z-20"
          >
            <div className="bg-purple-100 p-2 rounded-md dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-xs font-semibold">Optimization Ready</div>
              <div className="text-[10px] text-muted-foreground">+15% projected visibility</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
