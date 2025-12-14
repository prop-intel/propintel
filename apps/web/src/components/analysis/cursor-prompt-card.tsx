"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  Copy,
  Check,
  FileCode,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ===================
// Types
// ===================

export interface CursorPromptSection {
  name: string;
  action: "add" | "modify" | "remove";
  content: string;
}

export interface CursorPrompt {
  prompt: string;
  targetFile?: string;
  sections?: CursorPromptSection[];
  version: string;
  generatedAt: string;
}

export interface CursorPromptCardProps {
  cursorPrompt: CursorPrompt;
  className?: string;
}

// ===================
// Helper Functions
// ===================

function getActionConfig(action: CursorPromptSection["action"]) {
  switch (action) {
    case "add":
      return {
        label: "Add",
        className: "bg-green-500/10 text-green-600 border-green-500/30",
      };
    case "modify":
      return {
        label: "Modify",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      };
    case "remove":
      return {
        label: "Remove",
        className: "bg-red-500/10 text-red-600 border-red-500/30",
      };
  }
}

// ===================
// Main Component
// ===================

export function CursorPromptCard({
  cursorPrompt,
  className,
}: CursorPromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cursorPrompt.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const sections = cursorPrompt.sections ?? [];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cursor Prompt</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {cursorPrompt.version}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Ready-to-use prompt for Cursor IDE to implement AEO improvements
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero copy section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-xl blur-sm" />
          <div className="relative p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  One-Click Implementation
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Copy this prompt and paste it into Cursor to automatically implement the recommended AEO improvements.
                </p>
                <Button
                  onClick={handleCopy}
                  size="lg"
                  className={cn(
                    "gap-2 transition-all",
                    copied && "bg-green-600 hover:bg-green-600"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Prompt to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Prompt preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Prompt Preview
            </span>
            {cursorPrompt.targetFile && (
              <Badge variant="secondary" className="gap-1">
                <FileCode className="h-3 w-3" />
                {cursorPrompt.targetFile}
              </Badge>
            )}
          </div>
          <div className="relative">
            <pre className="p-4 rounded-lg bg-muted/50 border text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {cursorPrompt.prompt}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Sections breakdown */}
        {sections.length > 0 && (
          <Collapsible
            open={sectionsExpanded}
            onOpenChange={setSectionsExpanded}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between hover:bg-muted/50"
              >
                <span className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  <span>Section Breakdown</span>
                  <Badge variant="secondary" className="ml-1">
                    {sections.length}
                  </Badge>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    sectionsExpanded && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 space-y-2"
              >
                {sections.map((section, idx) => {
                  const actionConfig = getActionConfig(section.action);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", actionConfig.className)}
                        >
                          {actionConfig.label}
                        </Badge>
                        <span className="text-sm font-medium">
                          {section.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {section.content}
                      </p>
                    </div>
                  );
                })}
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          Generated {new Date(cursorPrompt.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
