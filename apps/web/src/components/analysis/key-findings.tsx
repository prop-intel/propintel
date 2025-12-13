"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Info
} from "lucide-react";
import { motion } from "motion/react";

interface KeyFindingsProps {
  findings: string[];
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  className?: string;
}

function getIcon(finding: string) {
  const lowerFinding = finding.toLowerCase();
  if (lowerFinding.includes("low") || lowerFinding.includes("missing") || lowerFinding.includes("weak")) {
    return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" };
  }
  if (lowerFinding.includes("opportunity") || lowerFinding.includes("best") || lowerFinding.includes("win")) {
    return { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" };
  }
  if (lowerFinding.includes("ranking") || lowerFinding.includes("improve")) {
    return { icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" };
  }
  return { icon: Info, color: "text-primary", bg: "bg-primary/10" };
}

export function KeyFindings({ 
  findings, 
  strengths,
  weaknesses,
  opportunities,
  className 
}: KeyFindingsProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Key Findings</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main findings */}
        <div className="space-y-3">
          {findings.map((finding, idx) => {
            const { icon: Icon, color, bg } = getIcon(finding);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border",
                  bg
                )}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", color)} />
                <p className="text-sm leading-relaxed">{finding}</p>
              </motion.div>
            );
          })}
        </div>

        {/* SWOT-style breakdown */}
        {(strengths?.length || weaknesses?.length || opportunities?.length) && (
          <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
            {/* Strengths */}
            {strengths && strengths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-sm font-medium">Strengths</h4>
                </div>
                <ul className="space-y-2">
                  {strengths.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Weaknesses */}
            {weaknesses && weaknesses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <h4 className="text-sm font-medium">Weaknesses</h4>
                </div>
                <ul className="space-y-2">
                  {weaknesses.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Opportunities */}
            {opportunities && opportunities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-medium">Opportunities</h4>
                </div>
                <ul className="space-y-2">
                  {opportunities.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

