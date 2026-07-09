"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";
import { endpointId } from "@/lib/types";
import {
  loadSystemData,
  buildAdjacency,
  neighborsWithin,
  backlinkSources,
} from "@/lib/systemData";
import { shortestPath, pathEdgeKeys, edgeKey } from "@/lib/pathfinding";
import dynamic from "next/dynamic";
import CommandBar from "@/components/CommandBar";
import SystemRightPanel from "@/components/SystemRightPanel";
import BottomTray from "@/components/BottomTray";

const Graph3D = dynamic(() => import("@/components/Graph3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-base-950">
      <div className="flex flex-col items-center gap-3 text-ink-faint">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent-teal" />
        <span className="text-xs">Initializing system graph…</span>
      </div>
    </div>
  ),
});

interface PathState {
  anchor: string | null;
  nodes: string[] | null;
  hint: string | null;
}

const SYSTEM_FORCES = {
  chargeStrength: -180,
  linkDistance: 50,
  linkStrength: 0.7,
} as const;

const LABEL_THRESHOLD = 320;

export default function SystemPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({
    id: null,
    nonce: 0,
  });
  const [path, setPath] = useState<PathState>({
    anchor: null,
    nodes: null,
    hint: null,
  });
  const [mobilePanel, setMobilePanel] = useState(false);

  useEffect(() => {
    loadSystemData()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    data?.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [data]);

  const fullAdj = useMemo(
    () => (data ? buildAdjacency(data.links) : new Map()),
    [data],
  );

  // Visible data drops dangling links just in case.
  const visibleData: GraphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const ids = new Set(data.nodes.map((n) => n.id));
    const links: GraphLink[] = data.links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ source: l.source, target: l.target, type: l.type }));
    return { nodes: data.nodes, links, metadata: data.metadata };
  }, [data]);

  const visibleAdj = useMemo(
    () => buildAdjacency(visibleData.links),
    [visibleData],
  );

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hn = new Set<string>();

    if (selectedId) {
      for (const id of neighborsWithin(selectedId, 2, visibleAdj)) hn.add(id);
    }
    if (hoverId) {
      for (const id of neighborsWithin(hoverId, 1, visibleAdj)) hn.add(id);
    }

    const hl = new Set<string>();
    if (hn.size > 0) {
      for (const l of visibleData.links) {
        const s = endpointId(l.source);
        const t = endpointId(l.target);
        if (hn.has(s) && hn.has(t)) hl.add(edgeKey(s, t));
      }
    }
    return { highlightNodes: hn, highlightLinks: hl };
  }, [selectedId, hoverId, visibleData, visibleAdj]);

  const pathNodes = useMemo(
    () => new Set(path.nodes ?? []),
    [path.nodes],
  );
  const pathLinks = useMemo(
    () => (path.nodes ? pathEdgeKeys(path.nodes) : new Set<string>()),
    [path.nodes],
  );

  const jumpTo = useCallback((id: string) => {
    setSelectedId(id);
    setFocus((f) => ({ id, nonce: f.nonce + 1 }));
    setPath({ anchor: null, nodes: null, hint: null });
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      if (event.shiftKey) {
        setPath((prev) => {
          if (!prev.anchor || prev.anchor === node.id) {
            const anchorNode = nodeById.get(node.id);
            return {
              anchor: node.id,
              nodes: null,
              hint: `path from “${anchorNode?.title ?? node.id}” — shift-click a target`,
            };
          }
          const p = shortestPath(prev.anchor, node.id, fullAdj);
          const a = nodeById.get(prev.anchor)?.title ?? prev.anchor;
          const b = nodeById.get(node.id)?.title ?? node.id;
          if (!p) {
            return { anchor: null, nodes: null, hint: `no path: ${a} ⇋ ${b}` };
          }
          return {
            anchor: null,
            nodes: p,
            hint: `${a} → ${b} · ${p.length - 1} hops`,
          };
        });
        return;
      }
      setPath({ anchor: null, nodes: null, hint: null });
      setSelectedId(node.id);
      setFocus((f) => ({ id: node.id, nonce: f.nonce + 1 }));
      setMobilePanel(true);
    },
    [fullAdj, nodeById],
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedId(null);
    setPath({ anchor: null, nodes: null, hint: null });
  }, []);

  const handleJumpTo = useCallback((id: string) => {
    jumpTo(id);
    setMobilePanel(true);
  }, [jumpTo]);

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;
  const hoverNode = hoverId ? nodeById.get(hoverId) ?? null : null;
  const backlinkIds = useMemo(
    () => (selectedId && data ? backlinkSources(selectedId, data.links) : []),
    [selectedId, data],
  );

  const cronIds = useMemo(() => {
    const set = new Set<string>();
    if (!data) return set;
    for (const n of data.nodes) {
      if (n.category === "cron") set.add(n.id);
    }
    return set;
  }, [data]);

  if (error) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <div className="mb-2 text-sm font-semibold text-accent-amber">
            Failed to load system data
          </div>
          <p className="font-mono text-xs text-ink-faint">{error}</p>
        </div>
      </Centered>
    );
  }
  if (!data) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-ink-faint">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent-teal" />
          <span className="text-xs">Loading agent system…</span>
        </div>
      </Centered>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-base-950">
      <CommandBar
        view="system"
        nodes={data.nodes}
        onJumpTo={jumpTo}
        pathHint={path.hint}
        onToggleSidebar={() => {}}
      />

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {visibleData.nodes.length === 0 ? (
            <Centered>
              <p className="text-sm text-ink-faint">No system nodes loaded.</p>
            </Centered>
          ) : (
            <Graph3D
              data={visibleData}
              selectedId={selectedId}
              hoverId={hoverId}
              highlightNodes={highlightNodes}
              highlightLinks={highlightLinks}
              pathNodes={pathNodes}
              pathLinks={pathLinks}
              forces={SYSTEM_FORCES}
              labelThreshold={LABEL_THRESHOLD}
              focusId={focus.id}
              focusNonce={focus.nonce}
              onNodeClick={handleNodeClick}
              onNodeHover={(n) => setHoverId(n?.id ?? null)}
              onBackgroundClick={handleBackgroundClick}
              colorByCategory
              pulseNodes={cronIds}
              nodeVal={(n) => 1 + (n.importance ?? 1) * 1.4}
              nodeValScale={1.2}
            />
          )}
        </main>

        <SystemRightPanel
          node={selectedNode}
          nodeById={nodeById}
          backlinkIds={backlinkIds}
          onNavigate={handleJumpTo}
          onClose={() => { setSelectedId(null); setMobilePanel(false); }}
          mobileOpen={mobilePanel}
          onMobileClose={() => setMobilePanel(false)}
        />
      </div>

      <BottomTray
        nodes={data.nodes}
        visibleCount={visibleData.nodes.length}
        linkCount={visibleData.links.length}
        hoverNode={hoverNode}
        metadata={data.metadata}
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full w-full place-items-center bg-base-950">
      {children}
    </div>
  );
}
