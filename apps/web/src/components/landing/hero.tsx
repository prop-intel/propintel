"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import { ScoreDashboard } from "@/components/analysis/score-dashboard";
import { CompetitorLandscape } from "@/components/analysis/competitor-landscape";
import { RecommendationsCard } from "@/components/analysis/recommendations-card";

export function Hero() {
  const [url, setUrl] = useState("");

  const handleAnalyze = () => {
    if (!url) return;
    window.location.href = `/login?analyze_url=${encodeURIComponent(url)}`;
  };
  return (
    <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 overflow-hidden">
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-muted/50 backdrop-blur-sm text-sm font-medium mb-6"
          >
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent font-semibold">
              Become the brand AI recommends.
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            AI Gives <span className="text-primary">One Answer.</span>
            <br className="hidden md:block" /> Make Sure It&apos;s You.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-8 max-w-2xl leading-relaxed"
          >
            Track which AI systems cite your brand, understand why competitors appear instead, and get a clear roadmap to own the recommendation.
          </motion.p>

          {/* URL Input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="w-full max-w-2xl mb-8"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group flex-1">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center bg-background rounded-lg p-1 border shadow-sm h-12">
                  <Input
                    placeholder="Enter your website URL (e.g. example.com)"
                    className="border-0 shadow-none focus-visible:ring-0 h-full md:text-base text-base bg-transparent px-4"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  />
                </div>
              </div>
              <Button
                size="lg"
                className="h-12 px-8 text-base shadow-lg shadow-primary/20 shrink-0"
                onClick={handleAnalyze}
              >
                Analyze My Site
                <Sparkles className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scattered UI Elements */}
        <div className="mt-20 relative mx-auto max-w-7xl min-h-[800px] md:min-h-[600px] perspective-1000">
          
          {/* Central Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full md:absolute md:left-1/2 md:-translate-x-1/2 md:top-0 md:w-[680px] z-20"
          >
            <div className="rounded-2xl border bg-card/80 backdrop-blur-xl shadow-2xl p-6 border-primary/20 ring-1 ring-primary/10">
              <div className="flex items-center gap-2 mb-6 border-b pb-4">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Visibility Score</h3>
                  <p className="text-xs text-muted-foreground">Real-time AI search analysis</p>
                </div>
                <div className="ml-auto text-xs font-mono bg-muted px-2 py-1 rounded">
                  Live Preview
                </div>
              </div>
              <ScoreDashboard 
                scores={{
                  aeoVisibilityScore: 78,
                  llmeoScore: 82,
                  seoScore: 90,
                  overallScore: 84
                }}
                confidence={0.92}
                className="[&_.grid]:gap-4" 
              />
            </div>
          </motion.div>

          {/* Competitor Analysis - Floating Left */}
          <motion.div
            initial={{ opacity: 0, x: -40, rotate: -2 }}
            animate={{ opacity: 1, x: 0, rotate: -2 }}
            whileHover={{ rotate: 0, scale: 1.02, zIndex: 40 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full mt-6 md:mt-0 md:absolute md:left-0 md:top-48 md:w-[420px] z-10"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <CompetitorLandscape 
                className="relative shadow-xl border-blue-500/20 bg-card/90 backdrop-blur-sm"
                competitors={[
                  { domain: "stripe.com", citationCount: 156, citationRate: 92, averageRank: 1.2 },
                  { domain: "paddle.com", citationCount: 124, citationRate: 88, averageRank: 1.5 },
                  { domain: "lemonsqueezy.com", citationCount: 89, citationRate: 81, averageRank: 2.1 }
                ]}
                yourDomain="your-saas.com"
                yourCitationRate={78}
                yourAverageRank={2.4}
              />
            </div>
          </motion.div>

          {/* Actionable Insights - Floating Right */}
          <motion.div
            initial={{ opacity: 0, x: 40, rotate: 2 }}
            animate={{ opacity: 1, x: 0, rotate: 2 }}
            whileHover={{ rotate: 0, scale: 1.02, zIndex: 40 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full mt-6 md:mt-0 md:absolute md:right-0 md:top-64 md:w-[440px] z-30"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <RecommendationsCard 
                className="relative shadow-xl border-amber-500/20 bg-card/90 backdrop-blur-sm"
                recommendations={[
                  {
                    id: "1",
                    priority: "high",
                    category: "content",
                    title: "Missing Pricing Comparison",
                    description: "AI agents look for structured pricing tables. Add a comparison matrix to capture 'vs' queries.",
                    impact: "High visibility gain",
                    effort: "low",
                    targetQueries: ["stripe vs paddle"]
                  }
                ]}
              />
              {/* Floating Badge attached to card */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border border-zinc-700"
              >
                <Bot className="size-3 text-green-400" />
                Cursor Prompt Ready
              </motion.div>
            </div>
          </motion.div>

          {/* Connecting Lines (Decorative) - Desktop Only */}
          <svg className="hidden md:block absolute inset-0 pointer-events-none z-0" style={{ overflow: 'visible' }}>
            {/* Line from Score to Competitors */}
            <motion.path
              d="M 500 100 Q 300 200 200 250"
              fill="transparent"
              stroke="url(#gradient-left)"
              strokeWidth="2"
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1, delay: 0.8 }}
            />
             {/* Line from Score to Recommendations */}
            <motion.path
              d="M 700 100 Q 900 250 1000 300"
              fill="transparent"
              stroke="url(#gradient-right)"
              strokeWidth="2"
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1, delay: 0.8 }}
            />
            <defs>
              <linearGradient id="gradient-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="gradient-right" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>

        </div>

      </div>
    </section>
  );
}
