"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";
import { endpointId } from "@/lib/types";
import {
  loadGraphData,
  buildAdjacency,
  neighborsWithin,
  backlinkSources,
} from "@/lib/graphData";
import {
  defaultFilterState,
  nodePassesFilters,
  nodeMatchesSearch,
  type FilterState,
} from "@/lib/filters";
import {
  GRAPH_MODES,
  nodeInModeScope,
  type GraphMode,
} from "@/lib/graphModes";
import { shortestPath, pathEdgeKeys, edgeKey } from "@/lib/pathfinding";
import dynamic from "next/dynamic";
import CommandBar from "@/components/CommandBar";
import LeftSidebar from "@/components/LeftSidebar";
import RightPanel from "@/components/RightPanel";
import BottomTray from "@/components/BottomTray";

// react-force-graph-3d must not be server-rendered (touches `window`).
const Graph3D = dynamic(() => import("@/components/Graph3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-base-950">
      <div className="flex flex-col items-center gap-3 text-ink-faint">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent-teal" />
        <span className="text-xs">Initializing graph…</span>
      </div>
    </div>
  ),
});

interface PathState {
  anchor: string | null;
  nodes: string[] | null;
  hint: string | null;
}

export default function Page() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [mode, setMode] = useState<GraphMode>("overview");
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
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);

  // ---- Load data ----------------------------------------------------------
  useEffect(() => {
    loadGraphData()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    data?.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [data]);

  const fullAdj = useMemo(
    () => (data ? buildAdjacency(data.links) : new Map<string, Set<string>>()),
    [data],
  );

  // ---- Visible subgraph (mode scope + filters + neighborhood) -------------
  const visibleData: GraphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };

    let scope: Set<string> | null = null;
    if (mode === "neighborhood" && selectedId) {
      scope = neighborsWithin(selectedId, 2, fullAdj);
    }

    const visibleNodes = data.nodes.filter((n) => {
      if (scope && !scope.has(n.id)) return false;
      if (!nodeInModeScope(n, mode)) return false;
      if (!nodePassesFilters(n, filters)) return false;
      return true;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    // Fresh link copies: react-force-graph mutates source/target into node
    // object refs in place, which would corrupt our pristine string-keyed data.
    const visibleLinks: GraphLink[] = data.links
      .filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target))
      .map((l) => ({ source: l.source, target: l.target, type: l.type }));
    return { nodes: visibleNodes, links: visibleLinks, metadata: data.metadata };
  }, [data, mode, selectedId, filters, fullAdj]);

  // Adjacency over the *visible* graph, for highlight neighbor lookups.
  const visibleAdj = useMemo(
    () => buildAdjacency(visibleData.links),
    [visibleData],
  );

  // ---- Highlight sets -----------------------------------------------------
  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hn = new Set<string>();

    // Search spotlight
    if (filters.search.trim()) {
      for (const n of visibleData.nodes) {
        if (nodeMatchesSearch(n, filters.search)) hn.add(n.id);
      }
    }
    // Selection: 1st + 2nd degree
    if (selectedId) {
      for (const id of neighborsWithin(selectedId, 2, visibleAdj)) hn.add(id);
    }
    // Hover: 1st degree
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
  }, [filters.search, selectedId, hoverId, visibleData, visibleAdj]);

  const pathNodes = useMemo(
    () => new Set(path.nodes ?? []),
    [path.nodes],
  );
  const pathLinks = useMemo(
    () => (path.nodes ? pathEdgeKeys(path.nodes) : new Set<string>()),
    [path.nodes],
  );

  // ---- Interaction handlers ----------------------------------------------
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
            return {
              anchor: null,
              nodes: null,
              hint: `no path: ${a} ⇋ ${b}`,
            };
          }
          return {
            anchor: null,
            nodes: p,
            hint: `${a} → ${b} · ${p.length - 1} hops`,
          };
        });
        return;
      }
      // normal click
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

  const handleModeChange = useCallback((m: GraphMode) => {
    setMode(m);
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

  // ---- Render states ------------------------------------------------------
  if (error) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <div className="mb-2 text-sm font-semibold text-accent-amber">
            Failed to load graph data
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
          <span className="text-xs">Loading knowledge graph…</span>
        </div>
      </Centered>
    );
  }

  const modeDef = GRAPH_MODES[mode];

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-base-950">
      <CommandBar
        nodes={data.nodes}
        mode={mode}
        onModeChange={handleModeChange}
        onJumpTo={jumpTo}
        search={filters.search}
        onSearchChange={(q) => setFilters((f) => ({ ...f, search: q }))}
        pathHint={path.hint}
        onToggleSidebar={() => setMobileSidebar((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <LeftSidebar
          allNodes={data.nodes}
          visibleCount={visibleData.nodes.length}
          filters={filters}
          onFiltersChange={setFilters}
          mode={mode}
          mobileOpen={mobileSidebar}
          onMobileClose={() => setMobileSidebar(false)}
        />

        <main className="relative min-w-0 flex-1">
          {mode === "neighborhood" && !selectedId && (
            <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-lg border border-line bg-base-850/90 px-4 py-2 text-xs text-ink-muted backdrop-blur">
              Select a node to explore its neighborhood
            </div>
          )}
          {visibleData.nodes.length === 0 ? (
            <Centered>
              <p className="text-sm text-ink-faint">
                No notes match the current filters.
              </p>
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
              forces={modeDef.forces}
              labelThreshold={modeDef.labelThreshold}
              focusId={focus.id}
              focusNonce={focus.nonce}
              onNodeClick={handleNodeClick}
              onNodeHover={(n) => setHoverId(n?.id ?? null)}
              onBackgroundClick={handleBackgroundClick}
            />
          )}
        </main>

        <RightPanel
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
