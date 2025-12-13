"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion } from "motion/react";
import { Building2, CheckCircle2, Loader2, Send } from "lucide-react";

export function EnterpriseConsultation() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        company: "",
        companySize: "",
        strategy: "",
        message: "",
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

        console.log("Enterprise Consultation Requested:", formData);
        setIsLoading(false);
        setIsSuccess(true);
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 h-full min-h-[500px]">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-primary/10 rounded-full text-primary"
                >
                    <CheckCircle2 className="size-16" />
                </motion.div>
                <h3 className="text-3xl font-bold">Request Received</h3>
                <p className="text-muted-foreground max-w-md text-lg">
                    Thank you for your interest, {formData.name.split(' ')[0]}. <br />
                    Our enterprise team will review your requirements and reach out within 24 hours to schedule your consultation.
                </p>
                <Button onClick={() => setIsSuccess(false)} variant="outline" className="mt-4">
                    Return to Form
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-24 md:py-32">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
                {/* Left Text */}
                <div className="space-y-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Building2 className="size-4" />
                            <span>Enterprise Solutions</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                            Scale your <br />
                            AEO Strategy
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                            Get a private, deep-dive consultation on how your brand appears across the entire AI ecosystem.
                        </p>

                        <ul className="space-y-4">
                            {[
                                "Custom Agent Simulation Pipelines",
                                "Competitor Intelligence Reports",
                                "White-label API Access",
                                "Dedicated Success Manager",
                                "On-premise Deployment Options"
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-lg">
                                    <div className="p-1 bg-green-500/10 rounded-full text-green-600">
                                        <CheckCircle2 className="size-4" />
                                    </div>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>

                {/* Right Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card className="border-primary/20 shadow-2xl shadow-primary/5">
                        <CardHeader>
                            <CardTitle>Request Consultation</CardTitle>
                            <CardDescription>Tell us about your organization and needs.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="Jane Doe"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Work Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="jane@company.com"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="company">Company Name</Label>
                                        <Input
                                            id="company"
                                            placeholder="Acme Corp"
                                            required
                                            value={formData.company}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="size">Company Size</Label>
                                        <Select
                                            onValueChange={(val) => setFormData({ ...formData, companySize: val })}
                                        >
                                            <SelectTrigger id="size">
                                                <SelectValue placeholder="Select size" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1-10">1-10 employees</SelectItem>
                                                <SelectItem value="11-50">11-50 employees</SelectItem>
                                                <SelectItem value="51-200">51-200 employees</SelectItem>
                                                <SelectItem value="201-1000">201-1000 employees</SelectItem>
                                                <SelectItem value="1000+">1000+ employees</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="strategy">Current AEO Strategy</Label>
                                    <Select
                                        onValueChange={(val) => setFormData({ ...formData, strategy: val })}
                                    >
                                        <SelectTrigger id="strategy">
                                            <SelectValue placeholder="How are you currently handling AEO?" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">We are not tracking AI mentions yet</SelectItem>
                                            <SelectItem value="manual">Manual spot checks</SelectItem>
                                            <SelectItem value="seo">Traditional SEO agency</SelectItem>
                                            <SelectItem value="internal">Internal data science team</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message">Additional Requirements</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Tell us about your specific goals or challenges..."
                                        className="min-h-[100px]"
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center space-x-2 border p-4 rounded-lg bg-muted/30">
                                    <Checkbox
                                        id="captcha-enterprise"
                                        checked={formData.isNotRobot}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isNotRobot: checked as boolean })}
                                    />
                                    <Label
                                        htmlFor="captcha-enterprise"
                                        className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        I am human
                                    </Label>
                                </div>

                                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 size-4 animate-spin" />
                                            Submitting Request...
                                        </>
                                    ) : (
                                        <>
                                            Request Consultation
                                            <Send className="ml-2 size-4" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
