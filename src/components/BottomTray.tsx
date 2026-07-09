"use client";

import type { GraphNode } from "@/lib/types";

interface BottomTrayProps {
  nodes: GraphNode[];
  visibleCount: number;
  linkCount: number;
  hoverNode: GraphNode | null;
  metadata?: Record<string, unknown>;
}

export default function BottomTray({
  nodes,
  visibleCount,
  linkCount,
  hoverNode,
  metadata,
}: BottomTrayProps) {
  const drafts = nodes.filter((n) => n.status === "draft").length;
  const agentNodes = nodes.filter((n) => n.agent_generated).length;
  const unreviewed = nodes.filter((n) => n.reviewed_by === "unreviewed").length;
  const generatedAt =
    typeof metadata?.generated_at === "string"
      ? (metadata.generated_at as string)
      : null;

  return (
    <footer className="z-20 flex h-8 items-center gap-3 border-t border-line bg-base-900/80 px-3 font-mono text-[11px] text-ink-faint backdrop-blur-xl sm:gap-4 sm:px-4">
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-teal" />
        synced
      </span>
      <Divider />
      <span className="shrink-0">
        <span className="text-ink-muted">{visibleCount}</span>/{nodes.length}{" "}
        <span className="hidden sm:inline">nodes</span>
      </span>
      <span className="hidden shrink-0 sm:inline">
        <span className="text-ink-muted">{linkCount}</span> edges
      </span>
      <Divider />
      <span className="hidden shrink-0 sm:flex sm:items-center">
        <span className="text-accent-amber">{drafts}</span> drafts
      </span>
      <span className="hidden shrink-0 md:flex md:items-center">
        <span className="text-accent-peri">{agentNodes}</span> agent
      </span>
      <span className="hidden shrink-0 md:inline">
        <span className="text-ink-muted">{unreviewed}</span> unreviewed
      </span>

      {/* Right side: hover readout / timestamp */}
      <div className="ml-auto flex min-w-0 items-center gap-4 truncate">
        {hoverNode ? (
          <span className="truncate text-ink-muted">
            <span className="text-ink-faint">hover:</span> {hoverNode.title}
            <span className="hidden text-ink-faint sm:inline"> · {hoverNode.path}</span>
          </span>
        ) : (
          generatedAt && (
            <span className="hidden sm:inline">
              <span className="text-ink-faint">synced:</span> {generatedAt}
            </span>
          )
        )}
      </div>
    </footer>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-line" />;
}
