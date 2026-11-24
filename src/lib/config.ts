import "server-only";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  ALPHAXIV_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ALPHAXIV_MCP_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://api.alphaxiv.org/mcp/v1"),
  ),
  ALPHAXIV_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://www.alphaxiv.org"),
  ),
  FEED_SOURCE: z.preprocess(
    emptyToUndefined,
    z.enum(["auto", "mcp", "hot-page"]).default("auto"),
  ),
  HOT_FEED_LIMIT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(200).default(60),
  ),
  CACHE_TTL_SECONDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(86_400).default(600),
  ),
});

export type AppConfig = {
  apiKey: string | undefined;
  mcpUrl: string;
  baseUrl: string;
  feedSource: "auto" | "mcp" | "hot-page";
  hotFeedLimit: number;
  cacheTtlMs: number;
};

let cached: AppConfig | undefined;

/** Reads and validates server configuration once per process. */
export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  cached = {
    apiKey: env.ALPHAXIV_API_KEY,
    mcpUrl: env.ALPHAXIV_MCP_URL,
    baseUrl: env.ALPHAXIV_BASE_URL.replace(/\/+$/, ""),
    feedSource: env.FEED_SOURCE,
    hotFeedLimit: env.HOT_FEED_LIMIT,
    cacheTtlMs: env.CACHE_TTL_SECONDS * 1000,
  };
  return cached;
}
