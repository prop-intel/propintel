"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Terminal } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

export function CTA() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-16 text-center max-w-5xl mx-auto relative overflow-hidden"
        >
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium mb-6 border border-white/20">
                <Terminal className="size-4" />
                <span>Ready for the new SEO?</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Start Ranking in SearchGPT</h2>
            <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                Get your first AEO report in minutes. See which queries you&apos;re winning, where you&apos;re losing, and get the code to fix it.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link href="/dashboard">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base w-full sm:w-auto">
                    Analyze My Site Free
                </Button>
                </Link>
                <Link href="mailto:contact@propintel.com">
                    <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto">
                    Contact Sales
                    <ArrowRight className="ml-2 size-4" />
                    </Button>
                </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
