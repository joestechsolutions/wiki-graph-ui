import type { GraphData, GraphNode, GraphLink } from "./types";
import rawGraphData from "../../public/graphData.json";

/**
 * Loads and normalizes the graph data. Data is imported at build time from
 * public/graphData.json — no runtime fetch needed.
 */
export async function loadGraphData(): Promise<GraphData> {
  return normalize(rawGraphData as unknown as GraphData);
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

  // Drop links that dangle (endpoint not in the node set).
  const links: GraphLink[] = raw.links.filter(
    (l) => nodeIds.has(l.source) && nodeIds.has(l.target),
  );

  return { nodes, links, metadata: raw.metadata };
}

/** Adjacency map: node id -> set of directly connected node ids (undirected). */
export function buildAdjacency(links: GraphLink[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const l of links) {
    add(l.source, l.target);
    add(l.target, l.source);
  }
  return adj;
}

/** Node ids within `degree` hops of `start` (inclusive of start). */
export function neighborsWithin(
  start: string,
  degree: number,
  adj: Map<string, Set<string>>,
): Set<string> {
  const seen = new Set<string>([start]);
  let frontier = new Set<string>([start]);
  for (let d = 0; d < degree; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          next.add(nb);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

/** List of node ids that link TO the given node (backlink sources). */
export function backlinkSources(nodeId: string, links: GraphLink[]): string[] {
  const out = new Set<string>();
  for (const l of links) {
    if (l.target === nodeId) out.add(l.source);
    if (l.source === nodeId) out.add(l.target);
  }
  out.delete(nodeId);
  return [...out];
}
