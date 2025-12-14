/**
 * Cursor Prompt Generator Agent
 *
 * Generates a ready-to-paste prompt for Cursor IDE
 * that will help optimize content for AEO.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { type AEOAnalysis, type AEORecommendation, type CursorPrompt, type PageAnalysis } from '../../types';
import { createTrace, safeFlush } from '../../lib/langfuse';

// ===================
// Timeout Configuration
// ===================

// 60 second timeout for LLM API calls to prevent indefinite hangs
const LLM_TIMEOUT_MS = 60_000;

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ===================
// Schema Definition
// ===================

const SectionSchema = z.object({
  name: z.string(),
  action: z.string().describe('Action to take (add, modify, remove)'),
  content: z.string(),
});

const CursorPromptSchema = z.object({
  prompt: z.string().describe('The complete prompt to paste into Cursor'),
  sections: z.array(SectionSchema).optional()
    .describe('Specific sections to add/modify'),
});

// Normalize cursor prompt data
function normalizeCursorPrompt(data: z.infer<typeof CursorPromptSchema>) {
  return {
    prompt: data.prompt,
    sections: (data.sections ?? []).map(s => ({
      name: s.name,
      action: (s.action?.toLowerCase() || 'modify') as 'add' | 'modify' | 'remove',
      content: s.content,
    })),
  };
}

// ===================
// Main Function
// ===================

/**
 * Generate a Cursor-ready prompt for content optimization
 */
export async function generateCursorPrompt(
  domain: string,
  pageAnalysis: PageAnalysis,
  aeoAnalysis: AEOAnalysis,
  recommendations: AEORecommendation[],
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<CursorPrompt> {
  const trace = createTrace({
    name: 'aeo-cursor-prompt',
    userId: tenantId,
    metadata: { jobId, domain },
  });

  const generation = trace.generation({
    name: 'generate-cursor-prompt',
    model,
  });

  try {
    // Get high priority recommendations
    const highPriorityRecs = recommendations
      .filter(r => r.priority === 'high')
      .slice(0, 5);

    const systemPrompt = `You are an expert at creating actionable prompts for AI coding assistants like Cursor.

Create a comprehensive prompt that a developer can paste directly into Cursor to optimize their content for AI search visibility.

The prompt should:
1. Be clear and actionable
2. Include specific sections to add or modify
3. Reference the exact queries that need targeting
4. Be structured so an AI assistant can execute it directly
5. Include any schema markup or structural changes needed

Format the prompt in markdown with clear sections.`;

    const userPrompt = `Create a Cursor prompt for optimizing this content:

Domain: ${domain}
Current Topic: ${pageAnalysis.topic}
Content Type: ${pageAnalysis.contentType}
Current Visibility Score: ${aeoAnalysis.visibilityScore}/100

Queries to Target (not currently winning):
${aeoAnalysis.missedOpportunities.map(q => `- "${q}"`).join('\n')}

High Priority Recommendations:
${highPriorityRecs.map(r => `
## ${r.title}
${r.description}
Target queries: ${r.targetQueries.join(', ')}
${r.competitorExample ? `Competitor example: ${r.competitorExample.domain} - ${r.competitorExample.whatTheyDoBetter}` : ''}
`).join('\n')}

Key Findings:
${aeoAnalysis.keyFindings.map(f => `- ${f}`).join('\n')}

Create a prompt that will help improve visibility for these target queries.`;

    const result = await generateObject({
      model: openai(model),
      schema: CursorPromptSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    generation.end({
      output: result.object,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    // Non-blocking flush - observability should never block business logic
    void safeFlush();

    const normalized = normalizeCursorPrompt(result.object);
    return {
      prompt: normalized.prompt,
      sections: normalized.sections,
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    // Non-blocking flush - still try to log errors
    void safeFlush();
    throw error;
  }
}

/**
 * Generate a quick Cursor prompt without LLM (template-based)
 */
export function generateQuickCursorPrompt(
  domain: string,
  pageAnalysis: PageAnalysis,
  aeoAnalysis: AEOAnalysis,
  recommendations: AEORecommendation[]
): CursorPrompt {
  const highPriorityRecs = recommendations
    .filter(r => r.priority === 'high')
    .slice(0, 3);

  const targetQueries = aeoAnalysis.missedOpportunities.slice(0, 5);
  
  const sections: CursorPrompt['sections'] = [];

  // Build the prompt
  const promptParts: string[] = [
    `# AEO Content Optimization Task`,
    ``,
    `## Overview`,
    `Optimize the content on ${domain} to improve visibility in AI search results.`,
    `Current AEO Visibility Score: ${aeoAnalysis.visibilityScore}/100`,
    ``,
    `## Target Queries to Win`,
    `The following queries should lead AI systems to cite this content:`,
    ...targetQueries.map(q => `- "${q}"`),
    ``,
    `## Required Changes`,
  ];

  // Add recommendations as tasks
  let taskNum = 1;
  for (const rec of highPriorityRecs) {
    promptParts.push(`### ${taskNum}. ${rec.title}`);
    promptParts.push(rec.description);
    
    if (rec.targetQueries.length > 0) {
      promptParts.push(`**Target queries:** ${rec.targetQueries.slice(0, 3).join(', ')}`);
    }
    
    if (rec.competitorExample) {
      promptParts.push(`**Reference:** ${rec.competitorExample.domain} - ${rec.competitorExample.whatTheyDoBetter}`);
    }
    
    promptParts.push('');
    
    sections.push({
      name: rec.title,
      action: rec.category === 'content' ? 'add' : 'modify',
      content: rec.description,
    });
    
    taskNum++;
  }

  // Add structure improvements if needed
  if (aeoAnalysis.visibilityScore < 50) {
    promptParts.push(`### ${taskNum}. Add FAQ Section`);
    promptParts.push(`Add a FAQ section that directly answers these questions:`);
    targetQueries.slice(0, 3).forEach(q => {
      promptParts.push(`- ${q}`);
    });
    promptParts.push('');
    
    sections.push({
      name: 'FAQ Section',
      action: 'add',
      content: 'Add FAQ schema markup with direct answers to target queries',
    });
  }

  // Add key points section
  promptParts.push(`## Key Points to Emphasize`);
  pageAnalysis.keyPoints.forEach(point => {
    promptParts.push(`- ${point}`);
  });
  promptParts.push('');

  // Add schema markup suggestion
  promptParts.push(`## Schema Markup`);
  promptParts.push(`Add or update the following schema types for better AI understanding:`);
  promptParts.push(`- Article or BlogPosting schema`);
  promptParts.push(`- FAQPage schema for Q&A content`);
  promptParts.push(`- HowTo schema for tutorial content`);
  promptParts.push('');

  // Add success criteria
  promptParts.push(`## Success Criteria`);
  promptParts.push(`After implementing these changes, the content should:`);
  promptParts.push(`- Directly answer the target queries in the first 2-3 paragraphs`);
  promptParts.push(`- Have clear, scannable headings matching query intent`);
  promptParts.push(`- Include structured data for AI systems`);
  promptParts.push(`- Be comprehensive enough to be cited as an authoritative source`);

  return {
    prompt: promptParts.join('\n'),
    sections,
    version: 'v1.0-quick',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format the Cursor prompt for display/copy
 */
export function formatCursorPromptForCopy(prompt: CursorPrompt): string {
  return `---
# Copy this prompt into Cursor
# Generated: ${prompt.generatedAt}
# Version: ${prompt.version}
---

${prompt.prompt}`;
}

