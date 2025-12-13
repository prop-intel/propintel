"use client";

import Link from "next/link";
import { ArrowLeft, Book, Code, Terminal, Zap, Shield, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ApiDocs() {
    return (
        <div className="container mx-auto px-4 py-24 md:py-32">
            <div className="mb-8">
                <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 size-4" />
                    Back to Home
                </Link>
            </div>

            <div className="max-w-4xl mx-auto">
                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6">
                        <Terminal className="size-4" />
                        <span>Developer Platform</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">PropIntel API</h1>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        Integrate our AEO simulation engine directly into your workflows.
                        Build custom dashboards, automate rankings checks, and white-label our data.
                    </p>
                    <div className="mt-8 flex gap-4">
                        <Button size="lg" disabled>
                            Get API Keys (Coming Soon)
                        </Button>
                        <Link href="/contact">
                            <Button variant="outline" size="lg">Contact Sales</Button>
                        </Link>
                    </div>
                </header>

                <section className="space-y-12">
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: Zap, title: "High-Performance", desc: "Built on serverless edge tech for low-latency analysis." },
                            { icon: Shield, title: "Enterprise Grade", desc: "SOC2 compliant ready architecture with granular scopes." },
                            { icon: Key, title: "Simple Auth", desc: "Standard Bearer token authentication for all endpoints." }
                        ].map((item, i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <item.icon className="size-8 mb-2 text-primary" />
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold">How it Works</h2>
                        <Tabs defaultValue="rest" className="w-full">
                            <TabsList>
                                <TabsTrigger value="rest">REST API</TabsTrigger>
                                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                            </TabsList>
                            <TabsContent value="rest" className="mt-4">
                                <Card className="bg-muted/30">
                                    <CardContent className="pt-6">
                                        <h3 className="text-lg font-semibold mb-2">Analyze URL</h3>
                                        <p className="text-muted-foreground mb-4">Start an analysis job for a specific URL.</p>
                                        <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                                            <span className="text-green-400">POST</span> https://api.propintel.ai/v1/analyze <br />
                                            Authorization: Bearer sk_live_... <br />
                                            <br />
                                            {`{
  "url": "https://example.com/pricing",
  "strategies": ["google_aio", "perplexity"],
  "depth": "deep"
}`}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="webhooks" className="mt-4">
                                <Card className="bg-muted/30">
                                    <CardContent className="pt-6">
                                        <h3 className="text-lg font-semibold mb-2">Analysis Completed</h3>
                                        <p className="text-muted-foreground mb-4">Receive a payload when jobs finish.</p>
                                        <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                                            <span className="text-purple-400">POST</span> https://your-app.com/webhooks/propintel <br />
                                            <br />
                                            {`{
  "event": "job.completed",
  "data": {
    "jobId": "job_12345",
    "status": "success",
    "score": 85,
    "recommendations_count": 3
  }
}`}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </section>
            </div>
        </div>
    );
}
