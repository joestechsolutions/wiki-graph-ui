import type { GraphData, GraphNode, GraphLink } from "./types";
import rawSystemData from "../../public/systemData.json";
import { buildAdjacency, neighborsWithin, backlinkSources } from "./graphData";

export { buildAdjacency, neighborsWithin, backlinkSources };

/**
 * Loads and normalizes the agent system data. Data is imported at build time
 * from public/systemData.json — no runtime fetch needed.
 */
export async function loadSystemData(): Promise<GraphData> {
  return normalize(rawSystemData as unknown as GraphData);
}

function normalize(raw: GraphData): GraphData {
  const nodeIds = new Set(raw.nodes.map((n) => n.id));

  const nodes: GraphNode[] = raw.nodes.map((n) => ({
    ...n,
    tags: n.tags ?? [],
    wikilinks: n.wikilinks ?? [],
    frontmatter_relations: n.frontmatter_relations ?? {},
    importance: n.importance ?? 1,
    backlinks: n.backlinks ?? 0,
    recency: n.recency ?? 9999,
  }));

  const links: GraphLink[] = raw.links.filter(
    (l) => nodeIds.has(l.source) && nodeIds.has(l.target),
  );

  return { nodes, links, metadata: raw.metadata };
}