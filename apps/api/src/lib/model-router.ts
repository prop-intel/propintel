/**
 * Model Router
 *
 * Routes model requests to appropriate providers based on model name
 * OpenRouter supports multiple model providers including Claude, Llama, Mistral, etc.
 */

import { openai, openrouter, type LLMProvider } from './llm-utils';

export interface ModelRoute {
  provider: LLMProvider;
  modelName: string;
}

/**
 * Determine which provider should handle a specific model
 */
export function getProviderForModel(requestedModel: string): LLMProvider {
  // OpenAI models (gpt-*) go directly to OpenAI when available
  if (requestedModel.startsWith('gpt-') && process.env.OPENAI_API_KEY) {
    return openai;
  }

  // All other models (Claude, Llama, Mistral, etc.) go through OpenRouter
  // OpenRouter also serves as fallback for GPT models if needed
  if (process.env.OPENROUTER_API_KEY) {
    return openrouter;
  }

  // Default fallback to OpenAI
  return openai;
}

/**
 * Get available models based on configured providers
 */
export function getAvailableModels(): string[] {
  const models: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    models.push('gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo');
  }

  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter supports many models including Claude, Llama, Mistral, etc.
    models.push(
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'meta-llama/llama-3-70b',
      'mistral-large'
    );
  }

  return models;
}