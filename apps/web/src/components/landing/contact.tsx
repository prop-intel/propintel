"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";

export function ContactForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        website: "",
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

        console.log("Contact Form Submitted:", formData);
        setIsLoading(false);
        setIsSuccess(true);
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 h-full min-h-[400px]">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-green-500/10 rounded-full text-green-500"
                >
                    <CheckCircle2 className="size-12" />
                </motion.div>
                <h3 className="text-2xl font-bold">Message Sent!</h3>
                <p className="text-muted-foreground max-w-sm">
                    Thanks for reaching out, {formData.name.split(' ')[0]}. We&apos;ll get back to you shortly.
                </p>
                <Button onClick={() => setIsSuccess(false)} variant="outline">
                    Send Another Message
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        placeholder="John Doe"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="website">Website (Optional)</Label>
                <Input
                    id="website"
                    placeholder="https://example.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                    id="message"
                    placeholder="How can we help you?"
                    className="min-h-[120px]"
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
            </div>

            <div className="flex items-center space-x-2 border p-4 rounded-lg bg-muted/30">
                <Checkbox
                    id="captcha"
                    checked={formData.isNotRobot}
                    onCheckedChange={(checked) => setFormData({ ...formData, isNotRobot: checked as boolean })}
                />
                <Label
                    htmlFor="captcha"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                    I am human
                </Label>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Sending...
                    </>
                ) : (
                    <>
                        Send Message
                        <Send className="ml-2 size-4" />
                    </>
                )}
            </Button>
        </form>
    );
}

export function Contact() {
    return (
        <div className="container mx-auto px-4 py-24 md:py-32">
            <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                {/* Left Side: Info */}
                <div className="space-y-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">Get in touch</h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Have questions about AEO? Need a custom enterprise plan? We&apos;re here to help you navigate the new era of search.
                        </p>
                    </motion.div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg text-primary">
                                <Send className="size-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Email Support</h3>
                                <p className="text-muted-foreground">support@brandsight.ai</p>
                                <p className="text-sm text-muted-foreground mt-1">Response time: &lt; 24 hours</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Send us a message</CardTitle>
                            <CardDescription>Fill out the form below and we&apos;ll get back to you.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ContactForm />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
