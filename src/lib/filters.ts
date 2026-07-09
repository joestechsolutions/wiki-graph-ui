import type { GraphNode, NodeType, NoteStatus } from "./types";

export type RecencyFilter = "all" | "week" | "month" | "quarter";

export interface FilterState {
  types: Set<NodeType>; // empty = all visible
  statuses: Set<NoteStatus>; // empty = all visible
  recency: RecencyFilter;
  search: string;
}

export function defaultFilterState(): FilterState {
  return {
    types: new Set(),
    statuses: new Set(),
    recency: "all",
    search: "",
  };
}

const RECENCY_DAYS: Record<RecencyFilter, number> = {
  all: Infinity,
  week: 7,
  month: 30,
  quarter: 90,
};

/** Does a single node pass the current filters (search excluded)? */
export function nodePassesFilters(node: GraphNode, f: FilterState): boolean {
  if (f.types.size > 0 && !f.types.has(node.type)) return false;
  if (f.statuses.size > 0 && !f.statuses.has(node.status)) return false;
  if (node.recency > RECENCY_DAYS[f.recency]) return false;
  return true;
}

/** Free-text match across title, summary, tags, path, preview. */
export function nodeMatchesSearch(node: GraphNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    node.title,
    node.summary,
    node.path,
    node.type,
    node.preview,
    ...node.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export interface TypeCount {
  type: NodeType;
  count: number;
}

export function typeCounts(nodes: GraphNode[]): TypeCount[] {
  const counts = new Map<NodeType, number>();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
