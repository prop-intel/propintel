"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { Rocket, CheckCircle2, Loader2, Link as LinkIcon, Briefcase } from "lucide-react";

export function InterestForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        linkedin: "",
        interest: "",
        file: null as File | null,
        isNotRobot: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.isNotRobot) {
            alert("Please confirm you are not a robot.");
            return;
        }
        setIsLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log("Careers Interest Submitted:", {
            ...formData,
            fileName: formData.file?.name
        });
        setIsLoading(false);
        setIsSuccess(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFormData({ ...formData, file: e.target.files[0] });
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 h-full min-h-[400px]">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-purple-500/10 rounded-full text-purple-500"
                >
                    <Rocket className="size-12" />
                </motion.div>
                <h3 className="text-2xl font-bold">Application Received!</h3>
                <p className="text-muted-foreground max-w-sm">
                    Thanks for throwing your hat in the ring, {formData.name.split(' ')[0]}. We review every application personally.
                </p>
                <Button onClick={() => setIsSuccess(false)} variant="outline">
                    Submit Another
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                    id="name"
                    placeholder="Jane Smith"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <Input
                        id="linkedin"
                        placeholder="https://linkedin.com/in/..."
                        className="pl-9"
                        value={formData.linkedin}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="resume">Resume (PDF)</Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="resume"
                        type="file"
                        accept=".pdf"
                        className="cursor-pointer file:cursor-pointer"
                        onChange={handleFileChange}
                    />
                </div>
                {formData.file && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        {formData.file.name} attached
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="interest">Why BrandSight?</Label>
                <Textarea
                    id="interest"
                    placeholder="Tell us what excites you about the shift from SEO to AEO..."
                    className="min-h-[100px]"
                    required
                    value={formData.interest}
                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                />
            </div>

            <div className="flex items-center space-x-2 border p-4 rounded-lg bg-muted/30">
                <Checkbox
                    id="captcha-careers"
                    checked={formData.isNotRobot}
                    onCheckedChange={(checked) => setFormData({ ...formData, isNotRobot: checked as boolean })}
                />
                <Label
                    htmlFor="captcha-careers"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                    I am human
                </Label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Submitting...
                    </>
                ) : (
                    <>
                        Submit Application
                        <Rocket className="ml-2 size-4" />
                    </>
                )}
            </Button>
        </form>
    );
}

export function Careers() {
    return (
        <div className="container mx-auto px-4 py-24 md:py-32">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
                {/* Left Side: Manifesto */}
                <div className="space-y-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm font-medium mb-6">
                            <Briefcase className="size-4" />
                            <span>We Need You</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                            Build the <br className="hidden lg:block" /> Operating System <br className="hidden lg:block" /> for the AI Web
                        </h1>
                        <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                            <p>
                                The internet is undergoing its biggest improved alignment since the search engine.
                                We are moving from a web of 10 blue links to a web of single, synthesized answers.
                            </p>
                            <p>
                                BrandSight is at the forefront of this shift. We are building the tools that bring
                                clarity to how AI agents perceive your content—giving brands clear visibility in an opaque landscape.
                            </p>
                            <p className="text-foreground font-medium">
                                We don&apos;t have traditional job listings because we don&apos;t want traditional employees.
                                We want builders, hackers, and visionaries who are obsessed with LLMs, agents, and the future of search.
                            </p>
                        </div>
                    </motion.div>

                    {/* Values */}
                    <div className="grid sm:grid-cols-2 gap-6 pt-4">
                        {[
                            { title: "Ship Fast", desc: "We deploy daily. Perfect is the enemy of done." },
                            { title: "Think Big", desc: "We are defining a new category (AEO)." },
                            { title: "Agent Native", desc: "We use AI to build AI. It's turtles all the way down." },
                            { title: "Transparency", desc: "Open salaries, open roadmap, open minds." }
                        ].map((val, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + (i * 0.1) }}
                                className="bg-card border rounded-lg p-4"
                            >
                                <h3 className="font-semibold mb-1">{val.title}</h3>
                                <p className="text-sm text-muted-foreground">{val.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Form */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="lg:sticky lg:top-32"
                >
                    <Card className="border-2 border-purple-500/20 shadow-2xl shadow-purple-500/10">
                        <CardHeader>
                            <CardTitle>Join the Mission</CardTitle>
                            <CardDescription>Pitch us using the form below. Links or PDFs accepted.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <InterestForm />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
