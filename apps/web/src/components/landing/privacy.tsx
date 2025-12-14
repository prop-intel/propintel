"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PrivacyPolicy() {
    return (
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-4xl">
            <div className="mb-8">
                <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 size-4" />
                    Back to Home
                </Link>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
            <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                    <p className="text-lg text-muted-foreground">
                        BrandSight (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our SaaS application (the &quot;Service&quot;).
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li><strong>Personal Data:</strong> We may collect personally identifiable information, such as your name, email address, and payment information when you register for the Service.</li>
                        <li><strong>Usage Data:</strong> We automatically collect information about your interactions with the Service, including IP addresses, browser types, and access times.</li>
                        <li><strong>Analysis Data:</strong> When you use our tools to analyze websites, we process the URLs and related metrics you provide.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                    <p className="text-muted-foreground">We use the information we collect to:</p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                        <li>Provide, operate, and maintain our Service.</li>
                        <li>Improve, personalize, and expand our Service.</li>
                        <li>Understand and analyze how you use our Service.</li>
                        <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the Service, and for marketing and promotional purposes.</li>
                        <li>Process your transactions and manage your orders.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
                    <p className="text-muted-foreground">
                        We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">5. Contact Us</h2>
                    <p className="text-muted-foreground">
                        If you have questions or comments about this Privacy Policy, please contact us at: <br />
                        <a href="mailto:support@brand-sight.com" className="text-primary hover:underline">support@brand-sight.com</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
