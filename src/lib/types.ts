export type NodeType =
  | "project"
  | "area"
  | "resource"
  | "concept"
  | "system"
  | "tool"
  | "person"
  | "company"
  | "journal"
  | "hub"
  | "draft"
  | "task"
  | "decision"
  | "meeting"
  | "artifact";

export type NoteStatus = "draft" | "canonical" | "superseded";

export type ReviewedBy = "human" | "agent:reviewer" | "unreviewed";

export type Confidence = "high" | "medium" | "low";

export type RelationType =
  | "related_to"
  | "relates_to"
  | "depends_on"
  | "part_of"
  | "used_by"
  | "decided_by"
  | "mentions"
  | "contradicts"
  | "created_from"
  | "summarized_by"
  | "supersedes";

export interface FrontmatterRelations {
  depends_on?: string[];
  part_of?: string[];
  relates_to?: string[];
  supersedes?: string[];
}

export type NodeCategory =
  | "orchestrator"
  | "coding"
  | "memory"
  | "code-intel"
  | "skills"
  | "discipline"
  | "service"
  | "docker"
  | "llm"
  | "model"
  | "cron"
  | "skill"
  | "pipeline"
  | "knowledge";

export interface GraphNode {
  id: string;
  title: string;
  type: NodeType;
  summary: string;
  tags: string[];
  path: string;
  status: NoteStatus;
  created_at: string;
  updated_at: string;
  importance: number;
  recency: number;
  backlinks: number;
  frontmatter_relations: FrontmatterRelations;
  wikilinks: string[];
  preview: string;
  agent_generated: boolean;
  reviewed_by: ReviewedBy;
  confidence: Confidence;
  /** Agent-system view category. */
  category?: NodeCategory;
  /** Extra system info (ports, services, schedules, model providers…). */
  meta?: Record<string, unknown>;
}

export interface GraphLink {
  source: string;
  target: string;
  type: RelationType;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata?: Record<string, unknown>;
}

/**
 * Runtime shape after react-force-graph mutates links: source/target become
 * object references to the node they resolved to. We keep both possibilities.
 */
export type LinkEndpoint = string | GraphNode;

export interface ForceLink {
  source: LinkEndpoint;
  target: LinkEndpoint;
  type: RelationType;
}

export function endpointId(e: LinkEndpoint): string {
  return typeof e === "string" ? e : e.id;
}
