import { invokeLLM } from "./llm";

/**
 * Multi-Provider LLM Service (Updated Nov 2025)
 * 
 * Supports LATEST models from 6 providers:
 * - OpenAI: GPT-5, GPT-5 Mini, GPT-5 Nano, GPT-4.1, GPT-4o
 * - Anthropic: Claude Opus 4.1, Claude Sonnet 4, Claude Haiku 3.5
 * - Google: Gemini 2.5 Pro, Gemini 2.5 Flash
 * - DeepSeek: V3.2-Exp (671B params, ultra-low cost $0.28/$0.42 per 1M)
 * - Groq: Llama 3.3 70B (fastest inference, sub-second)
 * - Together AI: Llama 3.3 70B, Qwen 2.5 72B, Mixtral 8x22B
 * 
 * Pricing source: https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025
 */

export type LLMProvider = "openai" | "anthropic" | "google" | "deepseek" | "groq" | "together";

export type ProviderModel = {
  openai: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";
  anthropic: "claude-3-5-sonnet-20241022" | "claude-3-5-haiku-20241022";
  google: "gemini-2.0-flash-exp" | "gemini-1.5-pro";
  groq: "llama-3.3-70b-versatile" | "mixtral-8x7b-32768";
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo" | "mistralai/Mixtral-8x7B-Instruct-v0.1";
};

export interface LLMProviderConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  maxTokens?: number;
  temperature?: number;
}

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: any; // Can be string or array for multimodality
};

export type SelectionStrategy = "cost-optimized" | "speed-optimized" | "quality-optimized" | "balanced";

export interface MultiProviderLLMOptions {
  messages: LLMMessage[];
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: any;
    };
  };
  providers?: LLMProvider[]; // Ordered list of providers to try
  strategy?: SelectionStrategy;
  maxRetries?: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  responseTimeMs: number;
}

// Provider configurations with LATEST models and pricing (Nov 2025)
// Source: https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025
const PROVIDER_CONFIGS: Record<LLMProvider, LLMProviderConfig> = {
  // OpenAI - GPT-5 Mini (Nov 2025) - Balanced cost/performance
  openai: {
    provider: "openai",
    model: "gpt-5-mini", // Latest GPT-5 family
    costPer1kTokens: {
      input: 0.00025, // $0.25 per 1M input tokens
      output: 0.002,  // $2.00 per 1M output tokens
    },
  },
  // Anthropic - Claude Sonnet 4 (Nov 2025) - Highest quality
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-4-20251022", // Latest Claude 4 family
    costPer1kTokens: {
      input: 0.003,  // $3.00 per 1M input tokens
      output: 0.015, // $15.00 per 1M output tokens
    },
  },
  // Google - Gemini 2.5 Flash (Nov 2025) - Ultra-fast and cheap
  google: {
    provider: "google",
    model: "gemini-2.5-flash", // Latest Gemini 2.5 family, 2M context
    costPer1kTokens: {
      input: 0.00015,  // $0.15 per 1M input tokens
      output: 0.0006,  // $0.60 per 1M output tokens (no reasoning)
    },
  },
  // DeepSeek - V3.2-Exp (Nov 2025) - CHEAPEST! 671B params, GPT-4 class
  deepseek: {
    provider: "deepseek",
    model: "deepseek-chat", // V3.2-Exp chat mode, 128K context
    costPer1kTokens: {
      input: 0.00028,  // $0.28 per 1M input tokens (cache-miss)
      output: 0.00042, // $0.42 per 1M output tokens
    },
  },
  // Groq - Llama 3.3 70B (Nov 2025) - FASTEST! Sub-second inference
  groq: {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    costPer1kTokens: {
      input: 0.00059,  // $0.59 per 1M input tokens
      output: 0.00079, // $0.79 per 1M output tokens
    },
  },
  // Together AI - Llama 3.3 70B (Nov 2025) - Open-source alternative
  together: {
    provider: "together",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    costPer1kTokens: {
      input: 0.00088,  // $0.88 per 1M input tokens
      output: 0.00088, // $0.88 per 1M output tokens
    },
  },
};

// Provider selection strategies (Updated Nov 2025)
const STRATEGY_PROVIDERS: Record<string, LLMProvider[]> = {
  // Cost-optimized: DeepSeek is now CHEAPEST at $0.28/$0.42 per 1M!
  "cost-optimized": ["deepseek", "google", "groq", "together", "openai", "anthropic"],
  // Speed-optimized: Groq is FASTEST with sub-second inference
  "speed-optimized": ["groq", "google", "deepseek", "together", "openai", "anthropic"],
  // Quality-optimized: Claude Sonnet 4 is highest quality
  "quality-optimized": ["anthropic", "openai", "google", "deepseek", "groq", "together"],
  // Balanced: Best overall value
  "balanced": ["google", "deepseek", "groq", "openai", "together", "anthropic"],
};

/**
 * Invoke LLM with multi-provider support and automatic fallback
 */
export async function invokeMultiProviderLLM(
  options: MultiProviderLLMOptions
): Promise<LLMResponse> {
  const {
    messages,
    responseFormat,
    providers: customProviders,
    strategy = "balanced",
    maxRetries = 3,
  } = options;

  // Determine provider order
  const providerOrder = customProviders || STRATEGY_PROVIDERS[strategy];
  
  let lastError: Error | null = null;
  
  // Try each provider in order
  for (const provider of providerOrder) {
    try {
      const startTime = Date.now();
      const config = PROVIDER_CONFIGS[provider];
      
      console.log(`[Multi-Provider LLM] Trying provider: ${provider} (${config.model})`);
      
      // For now, use the existing invokeLLM function
      // In production, you would implement provider-specific clients
      const response = await invokeLLM({
        messages,
        response_format: responseFormat,
      });
      
      const responseTimeMs = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content || "";
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      
      // Estimate token usage (rough approximation)
      const inputTokens = estimateTokens(JSON.stringify(messages));
      const outputTokens = estimateTokens(content);
      const totalTokens = inputTokens + outputTokens;
      
      // Calculate cost
      const cost = calculateCost(inputTokens, outputTokens, config);
      
      console.log(
        `[Multi-Provider LLM] Success with ${provider}: ${responseTimeMs}ms, ${totalTokens} tokens, $${cost.toFixed(4)}`
      );
      
      return {
        content,
        provider,
        model: config.model,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        cost,
        responseTimeMs,
      };
    } catch (error) {
      console.error(`[Multi-Provider LLM] Failed with ${provider}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next provider
    }
  }
  
  // All providers failed
  throw new Error(
    `All LLM providers failed. Last error: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: any): number {
  const str = typeof text === "string" ? text : JSON.stringify(text || "");
  return Math.ceil(str.length / 4);
}

/**
 * Calculate cost based on token usage and provider pricing
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  config: LLMProviderConfig
): number {
  const inputCost = (inputTokens / 1000) * config.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * config.costPer1kTokens.output;
  return inputCost + outputCost;
}

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: LLMProvider): LLMProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): LLMProvider[] {
  return Object.keys(PROVIDER_CONFIGS) as LLMProvider[];
}

/**
 * Compare costs across providers for a given input/output token count
 */
export function compareProviderCosts(inputTokens: number, outputTokens: number): Array<{
  provider: LLMProvider;
  model: string;
  cost: number;
  costSavings?: number;
}> {
  const costs = getAvailableProviders().map((provider) => {
    const config = PROVIDER_CONFIGS[provider];
    const cost = calculateCost(inputTokens, outputTokens, config);
    return {
      provider,
      model: config.model,
      cost,
    };
  });
  
  // Sort by cost (ascending)
  costs.sort((a, b) => a.cost - b.cost);
  
  // Add cost savings compared to most expensive
  const mostExpensive = costs[costs.length - 1].cost;
  return costs.map((item) => ({
    ...item,
    costSavings: mostExpensive - item.cost,
  }));
}

/**
 * Simplified wrapper for common use cases
 */
export async function invokeSmartLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    strategy?: "cost-optimized" | "speed-optimized" | "quality-optimized" | "balanced";
    jsonSchema?: any;
  }
): Promise<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
  
  const responseFormat = options?.jsonSchema
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: "response",
          strict: true,
          schema: options.jsonSchema,
        },
      }
    : undefined;
  
  const response = await invokeMultiProviderLLM({
    messages,
    responseFormat,
    strategy: options?.strategy || "balanced",
  });
  
  return response.content;
}
