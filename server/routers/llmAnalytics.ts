import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAvailableProviders,
  getProviderConfig,
  compareProviderCosts,
  type LLMProvider,
} from "../multiProviderLLM";

/**
 * LLM Analytics Router
 * Provides insights into LLM provider usage, costs, and performance
 */
export const llmAnalyticsRouter = router({
  /**
   * Get list of available LLM providers
   */
  getProviders: protectedProcedure.query(() => {
    const providers = getAvailableProviders();
    return providers.map((provider) => {
      const config = getProviderConfig(provider);
      return {
        provider,
        model: config.model,
        costPer1kTokens: config.costPer1kTokens,
      };
    });
  }),

  /**
   * Compare costs across providers for a given token count
   */
  compareCosts: protectedProcedure
    .input(
      z.object({
        inputTokens: z.number().min(0),
        outputTokens: z.number().min(0),
      })
    )
    .query(({ input }) => {
      return compareProviderCosts(input.inputTokens, input.outputTokens);
    }),

  /**
   * Get provider configuration details
   */
  getProviderConfig: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "anthropic", "google", "deepseek", "groq", "together"])
      })
    )
    .query(({ input }) => {
      return getProviderConfig(input.provider as LLMProvider);
    }),

  /**
   * Get cost estimates for typical legal research tasks
   */
  getTaskCostEstimates: protectedProcedure.query(() => {
    // Typical token counts for legal research tasks
    const tasks = [
      {
        task: "Entity Extraction (1 page)",
        inputTokens: 2000,
        outputTokens: 500,
      },
      {
        task: "Document Classification",
        inputTokens: 1000,
        outputTokens: 200,
      },
      {
        task: "Legal Report Generation (10 pages)",
        inputTokens: 10000,
        outputTokens: 3000,
      },
      {
        task: "Comprehensive Analysis (50 pages)",
        inputTokens: 50000,
        outputTokens: 10000,
      },
    ];

    return tasks.map((task) => ({
      task: task.task,
      providers: compareProviderCosts(task.inputTokens, task.outputTokens),
    }));
  }),

  /**
   * Get recommended provider for a task type
   */
  getRecommendedProvider: protectedProcedure
    .input(
      z.object({
        taskType: z.enum([
          "entity_extraction",
          "document_classification",
          "report_generation",
          "comprehensive_analysis",
        ]),
        priority: z.enum(["cost", "speed", "quality", "balanced"]).default("balanced"),
      })
    )
    .query(({ input }) => {
      // Recommendations based on task type and priority
      const recommendations: Record<
        string,
        Record<string, { provider: LLMProvider; reason: string }>
      > = {
        entity_extraction: {
          cost: {
            provider: "google",
            reason: "Gemini 2.0 Flash is free during preview and very fast",
          },
          speed: {
            provider: "groq",
            reason: "Groq offers fastest inference with Llama 3.3 70B",
          },
          quality: {
            provider: "anthropic",
            reason: "Claude 3.5 Sonnet excels at structured data extraction",
          },
          balanced: {
            provider: "google",
            reason: "Gemini 2.0 Flash offers best speed/cost ratio",
          },
        },
        document_classification: {
          cost: {
            provider: "google",
            reason: "Free tier sufficient for classification tasks",
          },
          speed: {
            provider: "groq",
            reason: "Sub-second inference for simple classification",
          },
          quality: {
            provider: "openai",
            reason: "GPT-4o has excellent classification accuracy",
          },
          balanced: {
            provider: "google",
            reason: "Gemini 2.0 Flash handles classification well at no cost",
          },
        },
        report_generation: {
          cost: {
            provider: "google",
            reason: "Free during preview, handles long context well",
          },
          speed: {
            provider: "groq",
            reason: "Fast generation with Llama 3.3 70B",
          },
          quality: {
            provider: "anthropic",
            reason: "Claude 3.5 Sonnet produces highest quality legal analysis",
          },
          balanced: {
            provider: "openai",
            reason: "GPT-4o offers best quality/speed balance for reports",
          },
        },
        comprehensive_analysis: {
          cost: {
            provider: "groq",
            reason: "Very low cost per token, handles large context",
          },
          speed: {
            provider: "groq",
            reason: "Fastest for large-scale analysis",
          },
          quality: {
            provider: "anthropic",
            reason: "Claude 3.5 Sonnet best for complex legal reasoning",
          },
          balanced: {
            provider: "openai",
            reason: "GPT-4o balances quality and cost for large tasks",
          },
        },
      };

      const recommendation = recommendations[input.taskType][input.priority];
      const config = getProviderConfig(recommendation.provider);

      return {
        provider: recommendation.provider,
        model: config.model,
        reason: recommendation.reason,
        costPer1kTokens: config.costPer1kTokens,
      };
    }),
});
