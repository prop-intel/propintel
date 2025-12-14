"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function TermsOfService() {
    return (
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-4xl">
            <div className="mb-8">
                <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 size-4" />
                    Back to Home
                </Link>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Service</h1>
            <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
                    <p className="text-lg text-muted-foreground">
                        These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&quot;you&quot;) and BrandSight (&quot;we,&quot; &quot;us&quot; or &quot;our&quot;), concerning your access to and use of the BrandSight website and application.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">2. Intellectual Property Rights</h2>
                    <p className="text-muted-foreground">
                        Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the &quot;Content&quot;) and the trademarks, service marks, and logos contained therein (the &quot;Marks&quot;) are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">3. User Representations</h2>
                    <p className="text-muted-foreground">
                        By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms of Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">4. Prohibited Activities</h2>
                    <p className="text-muted-foreground">
                        You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">5. Limitation of Liability</h2>
                    <p className="text-muted-foreground">
                        In no event will we or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages, including lost profit, lost revenue, loss of data, or other damages arising from your use of the site, even if we have been advised of the possibility of such damages.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
                    <p className="text-muted-foreground">
                        To resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at: <br />
                        <a href="mailto:support@brand-sight.com" className="text-primary hover:underline">support@brand-sight.com</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
