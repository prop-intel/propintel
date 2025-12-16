"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: number;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Work";
  if (score >= 20) return "Poor";
  return "Critical";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/10";
  if (score >= 60) return "bg-amber-500/10";
  if (score >= 40) return "bg-orange-500/10";
  return "bg-red-500/10";
}

function CircularProgress({ score, size = 100, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <motion.circle
          className={cn(
            score >= 80 ? "text-emerald-500" :
            score >= 60 ? "text-amber-500" :
            score >= 40 ? "text-orange-500" :
            "text-red-500"
          )}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className={cn("text-2xl font-bold", getScoreColor(score))}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {score}
        </motion.span>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  maxScore: _maxScore = 100,
  description,
  trend,
  trendValue,
  className
}: ScoreCardProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-3 p-4 rounded-xl border transition-all",
      getScoreBgColor(score),
      className
    )}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <CircularProgress score={score} size={80} strokeWidth={6} />
      
      <div className="flex flex-col items-center gap-1">
        <span className={cn("text-xs font-medium", getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
        {trend && trendValue && (
          <div className={cn(
            "flex items-center gap-1 text-xs",
            trend === "up" ? "text-emerald-500" :
            trend === "down" ? "text-red-500" :
            "text-muted-foreground"
          )}>
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "neutral" && <Minus className="h-3 w-3" />}
            <span>{trend === "up" ? "+" : ""}{trendValue}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScoreDashboardProps {
  scores: {
    aeoVisibilityScore?: number;
    llmeoScore?: number;
    seoScore?: number;
    overallScore?: number;
  };
  confidence?: number;
  className?: string;
}

export function ScoreDashboard({ scores, confidence = 0.6, className }: ScoreDashboardProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analysis Scores</h3>
        {confidence && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${confidence * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-xs font-medium">{Math.round(confidence * 100)}%</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Analysis confidence based on data quality and coverage</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard
          label="AEO Visibility"
          score={scores.aeoVisibilityScore ?? 0}
          description="How often your content appears in AI search results"
        />
        <ScoreCard
          label="Content Clarity"
          score={scores.llmeoScore ?? 0}
          description="How well AI models can read and understand your content (schema, structure, depth)"
        />
        <ScoreCard
          label="SEO"
          score={scores.seoScore ?? 0}
          description="Traditional search engine optimization score"
        />
        <ScoreCard
          label="Overall"
          score={scores.overallScore ?? 0}
          description="Weighted average of all scores"
        />
      </div>

      {/* Score breakdown bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Score composition</span>
          <span>AEO 50% • Content Clarity 30% • SEO 20%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex">
          <motion.div
            className="bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: "50%" }}
            transition={{ duration: 0.5 }}
            style={{ opacity: (scores.aeoVisibilityScore ?? 0) / 100 }}
          />
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-blue-400"
            initial={{ width: 0 }}
            animate={{ width: "30%" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ opacity: (scores.llmeoScore ?? 0) / 100 }}
          />
          <motion.div
            className="bg-gradient-to-r from-purple-500 to-purple-400"
            initial={{ width: 0 }}
            animate={{ width: "20%" }}
            transition={{ duration: 0.5, delay: 0.4 }}
            style={{ opacity: (scores.seoScore ?? 0) / 100 }}
          />
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">AEO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Content Clarity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">SEO</span>
          </div>
        </div>
      </div>
    </div>
  );
}

