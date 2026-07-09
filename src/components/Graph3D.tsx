"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import ForceGraph3D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from "react-force-graph-3d";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";
import { endpointId } from "@/lib/types";
import { nodeColor, edgeStyle, categoryColor, categoryNodeVal } from "@/lib/theme";
import type { ForceSettings } from "@/lib/graphModes";
import { edgeKey } from "@/lib/pathfinding";

// NOTE: this component is loaded client-only (via next/dynamic in page.tsx);
// react-force-graph-3d touches `window` at module eval, so it must never SSR.

type FGNode = NodeObject<GraphNode>;
type FGLink = LinkObject<GraphNode, GraphLink>;

export interface Graph3DProps {
  data: GraphData;
  selectedId: string | null;
  hoverId: string | null;
  /** Nodes that stay bright; everything else dims. Empty = nothing dimmed. */
  highlightNodes: Set<string>;
  /** Undirected edge keys to emphasize. */
  highlightLinks: Set<string>;
  /** Ordered path node ids for path-tracing (drawn in accent). */
  pathNodes: Set<string>;
  pathLinks: Set<string>;
  forces: ForceSettings;
  labelThreshold: number;
  focusId: string | null;
  /** Bump to re-fly the camera even when focusId is unchanged. */
  focusNonce: number;
  onNodeClick: (node: GraphNode, event: MouseEvent) => void;
  onNodeHover: (node: GraphNode | null) => void;
  onBackgroundClick: () => void;
  /** Color nodes by category instead of type. */
  colorByCategory?: boolean;
  /** Pulse nodes with these ids (e.g. cron jobs). */
  pulseNodes?: Set<string>;
  /** Optional base node value accessor. Defaults to importance. */
  nodeVal?: (n: GraphNode) => number;
  /** Optional extra scale multiplier applied on top of nodeVal. */
  nodeValScale?: number;
  /** Optional halo size base used for draft/fresh halo (in category mode). */
  haloBaseSize?: number;
}

const DIM_OPACITY = 0.12;
const DIM_LINK_OPACITY = 0.04;

export default function Graph3D(props: Graph3DProps) {
  const {
    data,
    selectedId,
    hoverId,
    highlightNodes,
    highlightLinks,
    pathNodes,
    pathLinks,
    forces,
    labelThreshold,
    focusId,
    focusNonce,
    onNodeClick,
    onNodeHover,
    onBackgroundClick,
    colorByCategory,
    pulseNodes,
    nodeVal: nodeValProp,
    nodeValScale,
    haloBaseSize,
  } = props;

  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelSprites = useRef<Map<string, SpriteText>>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Keep the freshest highlight/label context reachable from stable callbacks.
  const ctx = useRef({
    highlightNodes,
    highlightLinks,
    pathNodes,
    pathLinks,
    hoverId,
    selectedId,
    labelThreshold,
  });
  ctx.current = {
    highlightNodes,
    highlightLinks,
    pathNodes,
    pathLinks,
    hoverId,
    selectedId,
    labelThreshold,
  };

  const dimming = highlightNodes.size > 0 || pathNodes.size > 0;

  // ---- Container sizing ---------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Force configuration ------------------------------------------------
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge");
    if (charge) charge.strength(forces.chargeStrength);
    const link = fg.d3Force("link");
    if (link) {
      link.distance(forces.linkDistance);
      link.strength(forces.linkStrength);
    }
    fg.d3ReheatSimulation();
  }, [forces, data]);

  // ---- Camera fly-to on focus --------------------------------------------
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !focusId) return;
    const target = data.nodes.find((n) => n.id === focusId) as FGNode | undefined;
    if (!target || target.x === undefined) return;
    const dist = 90;
    const { x = 0, y = 0, z = 0 } = target;
    const r = Math.hypot(x, y, z) || 1;
    const ratio = 1 + dist / r;
    fg.cameraPosition(
      { x: x * ratio, y: y * ratio, z: z * ratio },
      { x, y, z },
      900,
    );
  }, [focusId, focusNonce, data]);

  // ---- Label visibility (driven by highlight + zoom) ----------------------
  const refreshLabels = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera();
    const c = ctx.current;
    for (const [id, sprite] of labelSprites.current) {
      const node = sprite.userData.node as FGNode | undefined;
      let visible = c.highlightNodes.has(id) || c.pathNodes.has(id);
      if (!visible && c.hoverId === id) visible = true;
      if (!visible && c.selectedId === id) visible = true;
      if (!visible && !dimmingRef.current && node && node.x !== undefined) {
        const d = Math.hypot(
          cam.position.x - node.x,
          cam.position.y - (node.y ?? 0),
          cam.position.z - (node.z ?? 0),
        );
        visible = d < c.labelThreshold;
      }
      sprite.visible = visible;
    }
  }, []);
  const dimmingRef = useRef(dimming);
  dimmingRef.current = dimming;

  useEffect(() => {
    refreshLabels();
  }, [highlightNodes, pathNodes, hoverId, selectedId, labelThreshold, data, refreshLabels]);

  // Keep zoom-threshold labels responsive after the simulation cools down.
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const tick = () => {
      // throttle: refresh every 6th frame is plenty for label toggling
      if (frame++ % 6 === 0) refreshLabels();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [refreshLabels]);

  // ---- Node extra objects: label sprite + halo ---------------------------
  const nodeThreeObject = useCallback((n: FGNode) => {
    const node = n as GraphNode;
    const group = new THREE.Group();
    const color = colorByCategory ? categoryColor(node.category) : nodeColor(node.type);

    // Halo for drafts / freshly-updated notes, or pulsing category nodes.
    const isFresh = node.recency === 0;
    const isDraft = node.status === "draft";
    const shouldPulse = pulseNodes?.has(node.id);
    if (isDraft || isFresh || shouldPulse) {
      const size = haloBaseSize ?? 4 + (node.importance ?? 1) * 1.6;
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(size + 3, 16, 16),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(isDraft ? "#f59e0b" : color),
          transparent: true,
          opacity: shouldPulse ? 0.24 : 0.14,
          depthWrite: false,
        }),
      );
      group.add(halo);
    }

    const label = new SpriteText(node.title);
    label.color = "#e7e7ef";
    label.backgroundColor = "rgba(10,10,15,0.72)";
    label.padding = 2;
    label.borderRadius = 3;
    label.fontFace = "Inter, sans-serif";
    label.textHeight = 4;
    label.position.set(0, (node.importance ?? 1) * 1.6 + 8, 0);
    label.visible = false;
    label.userData.node = n;
    labelSprites.current.set(node.id, label);
    group.add(label);

    return group;
  }, [colorByCategory, pulseNodes, haloBaseSize]);

  // ---- Accessors ----------------------------------------------------------
  const getNodeColor = useCallback(
    (n: FGNode) => {
      const node = n as GraphNode;
      const base = colorByCategory ? categoryColor(node.category) : nodeColor(node.type);
      if (!dimming) return base;
      const lit = highlightNodes.has(node.id) || pathNodes.has(node.id);
      return lit ? base : withOpacity(base, DIM_OPACITY);
    },
    [dimming, highlightNodes, pathNodes, colorByCategory],
  );

  const getLinkColor = useCallback(
    (l: FGLink) => {
      const link = l as unknown as GraphLink;
      const sId = endpointId(l.source as never);
      const tId = endpointId(l.target as never);
      const key = edgeKey(sId, tId);
      const tint = nodeColor((typeof l.source === "object" ? (l.source as GraphNode).type : "concept"));
      const style = edgeStyle(link.type, tint);
      if (pathLinks.has(key)) return "#00d4aa";
      if (!dimming) return style.color;
      return highlightLinks.has(key)
        ? style.color
        : withOpacity("#4a5570", DIM_LINK_OPACITY);
    },
    [dimming, highlightLinks, pathLinks],
  );

  const getLinkWidth = useCallback(
    (l: FGLink) => {
      const link = l as unknown as GraphLink;
      const sId = endpointId(l.source as never);
      const tId = endpointId(l.target as never);
      const key = edgeKey(sId, tId);
      const style = edgeStyle(link.type, "#fff");
      if (pathLinks.has(key)) return style.width + 1.5;
      if (highlightLinks.has(key)) return style.width + 0.5;
      return style.width;
    },
    [highlightLinks, pathLinks],
  );

  const nodeVal = useCallback(
    (n: FGNode) => {
      const node = n as GraphNode;
      const val = nodeValProp ? nodeValProp(node) : categoryNodeVal(node.importance);
      return nodeValScale ? val * nodeValScale : val;
    },
    [nodeValProp, nodeValScale],
  );

  const handleNodeClick = useCallback(
    (n: FGNode, event: MouseEvent) => onNodeClick(n as GraphNode, event),
    [onNodeClick],
  );
  const handleNodeHover = useCallback(
    (n: FGNode | null) => onNodeHover((n as GraphNode) ?? null),
    [onNodeHover],
  );

  const nodeLabel = useCallback(
    (n: FGNode) => {
      const node = n as GraphNode;
      const sub = colorByCategory ? node.category : node.type;
      return `\u003cdiv class="graph-label"\u003e${escapeHtml(node.title)} \u003cspan style="color:#6b6b7b"\u003e· ${sub}\u003c/span\u003e\u003c/div\u003e`;
    },
    [colorByCategory],
  );

  const { width, height } = size;

  const graphKey = useMemo(() => data.nodes.map((n) => n.id).join(","), [data]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {width > 0 && (
        <ForceGraph3D
          ref={fgRef as never}
          key={graphKey}
          width={width}
          height={height}
          graphData={data as never}
          backgroundColor="#0a0a0f"
          showNavInfo={false}
          nodeRelSize={4}
          nodeVal={nodeVal as never}
          nodeColor={getNodeColor as never}
          nodeOpacity={0.92}
          nodeResolution={16}
          nodeThreeObjectExtend
          nodeThreeObject={nodeThreeObject as never}
          nodeLabel={nodeLabel as never}
          linkColor={getLinkColor as never}
          linkWidth={getLinkWidth as never}
          linkOpacity={0.55}
          linkDirectionalArrowLength={(l: FGLink) =>
            isDirected((l as unknown as GraphLink).type) ? 2.2 : 0
          }
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={(l: FGLink) =>
            pathLinks.has(pathKey(l)) ? 2 : 0
          }
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => "#00d4aa"}
          onNodeClick={handleNodeClick as never}
          onNodeHover={handleNodeHover as never}
          onBackgroundClick={onBackgroundClick}
          onEngineTick={refreshLabels}
          warmupTicks={40}
          cooldownTicks={120}
        />
      )}
    </div>
  );
}

// ---- helpers --------------------------------------------------------------

function pathKey(l: FGLink): string {
  return edgeKey(endpointId(l.source as never), endpointId(l.target as never));
}

function isDirected(type: GraphLink["type"]): boolean {
  return type === "depends_on" || type === "part_of" || type === "supersedes" || type === "used_by";
}

function withOpacity(hex: string, alpha: number): string {
  const c = new THREE.Color(hex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;",
  );
}
