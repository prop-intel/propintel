"use client";

import { motion } from "motion/react";
import {
    Search,
    Bot,
    Globe,
    BarChart,
    Scale,
    Terminal,
    Code,
    ArrowRight,
} from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const phases = [
    {
        id: "discovery",
        badge: "Phase 1: Discovery",
        title: "The DNA Check",
        description: "We analyze your content's structure to understand it exactly as an LLM would.",
        icon: Search,
        color: "blue",
        details: [
            { label: "Agent", value: "Page Analysis & Query Gen" },
            { label: "Action", value: "Extracts entities & user intent" },
            { label: "Outcome", value: "15+ Target Queries Identified" },
        ],
        visual: (
            <div className="bg-card border rounded-lg p-4 font-mono text-xs space-y-2 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground border-b pb-2 mb-2">
                    <Terminal className="size-3" />
                    <span>analysis_log.txt</span>
                </div>
                <div className="text-green-600">✔ URL Accessed: 200 OK</div>
                <div>
                    <span className="text-blue-500">➜ Analyzing Entities:</span>
                    <span className="text-muted-foreground ml-2">[SaaS, Payment, API]</span>
                </div>
                <div>
                    <span className="text-purple-500">➜ Intent Detected:</span>
                    <span className="text-muted-foreground ml-2">&quot;Commercial / Comparison&quot;</span>
                </div>
                <div className="animate-pulse flex items-center gap-1 mt-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="text-muted-foreground">Generating queries...</span>
                </div>
            </div>
        ),
    },
    {
        id: "research",
        badge: "Phase 2: Research",
        title: "The Simulation",
        description: "We don't guess. We deploy agents to act like real users searching across the web.",
        icon: Globe,
        color: "purple",
        details: [
            { label: "Agents", value: "Tavily, Google AIO, Perplexity" },
            { label: "Action", value: "Live simulation of searches" },
            { label: "Outcome", value: "Real-time citation data" },
        ],
        visual: (
            <div className="relative h-40 bg-zinc-900/5 dark:bg-zinc-900/50 rounded-lg overflow-hidden border">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
                        <Bot className="size-12 text-purple-500 relative z-10" />
                    </div>
                </div>
                {/* Orbiting items */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute top-1/2 left-1/2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3 + i, repeat: Infinity, ease: "linear" }}
                        style={{ width: 120 + i * 40, height: 120 + i * 40, x: "-50%", y: "-50%" }}
                    >
                        <div className="relative w-full h-full rounded-full border border-dashed border-muted-foreground/20">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-1 rounded-full border shadow-sm">
                                {i === 0 ? <div className="text-[8px] font-bold px-1">G</div> : i === 1 ? <div className="text-[8px] font-bold px-1">P</div> : <Search className="size-3" />}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        ),
    },
    {
        id: "analysis",
        badge: "Phase 3: Analysis",
        title: "The Scoring",
        description: "We compare your content against top performers to identify your next steps forward.",
        icon: BarChart,
        color: "amber",
        details: [
            { label: "Agent", value: "Content Comparison" },
            { label: "Action", value: "Gap Analysis vs Competitors" },
            { label: "Outcome", value: "AEO Visibility Score (0-100)" },
        ],
        visual: (
            <div className="flex gap-4 items-end justify-center h-40 px-4 pb-4 bg-muted/20 rounded-lg border">
                <div className="w-1/3 flex flex-col items-center gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Competitor</div>
                    <div className="w-full bg-green-500/20 h-24 rounded-t-lg relative group">
                        <div className="absolute bottom-0 w-full bg-green-500 h-[85%] rounded-t-lg transition-all group-hover:h-[90%]" />
                    </div>
                    <div className="font-bold text-sm">85/100</div>
                </div>
                <div className="w-1/3 flex flex-col items-center gap-2">
                    <div className="text-xs font-medium text-muted-foreground">You</div>
                    <div className="w-full bg-amber-500/20 h-16 rounded-t-lg relative group">
                        <div className="absolute bottom-0 w-full bg-amber-500 h-[45%] rounded-t-lg transition-all group-hover:h-[50%]" />
                        {/* Gap Indicator */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-amber-600 font-bold animate-bounce hidden group-hover:block">
                            OPPORTUNITY
                        </div>
                    </div>
                    <div className="font-bold text-sm">45/100</div>
                </div>
            </div>
        ),
    },
    {
        id: "action",
        badge: "Phase 4: Action",
        title: "The Fix",
        description: "Insights are useless without action. We provide the roadmap for your next optimization step.",
        icon: Code,
        color: "green",
        details: [
            { label: "Agent", value: "Recommendation Engine" },
            { label: "Action", value: "Generates Cursor Prompts" },
            { label: "Outcome", value: "Copy-Paste Optimization" },
        ],
        visual: (
            <div className="bg-zinc-950 rounded-lg p-3 font-mono text-xs text-zinc-300 shadow-xl border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-500">cursor_prompt.md</span>
                    <Button size="icon" variant="ghost" className="h-4 w-4 text-zinc-500 hover:text-white">
                        <Code className="size-3" />
                    </Button>
                </div>
                <div className="space-y-1 opacity-70">
                    <div><span className="text-purple-400">### Task:</span> Add Schema Markup</div>
                    <div className="pl-2 border-l border-zinc-800 text-zinc-500">
                        &lt;script type=&quot;application/ld+json&quot;&gt;<br />
                        &#123;<br />
                        &nbsp;&nbsp;&quot;@context&quot;: &quot;https://schema.org&quot;,<br />
                        &nbsp;&nbsp;&quot;@type&quot;: &quot;FAQPage&quot;...<br />
                        &#125;
                    </div>
                </div>
            </div>
        ),
    },
];

const faqs = [
    {
        question: "How is this different from traditional SEO?",
        answer: "SEO focuses on link positions on a page. AEO (Answer Engine Optimization) is about becoming the direct answer cited by AI. The metrics, strategies, and optimization journey are completely different.",
    },
    {
        question: "Do you support SearchGPT and Perplexity?",
        answer: "Yes. Our agents simulate searches on Perplexity, SearchGPT, and Google's AI Overviews to give you a complete picture of your AI visibility.",
    },
    {
        question: "How long does an analysis take?",
        answer: "A Fast Mode analysis typically takes 2-3 minutes. A Deep Mode analysis, which crawls more pages and performs broader research, can take 5-10 minutes.",
    },
    {
        question: "Can I use the output with my existing team?",
        answer: "Absolutely. Our 'Cursor Prompts' are designed to be handed directly to developers, and the PDF reports are perfect for sharing with marketing stakeholders.",
    },
];

export function HowItWorks() {
    return (
        <div className="pb-20">
            {/* Header */}
            <section className="pt-24 pb-12 bg-muted/30 border-b">
                <div className="container px-4 mx-auto text-center max-w-4xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background mb-6">
                        <Scale className="size-4 text-primary" />
                        <span className="text-sm font-medium">From Black Box to Open Book</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                        See the world through an <span className="text-primary">AI&apos;s eyes</span>
                    </h1>
                    <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                        Traditional SEO tools are blind to the new web. BrandSight simulates the AI browsing experience
                        to show you exactly where you stand—and how to move forward.
                    </p>
                </div>
            </section>

            {/* 4 Steps */}
            <section className="py-20 container px-4 mx-auto">
                <div className="space-y-20 md:space-y-32 max-w-5xl mx-auto">
                    {phases.map((phase, index) => (
                        <motion.div
                            key={phase.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.5 }}
                            className={cn(
                                "flex flex-col gap-8 md:items-center",
                                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                            )}
                        >
                            {/* Text Side */}
                            <div className="flex-1 space-y-6">
                                <div className={cn(
                                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                                    `bg-${phase.color}-500/10 text-${phase.color}-600 dark:text-${phase.color}-400`
                                )}>
                                    {phase.badge}
                                </div>
                                <h2 className="text-3xl font-bold">{phase.title}</h2>
                                <p className="text-lg text-muted-foreground">{phase.description}</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                    {phase.details.map((detail, i) => (
                                        <div key={i} className="border rounded-lg p-3 bg-card/50">
                                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{detail.label}</div>
                                            <div className="font-medium">{detail.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Visual Side */}
                            <div className="flex-1 relative">
                                {/* Visual Connector Line */}
                                {index !== phases.length - 1 && (
                                    <div className={cn(
                                        "absolute -bottom-20 md:-bottom-32 left-1/2 -translate-x-1/2 w-px h-20 md:h-32 bg-gradient-to-b from-border to-transparent hidden md:block",
                                        // Flip for alternating layout
                                        index % 2 === 0 ? "left-1/2" : "left-1/2"
                                    )} />
                                )}

                                <div className="bg-background rounded-xl border shadow-lg p-6 relative overflow-hidden group hover:shadow-xl transition-shadow">
                                    <div className={cn(
                                        "absolute top-0 left-0 w-full h-1",
                                        `bg-${phase.color}-500`
                                    )} />
                                    {phase.visual}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* See It In Action - Demo Video & Screenshots */}
            <section className="py-20">
                <div className="container px-4 mx-auto max-w-5xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">See It In Action</h2>
                        <p className="text-muted-foreground text-lg">Watch how BrandSight analyzes and optimizes your content for AI visibility.</p>
                    </div>

                    {/* Demo Video */}
                    <div className="mb-16">
                        <div className="rounded-xl overflow-hidden shadow-2xl border bg-black">
                            <video
                                src="/how-it-works/User__Experience.mp4"
                                autoPlay
                                muted
                                loop
                                playsInline
                                controls
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Track Your Progress */}
                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold mb-2">Track Your Progress</h3>
                        <p className="text-muted-foreground">Monitor the increase in AI bot traffic as you implement our recommendations.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="rounded-xl overflow-hidden shadow-lg border bg-card">
                            <Image
                                src="/how-it-works/Tracking.png"
                                alt="Track bot traffic changes over time"
                                width={800}
                                height={600}
                                className="w-full h-auto"
                            />
                        </div>
                        <div className="rounded-xl overflow-hidden shadow-lg border bg-card">
                            <Image
                                src="/how-it-works/Trends.png"
                                alt="View traffic trends and growth patterns"
                                width={800}
                                height={600}
                                className="w-full h-auto"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Comparison & FAQ */}
            <section className="py-20 bg-muted/30 border-y">
                <div className="container px-4 mx-auto max-w-3xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
                        <p className="text-muted-foreground">Common questions about the AEO process.</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full bg-background rounded-xl border shadow-sm px-6">
                        {faqs.map((faq, i) => (
                            <AccordionItem key={i} value={`item-${i}`} className={i === faqs.length - 1 ? 'border-b-0' : ''}>
                                <AccordionTrigger className="text-left font-medium">{faq.question}</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground text-base">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 container px-4 mx-auto text-center">
                <h2 className="text-3xl font-bold mb-6">Ready to begin your optimization journey?</h2>
                <Link href="/dashboard">
                    <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20">
                        Start a Free Analysis
                        <ArrowRight className="ml-2 size-5" />
                    </Button>
                </Link>
            </section>
        </div>
    );
}
