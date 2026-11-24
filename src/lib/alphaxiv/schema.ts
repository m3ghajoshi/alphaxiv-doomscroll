import { z } from "zod";

const interactionCounter = z.object({
  interactionType: z
    .union([z.string(), z.object({ "@type": z.string().optional(), url: z.string().optional() })])
    .optional(),
  userInteractionCount: z.coerce.number().optional(),
});

export const personSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  affiliation: z
    .union([z.string(), z.object({ name: z.string().optional() })])
    .optional(),
});

export const articleSchema = z.object({
  "@type": z.string(),
  headline: z.string(),
  url: z.string(),
  description: z.string().optional(),
  abstract: z.string().optional(),
  datePublished: z.string().optional(),
  discussionUrl: z.string().optional(),
  author: z.array(personSchema).optional(),
  interactionStatistic: z.array(interactionCounter).optional(),
});

export type JsonLdArticle = z.infer<typeof articleSchema>;
export type JsonLdPerson = z.infer<typeof personSchema>;

/** Reads a schema.org interaction count (e.g. "ViewAction", "LikeAction"). */
export function interactionCount(
  article: Pick<JsonLdArticle, "interactionStatistic">,
  action: "ViewAction" | "LikeAction" | "CommentAction",
): number | null {
  for (const counter of article.interactionStatistic ?? []) {
    const type = counter.interactionType;
    const name = typeof type === "string" ? type : (type?.["@type"] ?? type?.url ?? "");
    if (name.endsWith(action) && typeof counter.userInteractionCount === "number") {
      return counter.userInteractionCount;
    }
  }
  return null;
}

/** Flattens a JSON-LD block (which may use @graph) into its nodes. */
export function jsonLdNodes(block: unknown): Record<string, unknown>[] {
  if (!block || typeof block !== "object") return [];
  if (Array.isArray(block)) return block.flatMap(jsonLdNodes);
  const record = block as Record<string, unknown>;
  const graph = record["@graph"];
  return Array.isArray(graph) ? graph.flatMap(jsonLdNodes) : [record];
}
