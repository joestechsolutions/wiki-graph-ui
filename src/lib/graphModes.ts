import type { GraphNode, NodeType } from "./types";

export type GraphMode = "overview" | "neighborhood" | "drafts" | "timeline";

export interface ForceSettings {
  chargeStrength: number; // node repulsion (negative)
  linkDistance: number;
  linkStrength: number;
}

export interface ModeDefinition {
  id: GraphMode;
  label: string;
  description: string;
  /** Requires a selected node to be meaningful. */
  needsSelection: boolean;
  forces: ForceSettings;
  labelThreshold: number; // camera distance below which labels appear
}

export const GRAPH_MODES: Record<GraphMode, ModeDefinition> = {
  overview: {
    id: "overview",
    label: "Overview",
    description: "Full graph, all types, balanced forces",
    needsSelection: false,
    forces: { chargeStrength: -160, linkDistance: 55, linkStrength: 0.6 },
    labelThreshold: 340,
  },
  neighborhood: {
    id: "neighborhood",
    label: "Neighborhood",
    description: "Local graph, 2 degrees around the selected note",
    needsSelection: true,
    forces: { chargeStrength: -220, linkDistance: 45, linkStrength: 0.8 },
    labelThreshold: 600,
  },
  drafts: {
    id: "drafts",
    label: "Drafts",
    description: "Draft notes and their connections, for review",
    needsSelection: false,
    forces: { chargeStrength: -140, linkDistance: 60, linkStrength: 0.5 },
    labelThreshold: 600,
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    description: "Journal and log notes arranged by recency",
    needsSelection: false,
    forces: { chargeStrength: -120, linkDistance: 40, linkStrength: 0.4 },
    labelThreshold: 9999,
  },
};

export const MODE_ORDER: GraphMode[] = ["overview", "neighborhood", "drafts", "timeline"];

/** Node types the timeline mode considers "temporal". */
const TIMELINE_TYPES: NodeType[] = ["journal", "meeting", "task", "decision"];

/**
 * Whether a node is part of a mode's base scope, ignoring selection-based
 * neighborhood expansion (which the page handles with adjacency).
 */
export function nodeInModeScope(
  node: GraphNode,
  mode: GraphMode,
): boolean {
  switch (mode) {
    case "drafts":
      return node.status === "draft";
    case "timeline":
      return TIMELINE_TYPES.includes(node.type);
    case "overview":
    case "neighborhood":
    default:
      return true;
  }
}
