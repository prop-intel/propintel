"use client";

import { motion } from "motion/react";
import {
    FileText,
    Search,
    Users,
    Sparkles,
    BarChart3,
    Lightbulb,
    Code2,
    ArrowRight,
    CheckCircle2,
    Bot,
    Activity,
    Eye,
    Zap,
    Copy,
    MessageSquare,
} from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScoreDashboard } from "@/components/analysis/score-dashboard";
import { CompetitorLandscape } from "@/components/analysis/competitor-landscape";

// The actual agent pipeline phases from the app
const pipelinePhases = [
    {
        id: "discovery",
        name: "Discovery",
        color: "blue",
        colorClass: "text-blue-500",
        bgClass: "bg-blue-500/10",
        borderClass: "border-blue-500/30",
        agents: [
            {
                id: "page-analysis",
                name: "Page Analysis",
                icon: FileText,
                description: "Scans your content structure, extracts entities, and understands how LLMs will interpret your page.",
            },
            {
                id: "query-generation",
                name: "Query Generation",
                icon: Search,
                description: "Identifies 15+ target search queries that real users ask when looking for content like yours.",
            },
            {
                id: "competitor-discovery",
                name: "Competitor Discovery",
                icon: Users,
                description: "Finds which domains currently dominate AI search results for your target queries.",
            },
        ],
    },
    {
        id: "research",
        name: "Research",
        color: "purple",
        colorClass: "text-purple-500",
        bgClass: "bg-purple-500/10",
        borderClass: "border-purple-500/30",
        parallel: true,
        agents: [
            {
                id: "tavily-research",
                name: "AI Search Research",
                icon: Sparkles,
                description: "Simulates searches across Perplexity, SearchGPT, and Google AI Overviews to see who gets cited.",
            },
            {
                id: "community-signals",
                name: "Community Signals",
                icon: MessageSquare,
                description: "Scans Reddit, forums, and discussion platforms for engagement opportunities.",
            },
        ],
    },
    {
        id: "analysis",
        name: "Analysis",
        color: "amber",
        colorClass: "text-amber-500",
        bgClass: "bg-amber-500/10",
        borderClass: "border-amber-500/30",
        parallel: true,
        agents: [
            {
                id: "citation-analysis",
                name: "Citation Analysis",
                icon: BarChart3,
                description: "Maps where you appear (or don't) across all tested queries with position tracking.",
            },
            {
                id: "content-comparison",
                name: "Content Comparison",
                icon: FileText,
                description: "Analyzes why competitors rank higher and identifies your content gaps.",
            },
        ],
    },
    {
        id: "scoring",
        name: "Scoring",
        color: "emerald",
        colorClass: "text-emerald-500",
        bgClass: "bg-emerald-500/10",
        borderClass: "border-emerald-500/30",
        agents: [
            {
                id: "visibility-scoring",
                name: "Visibility Scoring",
                icon: Eye,
                description: "Calculates your AEO Visibility Score, LLMEO readiness, and weighted overall score.",
            },
        ],
    },
    {
        id: "output",
        name: "Output",
        color: "cyan",
        colorClass: "text-cyan-500",
        bgClass: "bg-cyan-500/10",
        borderClass: "border-cyan-500/30",
        agents: [
            {
                id: "recommendations",
                name: "Recommendations",
                icon: Lightbulb,
                description: "Generates prioritized actions with effort estimates and expected impact.",
            },
            {
                id: "cursor-prompt",
                name: "Cursor Prompt",
                icon: Code2,
                description: "Creates ready-to-paste prompts for Cursor IDE to implement improvements instantly.",
            },
        ],
    },
];

const faqs = [
    {
        question: "How is this different from traditional SEO?",
        answer: "SEO focuses on ranking in link-based search results. AEO (Answer Engine Optimization) is about becoming the source that AI systems cite in their answers. The signals that matter—content clarity, entity coverage, structured data—are fundamentally different.",
    },
    {
        question: "Which AI search engines do you analyze?",
        answer: "Our agents simulate searches across Perplexity AI, SearchGPT (ChatGPT with search), Google AI Overviews, and other emerging answer engines. We track where you appear as a cited source in each.",
    },
    {
        question: "How long does a full analysis take?",
        answer: "A complete analysis runs through all 5 phases with 10 AI agents working in sequence and parallel. Typical analysis time is 3-5 minutes, depending on the depth of research required.",
    },
    {
        question: "What's a Cursor Prompt?",
        answer: "It's a ready-to-use prompt you paste into Cursor IDE (or any AI coding assistant). It contains structured instructions to implement the exact schema markup, content changes, and technical fixes we recommend.",
    },
    {
        question: "Can I track my progress over time?",
        answer: "Yes! The Monitor dashboard tracks AI crawler visits to your site in real-time. You'll see which bots (GPTBot, ClaudeBot, etc.) are indexing your content and how traffic changes as you implement recommendations.",
    },
];

function PipelineVisualization() {
    return (
        <div className="relative">
            {/* Connection line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500 via-purple-500 via-amber-500 via-emerald-500 to-cyan-500 hidden md:block" />
            
            <div className="space-y-8">
                {pipelinePhases.map((phase, phaseIndex) => (
                    <motion.div
                        key={phase.id}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: phaseIndex * 0.1 }}
                        className="relative"
                    >
                        {/* Phase header */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className={cn(
                                "relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 bg-background shadow-lg",
                                phase.borderClass
                            )}>
                                <span className={cn("text-2xl font-bold", phase.colorClass)}>
                                    {phaseIndex + 1}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className={cn("text-xl font-bold", phase.colorClass)}>
                                        {phase.name}
                                    </h3>
                                    {phase.parallel && (
                                        <Badge variant="outline" className="text-xs">
                                            <Zap className="h-3 w-3 mr-1" />
                                            Parallel
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {phase.agents.length} agent{phase.agents.length > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        {/* Agents grid */}
                        <div className={cn(
                            "ml-0 md:ml-20 grid gap-3",
                            phase.agents.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1 max-w-xl"
                        )}>
                            {phase.agents.map((agent, agentIndex) => (
                                <motion.div
                                    key={agent.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: phaseIndex * 0.1 + agentIndex * 0.05 }}
                                    className={cn(
                                        "group p-4 rounded-xl border bg-card/50 backdrop-blur-sm transition-all hover:shadow-md hover:bg-card",
                                        phase.borderClass
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                                            phase.bgClass
                                        )}>
                                            <agent.icon className={cn("h-5 w-5", phase.colorClass)} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-sm">{agent.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                {agent.description}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function ScorePreview() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border bg-card p-6 shadow-xl"
        >
            <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <h4 className="font-semibold">Your Visibility Score</h4>
                    <p className="text-xs text-muted-foreground">Multi-dimensional analysis</p>
                </div>
            </div>
            <ScoreDashboard
                scores={{
                    aeoVisibilityScore: 67,
                    llmeoScore: 72,
                    seoScore: 85,
                    overallScore: 73,
                }}
                confidence={0.88}
            />
        </motion.div>
    );
}

function CompetitorPreview() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
        >
            <CompetitorLandscape
                competitors={[
                    { domain: "competitor-a.com", citationCount: 142, citationRate: 89, averageRank: 1.3 },
                    { domain: "competitor-b.com", citationCount: 98, citationRate: 76, averageRank: 1.8 },
                    { domain: "competitor-c.com", citationCount: 67, citationRate: 58, averageRank: 2.4 },
                ]}
                yourDomain="your-site.com"
                yourCitationRate={42}
                yourAverageRank={3.1}
                className="shadow-xl"
            />
        </motion.div>
    );
}

function RecommendationPreview() {
    const recommendations = [
        {
            priority: "high" as const,
            title: "Add FAQ Schema Markup",
            description: "Your top competitors use structured FAQ data that AI systems cite directly.",
            effort: "Quick Win",
            impact: "+15-20% citation rate",
        },
        {
            priority: "medium" as const,
            title: "Create Comparison Content",
            description: "You're missing for 'vs' queries that competitors dominate.",
            effort: "Medium",
            impact: "Capture comparison traffic",
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border bg-card p-6 shadow-xl"
        >
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                        <h4 className="font-semibold">Recommendations</h4>
                        <p className="text-xs text-muted-foreground">Prioritized by impact</p>
                    </div>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <Zap className="h-3 w-3 mr-1" />
                    2 Quick Wins
                </Badge>
            </div>
            <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "p-3 rounded-lg border",
                            rec.priority === "high" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold",
                                rec.priority === "high" ? "bg-red-500" : "bg-amber-500"
                            )}>
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{rec.title}</span>
                                    <Badge variant="secondary" className="text-xs">{rec.effort}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{rec.description}</p>
                                <p className="text-xs text-emerald-600 mt-1 font-medium">{rec.impact}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

function CursorPromptPreview() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border bg-zinc-950 p-6 shadow-xl"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Code2 className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">Cursor Prompt</h4>
                        <p className="text-xs text-zinc-400">Ready to implement</p>
                    </div>
                </div>
                <Button size="sm" variant="secondary" className="gap-2">
                    <Copy className="h-3 w-3" />
                    Copy
                </Button>
            </div>
            <div className="font-mono text-xs text-zinc-300 bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                <div className="text-cyan-400 mb-2">### Task: Add FAQ Schema</div>
                <div className="text-zinc-500 mb-2">Target: /pages/pricing.tsx</div>
                <div className="text-zinc-400">
                    <span className="text-purple-400">Add structured data</span> with FAQPage schema for the 5 most common questions identified in our analysis...
                </div>
                <div className="mt-3 text-emerald-400">
                    ✓ Schema validated against Google requirements
                </div>
            </div>
        </motion.div>
    );
}

function MonitorPreview() {
    const crawlerData = [
        { name: "GPTBot", company: "OpenAI", visits: 1247, trend: "+23%" },
        { name: "ClaudeBot", company: "Anthropic", visits: 892, trend: "+18%" },
        { name: "PerplexityBot", company: "Perplexity", visits: 456, trend: "+45%" },
        { name: "GoogleOther", company: "Google", visits: 2103, trend: "+12%" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border bg-card p-6 shadow-xl"
        >
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                        <h4 className="font-semibold">Live Crawler Monitor</h4>
                        <p className="text-xs text-muted-foreground">Real-time bot tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-medium text-emerald-500">Live</span>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">4.7K</div>
                    <div className="text-xs text-muted-foreground">Total Visits</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">12</div>
                    <div className="text-xs text-muted-foreground">AI Crawlers</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">847</div>
                    <div className="text-xs text-muted-foreground">Today</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                    <div className="text-2xl font-bold text-emerald-600">+24%</div>
                    <div className="text-xs text-muted-foreground">This Week</div>
                </div>
            </div>

            {/* Crawler list */}
            <div className="space-y-2">
                {crawlerData.map((crawler, idx) => (
                    <motion.div
                        key={crawler.name}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="font-medium text-sm">{crawler.name}</div>
                                <div className="text-xs text-muted-foreground">{crawler.company}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-sm">{crawler.visits.toLocaleString()}</div>
                            <div className="text-xs text-emerald-500">{crawler.trend}</div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

export function HowItWorks() {
    return (
        <div className="pb-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/50 via-background to-background">
            {/* Header */}
            <section className="pt-24 pb-16">
                <div className="container px-4 mx-auto text-center max-w-4xl">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
                    >
                        How Brandsight <span className="text-primary">Analyzes</span> Your AI Visibility
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
                    >
                        Our AI agent pipeline simulates real searches, analyzes your competition, and delivers actionable recommendations you can implement today.
                    </motion.p>
                </div>
            </section>

            {/* Pipeline Section */}
            <section className="py-16 container px-4 mx-auto">
                <div className="max-w-4xl mx-auto mb-12 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">The Analysis Pipeline</h2>
                    <p className="text-muted-foreground">
                        Each analysis runs through 5 phases with specialized AI agents working together to understand your position in the AI search landscape.
                    </p>
                </div>
                <div className="max-w-4xl mx-auto">
                    <PipelineVisualization />
                </div>
            </section>

            {/* What You Get Section */}
            <section className="py-16 bg-muted/30 border-y">
                <div className="container px-4 mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">What You&apos;ll See</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Clear metrics, competitive intelligence, and step-by-step guidance to improve your AI search visibility.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        {/* Score Dashboard */}
                        <ScorePreview />

                        {/* Recommendations */}
                        <RecommendationPreview />

                        {/* Competitor Landscape */}
                        <div className="lg:col-span-1">
                            <CompetitorPreview />
                        </div>

                        {/* Cursor Prompt */}
                        <CursorPromptPreview />
                    </div>
                </div>
            </section>

            {/* Monitor Section */}
            <section className="py-16 container px-4 mx-auto">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <Badge variant="outline" className="mb-4">
                                <Activity className="h-3 w-3 mr-1" />
                                Real-time Tracking
                            </Badge>
                            <h2 className="text-2xl md:text-3xl font-bold mb-4">
                                Track AI Crawler Activity
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                After implementing recommendations, watch your AI visibility grow. Our monitoring dashboard tracks visits from GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers in real-time.
                            </p>
                            <ul className="space-y-3">
                                {[
                                    "See which AI bots are indexing your content",
                                    "Track traffic trends over time",
                                    "Identify your most crawled pages",
                                    "Measure impact of your optimizations",
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <MonitorPreview />
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-16 bg-muted/30 border-y">
                <div className="container px-4 mx-auto max-w-3xl">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold mb-4">Common Questions</h2>
                        <p className="text-muted-foreground">Everything you need to know about the analysis process.</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full bg-background rounded-xl border shadow-sm">
                        {faqs.map((faq, i) => (
                            <AccordionItem key={i} value={`item-${i}`} className={cn("px-6", i === faqs.length - 1 ? 'border-b-0' : '')}>
                                <AccordionTrigger className="text-left font-medium hover:no-underline">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 container px-4 mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-2xl mx-auto"
                >
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">
                        Ready to see how AI search engines view your content?
                    </h2>
                    <p className="text-muted-foreground mb-8">
                        Run your first analysis in minutes. No credit card required.
                    </p>
                    <Link href="/dashboard">
                        <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20 gap-2">
                            Start Free Analysis
                            <ArrowRight className="size-5" />
                        </Button>
                    </Link>
                </motion.div>
            </section>
        </div>
    );
}
