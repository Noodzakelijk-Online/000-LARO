import {
  invokeMultiProviderLLM,
  type LLMProvider,
  type SelectionStrategy,
  type LLMMessage,
} from "./multiProviderLLM";

/**
 * Adaptive LLM Orchestrator (Nov 2025)
 * 
 * Intelligently selects the best LLM provider(s) for each task based on:
 * - Task complexity (simple → DeepSeek/Google, complex → Claude/GPT-5)
 * - Real-time cost/speed/quality requirements
 * - Multi-agent workflows (multiple LLMs for one task)
 * - Automatic fallback and retry logic
 * 
 * Key Features:
 * - Dynamic provider selection per task
 * - Task complexity analysis
 * - Multi-agent orchestration
 * - Cost optimization
 * - Quality assurance
 */

export type TaskType =
  | "data_extraction" // Extract structured data from text
  | "web_scraping" // Parse and extract from HTML
  | "summarization" // Summarize long text
  | "classification" // Classify/categorize content
  | "reasoning" // Complex reasoning/analysis
  | "translation" // Language translation
  | "generation" // Generate new content
  | "validation" // Validate/verify data;

export type TaskComplexity = "simple" | "medium" | "complex";

export type QualityRequirement = "low" | "medium" | "high" | "critical";

export interface TaskConfig {
  type: TaskType;
  complexity?: TaskComplexity;
  qualityRequirement?: QualityRequirement;
  maxCostCents?: number; // Maximum cost in cents
  maxTimeMs?: number; // Maximum time in milliseconds
  requiresMultiAgent?: boolean; // Use multiple LLMs for validation
}

export interface OrchestrationResult<T = unknown> {
  result: T;
  provider: LLMProvider;
  cost: number;
  timeMs: number;
  confidence: number; // 0-1 score
  multiAgentValidation?: {
    providers: LLMProvider[];
    agreement: number; // 0-1 score (how much LLMs agreed)
  };
}

/**
 * Task complexity analyzer
 * Automatically determines task complexity based on input characteristics
 */
function analyzeTaskComplexity(
  taskType: TaskType,
  inputLength: number
): TaskComplexity {
  // Simple tasks: short input, straightforward operations
  if (inputLength < 500) {
    if (["data_extraction", "classification", "validation"].includes(taskType)) {
      return "simple";
    }
  }

  // Complex tasks: long input or complex reasoning
  if (inputLength > 2000 || taskType === "reasoning") {
    return "complex";
  }

  // Medium by default
  return "medium";
}

/**
 * Select optimal provider strategy based on task configuration
 */
function selectStrategy(config: TaskConfig): SelectionStrategy {
  const { complexity, qualityRequirement, maxCostCents, maxTimeMs } = config;

  // Critical quality → use best models
  if (qualityRequirement === "critical") {
    return "quality-optimized";
  }

  // Tight time constraint → use fastest models
  if (maxTimeMs && maxTimeMs < 2000) {
    return "speed-optimized";
  }

  // Tight budget → use cheapest models
  if (maxCostCents && maxCostCents < 1) {
    return "cost-optimized";
  }

  // Complex tasks → prioritize quality
  if (complexity === "complex") {
    return "quality-optimized";
  }

  // Simple tasks → prioritize cost
  if (complexity === "simple") {
    return "cost-optimized";
  }

  // Balanced by default
  return "balanced";
}

/**
 * Adaptive LLM Orchestrator
 * Automatically selects and invokes the best LLM(s) for a task
 */
export class AdaptiveLLMOrchestrator {
  /**
   * Execute a task with automatic provider selection
   */
  async execute<T = string>(
    systemPrompt: string,
    userPrompt: string,
    config: TaskConfig,
    responseSchema?: Record<string, unknown>
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now();

    // Auto-detect complexity if not provided
    const complexity =
      config.complexity ||
      analyzeTaskComplexity(config.type, userPrompt.length);

    // Select optimal strategy
    const strategy = selectStrategy({ ...config, complexity });

    console.log(
      `[Adaptive LLM] Task: ${config.type}, Complexity: ${complexity}, Strategy: ${strategy}`
    );

    // Build messages
    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Build response format if schema provided
    const responseFormat = responseSchema
      ? {
          type: "json_schema" as const,
          json_schema: {
            name: "response",
            strict: true,
            schema: responseSchema,
          },
        }
      : undefined;

    // Execute with multi-provider fallback
    const response = await invokeMultiProviderLLM({
      messages,
      responseFormat,
      strategy,
      maxRetries: 3,
    });

    const timeMs = Date.now() - startTime;

    // Parse result
    let result: T;
    if (responseSchema) {
      try {
        result = JSON.parse(response.content || "{}") as T;
      } catch (error) {
        console.error("[Adaptive LLM] JSON parse error:", error);
        result = response.content as T;
      }
    } else {
      result = response.content as T;
    }

    // Calculate confidence (simple heuristic for now)
    const confidence = this.calculateConfidence(response, config);

    // Multi-agent validation if required
    let multiAgentValidation;
    if (config.requiresMultiAgent) {
      multiAgentValidation = await this.runMultiAgentValidation(
        messages,
        responseFormat,
        response.provider,
        result
      );
    }

    return {
      result,
      provider: response.provider,
      cost: response.cost,
      timeMs,
      confidence,
      multiAgentValidation,
    };
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(
    response: { content: string | null; cost: number; responseTimeMs: number },
    config: TaskConfig
  ): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on response length (too short might be incomplete)
    const contentLength = response.content?.length || 0;
    if (contentLength < 50) {
      confidence -= 0.2;
    } else if (contentLength > 200) {
      confidence += 0.1;
    }

    // Adjust based on response time (too fast might be low quality)
    if (response.responseTimeMs < 500) {
      confidence -= 0.1;
    }

    // Adjust based on task complexity
    if (config.complexity === "complex" && response.cost < 0.001) {
      // Complex task with very low cost → might be using weak model
      confidence -= 0.15;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Run multi-agent validation
   * Execute same task with different providers and compare results
   */
  private async runMultiAgentValidation<T>(
    messages: LLMMessage[],
    responseFormat: any,
    primaryProvider: LLMProvider,
    primaryResult: T
  ): Promise<{
    providers: LLMProvider[];
    agreement: number;
  }> {
    console.log("[Adaptive LLM] Running multi-agent validation...");

    // Use different strategy to get different provider
    const secondaryResponse = await invokeMultiProviderLLM({
      messages,
      responseFormat,
      strategy: "quality-optimized", // Use high-quality model for validation
      maxRetries: 2,
    });

    let secondaryResult: T;
    if (responseFormat) {
      try {
        secondaryResult = JSON.parse(secondaryResponse.content || "{}") as T;
      } catch {
        secondaryResult = secondaryResponse.content as T;
      }
    } else {
      secondaryResult = secondaryResponse.content as T;
    }

    // Calculate agreement (simple string similarity for now)
    const agreement = this.calculateAgreement(primaryResult, secondaryResult);

    console.log(
      `[Adaptive LLM] Multi-agent agreement: ${(agreement * 100).toFixed(1)}% (${primaryProvider} vs ${secondaryResponse.provider})`
    );

    return {
      providers: [primaryProvider, secondaryResponse.provider],
      agreement,
    };
  }

  /**
   * Calculate agreement between two results
   */
  private calculateAgreement<T>(result1: T, result2: T): number {
    const str1 = JSON.stringify(result1);
    const str2 = JSON.stringify(result2);

    // Simple Jaccard similarity
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Batch execute multiple tasks in parallel
   */
  async executeBatch<T = string>(
    tasks: Array<{
      systemPrompt: string;
      userPrompt: string;
      config: TaskConfig;
      responseSchema?: Record<string, unknown>;
    }>,
    maxConcurrency: number = 5
  ): Promise<OrchestrationResult<T>[]> {
    const results: OrchestrationResult<T>[] = [];

    // Process in batches
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);

      const batchResults = await Promise.all(
        batch.map((task) =>
          this.execute<T>(
            task.systemPrompt,
            task.userPrompt,
            task.config,
            task.responseSchema
          )
        )
      );

      results.push(...batchResults);

      console.log(
        `[Adaptive LLM] Batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(tasks.length / maxConcurrency)} complete`
      );
    }

    return results;
  }
}

// Singleton instance
export const adaptiveLLM = new AdaptiveLLMOrchestrator();

/**
 * Convenience functions for common tasks
 */

export async function extractStructuredData<T = Record<string, unknown>>(
  text: string,
  schema: Record<string, unknown>,
  config?: Partial<TaskConfig>
): Promise<OrchestrationResult<T>> {
  return adaptiveLLM.execute<T>(
    "You are a precise data extraction assistant. Extract structured information from the provided text according to the schema.",
    text,
    {
      type: "data_extraction",
      qualityRequirement: "high",
      ...config,
    },
    schema
  );
}

export async function classifyText(
  text: string,
  categories: string[],
  config?: Partial<TaskConfig>
): Promise<OrchestrationResult<{ category: string; confidence: number }>> {
  return adaptiveLLM.execute<{ category: string; confidence: number }>(
    `You are a text classification assistant. Classify the text into one of these categories: ${categories.join(", ")}`,
    text,
    {
      type: "classification",
      qualityRequirement: "medium",
      ...config,
    },
    {
      type: "object",
      properties: {
        category: { type: "string", enum: categories },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["category", "confidence"],
      additionalProperties: false,
    }
  );
}

export async function summarizeText(
  text: string,
  maxLength: number = 200,
  config?: Partial<TaskConfig>
): Promise<OrchestrationResult<string>> {
  return adaptiveLLM.execute<string>(
    `You are a summarization assistant. Create a concise summary of the text in maximum ${maxLength} characters.`,
    text,
    {
      type: "summarization",
      qualityRequirement: "medium",
      ...config,
    }
  );
}

export async function validateData<T>(
  data: T,
  validationRules: string,
  config?: Partial<TaskConfig>
): Promise<
  OrchestrationResult<{ valid: boolean; errors: string[]; suggestions: string[] }>
> {
  return adaptiveLLM.execute<{
    valid: boolean;
    errors: string[];
    suggestions: string[];
  }>(
    `You are a data validation assistant. Validate the data according to these rules: ${validationRules}`,
    JSON.stringify(data, null, 2),
    {
      type: "validation",
      qualityRequirement: "high",
      requiresMultiAgent: true, // Use multi-agent for critical validation
      ...config,
    },
    {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        errors: { type: "array", items: { type: "string" } },
        suggestions: { type: "array", items: { type: "string" } },
      },
      required: ["valid", "errors", "suggestions"],
      additionalProperties: false,
    }
  );
}
