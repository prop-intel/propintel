"use client";

import { motion } from "motion/react";
import { Search, Sparkles, Layers, MousePointerClick as Click, Trophy, ShieldCheck, FileText, BrainCircuit, Target, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchVsAI() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />

      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border text-xs font-medium text-muted-foreground mb-6"
          >
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            The Evolution of Discovery
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
          >
            From <span className="text-muted-foreground line-through decoration-muted-foreground/50 decoration-2">SEO</span> to <span className="text-primary">AEO</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground leading-relaxed"
          >
            Search Engine Optimization got you clicked. <br className="hidden md:block" />
            Answer Engine Optimization gets you cited.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto relative">
          
          {/* VS Badge (Desktop) */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-background border rounded-full p-2 shadow-xl">
            <span className="font-bold text-muted-foreground px-2">VS</span>
          </div>

          {/* SEO CARD (OLD WORLD) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="group relative rounded-3xl border bg-card/50 p-2 shadow-sm transition-all hover:shadow-md"
          >
            <div className="h-full bg-muted/10 rounded-[20px] p-8 md:p-10 border border-border/50 backdrop-blur-sm flex flex-col">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-1 text-muted-foreground">Traditional SEO</h3>
                  <p className="text-sm text-muted-foreground/80">Search Engine Optimization</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center">
                  <Search className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              {/* Visual Metaphor: The List */}
              <div className="bg-background rounded-xl border border-border/50 shadow-sm p-5 mb-8 select-none pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col gap-3">
                  <div className="h-2 w-1/3 bg-blue-500/20 rounded-full" />
                  <div className="h-3 w-full bg-muted rounded-md" />
                  <div className="h-3 w-5/6 bg-muted rounded-md mb-2" />
                  
                  <div className="h-px w-full bg-border my-1" />
                  
                  <div className="h-2 w-1/4 bg-blue-500/20 rounded-full" />
                  <div className="h-3 w-11/12 bg-muted rounded-md" />
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                <ComparisonPoint 
                  icon={FileText} 
                  label="Focus" 
                  value="Keywords & Pages" 
                  description="Creating content to match search terms."
                  negative 
                />
                <ComparisonPoint 
                  icon={Click} 
                  label="Goal" 
                  value="Clicks & Traffic" 
                  description="Fighting for the click in a list of 10."
                  negative 
                />
                <ComparisonPoint 
                  icon={Layers} 
                  label="Strategy" 
                  value="Backlinks & Volume" 
                  description="More pages, more links, more noise."
                  negative 
                />
              </div>
            </div>
          </motion.div>

          {/* AEO CARD (NEW WORLD) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="group relative rounded-3xl p-[1px] shadow-2xl shadow-primary/10"
          >
            {/* Animated Gradient Border */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-500 to-blue-500 rounded-3xl opacity-20 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute inset-[1px] bg-card rounded-[23px] z-0" />
            
            <div className="relative z-10 h-full rounded-[23px] p-8 md:p-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent flex flex-col">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-1 text-primary">Modern AEO</h3>
                  <p className="text-sm text-muted-foreground">Answer Engine Optimization</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
              </div>

              {/* Visual Metaphor: The Answer */}
              <div className="bg-background/80 backdrop-blur-md rounded-xl border border-primary/20 shadow-lg shadow-primary/5 p-5 mb-8 relative">
                 <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                      <BrainCircuit className="w-4 h-4 text-white" />
                    </div>
                    <div className="space-y-2 w-full">
                      <div className="h-16 w-full bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground leading-relaxed">
                        <span className="text-foreground font-medium">Here&apos;s the answer:</span> Based on reliability and user trust, <span className="text-primary font-semibold bg-primary/10 px-1 rounded">Your Brand</span> is the top recommendation...
                      </div>
                    </div>
                  </div>
              </div>

              <div className="space-y-3 mt-auto">
                <ComparisonPoint 
                  icon={Target} 
                  label="Focus" 
                  value="Entities & Context" 
                  description="Helping AI understand who you are."
                />
                <ComparisonPoint 
                  icon={Trophy} 
                  label="Goal" 
                  value="Citations & Trust" 
                  description="Being the single source of truth."
                />
                <ComparisonPoint 
                  icon={ShieldCheck} 
                  label="Strategy" 
                  value="Content Clarity" 
                  description="Structured data and expert knowledge."
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ComparisonPoint({ 
  icon: Icon, 
  label, 
  value, 
  description,
  negative = false 
}: { 
  icon: LucideIcon, 
  label: string, 
  value: string, 
  description: string,
  negative?: boolean 
}) {
  return (
    <div className={cn(
      "flex items-start gap-4 p-4 rounded-xl transition-all duration-300",
      negative 
        ? "bg-muted/30 hover:bg-muted/50" 
        : "bg-primary/5 border border-primary/10 hover:bg-primary/10"
    )}>
      <div className={cn(
        "p-2 rounded-lg shrink-0",
        negative ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</span>
        </div>
        <div className={cn("font-semibold mb-0.5", negative ? "text-muted-foreground" : "text-foreground")}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground leading-snug">
          {description}
        </div>
      </div>
    </div>
  );
}
