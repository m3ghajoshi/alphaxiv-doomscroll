import "server-only";
import { z } from "zod";
import type { Collection } from "./alphaxiv/types";

const SORT_LABELS: Record<string, string> = {
  Hot: "Hot",
  Likes: "Most liked",
  Views: "Most viewed",
  Comments: "Most discussed",
  GitHub: "Top on GitHub",
  Recent: "Recent",
};
const SORTS = Object.keys(SORT_LABELS);
const INTERVALS = ["3 Days", "7 Days", "30 Days", "90 Days", "All time"];

/** Parses FEED_LISTS, e.g. "Hot:30 Days,Likes:All time", in priority order. */
export function parseLists(value: string): Collection[] {
  const lists = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sort = "", interval = "30 Days"] = entry.split(":").map((part) => part.trim());
      if (!SORTS.includes(sort)) {
        throw new Error(`FEED_LISTS: unknown sort "${sort}" (use one of ${SORTS.join(", ")})`);
      }
      if (!INTERVALS.includes(interval)) {
        throw new Error(
          `FEED_LISTS: unknown interval "${interval}" (use one of ${INTERVALS.join(", ")})`,
        );
      }
      return { sort, interval, label: SORT_LABELS[sort] ?? sort };
    });
  if (lists.length === 0) throw new Error("FEED_LISTS must name at least one list");
  return lists;
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  ALPHAXIV_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ALPHAXIV_MCP_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://api.alphaxiv.org/mcp/v1"),
  ),
  ALPHAXIV_API_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://api.alphaxiv.org"),
  ),
  ALPHAXIV_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://www.alphaxiv.org"),
  ),
  FEED_SOURCE: z.preprocess(
    emptyToUndefined,
    z.enum(["auto", "feed-api", "mcp"]).default("auto"),
  ),
  FEED_LISTS: z.preprocess(
    emptyToUndefined,
    z.string().default("Hot:30 Days,Likes:All time"),
  ),
  FEED_PAGE_SIZE: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(5).max(100).default(100),
  ),
  FEED_MAX_PAGES: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(20).default(4),
  ),
  HOT_FEED_LIMIT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(200).default(60),
  ),
  CACHE_TTL_SECONDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(86_400).default(1800),
  ),
});

export type AppConfig = {
  apiKey: string | undefined;
  mcpUrl: string;
  apiUrl: string;
  baseUrl: string;
  feedSource: "auto" | "feed-api" | "mcp";
  lists: Collection[];
  pageSize: number;
  maxPages: number;
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
    apiUrl: env.ALPHAXIV_API_URL.replace(/\/+$/, ""),
    baseUrl: env.ALPHAXIV_BASE_URL.replace(/\/+$/, ""),
    feedSource: env.FEED_SOURCE,
    lists: parseLists(env.FEED_LISTS),
    pageSize: env.FEED_PAGE_SIZE,
    maxPages: env.FEED_MAX_PAGES,
    hotFeedLimit: env.HOT_FEED_LIMIT,
    cacheTtlMs: env.CACHE_TTL_SECONDS * 1000,
  };
  return cached;
}
