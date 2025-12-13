"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  Target, 
  Tag, 
  Lightbulb,
  ShoppingCart,
  Info,
  BookOpen,
  Search
} from "lucide-react";
import { motion } from "motion/react";

interface PageAnalysis {
  topic?: string;
  intent?: string;
  entities?: string[];
  contentType?: string;
  summary?: string;
  keyPoints?: string[];
}

interface PageAnalysisCardProps {
  analysis: PageAnalysis;
  className?: string;
}

const intentIcons: Record<string, typeof ShoppingCart> = {
  transactional: ShoppingCart,
  informational: Info,
  navigational: Search,
  commercial: Target,
};

const intentColors: Record<string, string> = {
  transactional: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  informational: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  navigational: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  commercial: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const contentTypeIcons: Record<string, typeof FileText> = {
  landing: Target,
  blog: BookOpen,
  article: FileText,
  product: ShoppingCart,
};

export function PageAnalysisCard({ analysis, className }: PageAnalysisCardProps) {
  const IntentIcon = intentIcons[analysis.intent ?? ""] ?? Info;
  const ContentIcon = contentTypeIcons[analysis.contentType ?? ""] ?? FileText;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Page Analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Topic and Intent */}
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Topic</span>
            </div>
            <p className="font-semibold text-foreground">{analysis.topic ?? "Unknown"}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IntentIcon className="h-4 w-4" />
              <span>Intent</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "capitalize font-medium",
                intentColors[analysis.intent ?? ""] ?? "bg-muted"
              )}
            >
              {analysis.intent ?? "Unknown"}
            </Badge>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ContentIcon className="h-4 w-4" />
              <span>Content Type</span>
            </div>
            <Badge variant="secondary" className="capitalize font-medium">
              {analysis.contentType ?? "Unknown"}
            </Badge>
          </motion.div>
        </div>

        {/* Summary */}
        {analysis.summary && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Summary</span>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </div>
          </motion.div>
        )}

        {/* Key Points and Entities side by side */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Key Points */}
          {analysis.keyPoints && analysis.keyPoints.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                <span>Key Points</span>
              </div>
              <ul className="space-y-2">
                {analysis.keyPoints.map((point, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + idx * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="text-emerald-500 mt-1">✓</span>
                    <span>{point}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Entities */}
          {analysis.entities && analysis.entities.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span>Entities Detected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.entities.map((entity, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                  >
                    <Badge 
                      variant="outline" 
                      className="bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      {entity}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

