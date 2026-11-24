import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { isValidPaperId } from "./ids";
import type { HotCandidate } from "./types";

const hotFeedSchema = z.object({
  papers: z.array(z.object({ universal_paper_id: z.string() })),
});

type ToolContent = { type: string; text?: string };

/** Pulls the tool's JSON payload from structuredContent or the first text block. */
export function readToolPayload(result: Record<string, unknown>): unknown {
  // Servers on very old protocol revisions return { toolResult } instead of content blocks.
  if ("toolResult" in result && !("content" in result)) return result.toolResult;
  const content = Array.isArray(result.content) ? (result.content as ToolContent[]) : [];
  const text = content.find((block) => block.type === "text" && typeof block.text === "string")?.text;
  if (result.isError) {
    throw new Error(`alphaXiv MCP tool error: ${text ?? "unknown error"}`);
  }
  if (result.structuredContent) return result.structuredContent;
  if (!text) throw new Error("alphaXiv MCP returned no content");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("alphaXiv MCP returned non-JSON content");
  }
}

/** Converts a get_hot_feed payload into ranked candidates. */
export function hotFeedToCandidates(payload: unknown, baseUrl: string): HotCandidate[] {
  const parsed = hotFeedSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Unexpected get_hot_feed response shape");
  const seen = new Set<string>();
  const candidates: HotCandidate[] = [];
  for (const { universal_paper_id: id } of parsed.data.papers) {
    if (!isValidPaperId(id) || seen.has(id)) continue;
    seen.add(id);
    candidates.push({
      id,
      rank: candidates.length + 1,
      url: `${baseUrl}/abs/${encodeURIComponent(id)}`,
    });
  }
  return candidates;
}

/**
 * Calls the alphaXiv MCP `get_hot_feed` tool over streamable HTTP with an API
 * key. The endpoint rejects browser cross-origin requests, so this only ever
 * runs on the server.
 */
export async function fetchHotFeedViaMcp(options: {
  mcpUrl: string;
  apiKey: string;
  limit: number;
  baseUrl: string;
  timeoutMs?: number;
}): Promise<HotCandidate[]> {
  const transport = new StreamableHTTPClientTransport(new URL(options.mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${options.apiKey}` } },
  });
  const client = new Client({ name: "alphaxiv-doomscroll", version: "0.1.0" });
  try {
    await client.connect(transport);
    const result = await client.callTool(
      { name: "get_hot_feed", arguments: { limit: options.limit } },
      undefined,
      { timeout: options.timeoutMs ?? 15_000 },
    );
    return hotFeedToCandidates(readToolPayload(result), options.baseUrl);
  } finally {
    await client.close().catch(() => undefined);
  }
}
