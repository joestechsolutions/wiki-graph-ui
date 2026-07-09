import type { NodeType, RelationType, NoteStatus } from "./types";

/** Node colors by type (from the design spec, extended to cover all types). */
export const NODE_COLORS: Record<NodeType, string> = {
  tool: "#00d4aa",
  concept: "#7c8aff",
  hub: "#ffaa3d",
  system: "#6b7280",
  journal: "#a78bfa",
  draft: "#f59e0b",
  project: "#ef4444",
  artifact: "#9ca3af",
  // sensible extensions for the remaining declared types
  area: "#34d399",
  resource: "#22d3ee",
  person: "#f472b6",
  company: "#fb7185",
  task: "#facc15",
  decision: "#c084fc",
  meeting: "#38bdf8",
};

export function nodeColor(type: NodeType): string {
  return NODE_COLORS[type] ?? "#9ca3af";
}

export interface EdgeStyle {
  color: string;
  width: number;
  dashed: boolean;
}

/**
 * Edge styling by relation type. `nodeTint` lets relations that inherit the
 * source node's color (depends_on, part_of) pick it up at draw time.
 */
export function edgeStyle(type: RelationType, nodeTint: string): EdgeStyle {
  switch (type) {
    case "depends_on":
      return { color: nodeTint, width: 2, dashed: false };
    case "part_of":
      return { color: nodeTint, width: 1.5, dashed: false };
    case "contradicts":
      return { color: "#ef4444", width: 1.5, dashed: true };
    case "supersedes":
      return { color: "#ffaa3d", width: 2, dashed: false };
    case "related_to":
    case "relates_to":
    default:
      return { color: "#4a5570", width: 1, dashed: false };
  }
}

export const STATUS_STYLES: Record<NoteStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-accent-amber/40 text-accent-amber bg-accent-amber/10" },
  canonical: { label: "Canonical", className: "border-accent-teal/40 text-accent-teal bg-accent-teal/10" },
  superseded: { label: "Superseded", className: "border-ink-faint/40 text-ink-faint bg-white/5" },
};
