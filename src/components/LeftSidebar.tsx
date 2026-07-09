"use client";

import { useState } from "react";
import type { GraphNode, NodeType, NoteStatus } from "@/lib/types";
import { nodeColor } from "@/lib/theme";
import {
  type FilterState,
  type RecencyFilter,
  typeCounts,
} from "@/lib/filters";
import { GRAPH_MODES, type GraphMode } from "@/lib/graphModes";

interface LeftSidebarProps {
  allNodes: GraphNode[];
  visibleCount: number;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  mode: GraphMode;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const STATUSES: NoteStatus[] = ["draft", "canonical", "superseded"];
const RECENCY_OPTIONS: { value: RecencyFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "quarter", label: "Past quarter" },
];

export default function LeftSidebar({
  allNodes,
  visibleCount,
  filters,
  onFiltersChange,
  mode,
  mobileOpen,
  onMobileClose,
}: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const counts = typeCounts(allNodes);

  const toggleType = (t: NodeType) => {
    const next = new Set(filters.types);
    next.has(t) ? next.delete(t) : next.add(t);
    onFiltersChange({ ...filters, types: next });
  };
  const toggleStatus = (s: NoteStatus) => {
    const next = new Set(filters.statuses);
    next.has(s) ? next.delete(s) : next.add(s);
    onFiltersChange({ ...filters, statuses: next });
  };
  const reset = () =>
    onFiltersChange({
      types: new Set(),
      statuses: new Set(),
      recency: "all",
      search: filters.search,
    });

  const hasFilters =
    filters.types.size > 0 ||
    filters.statuses.size > 0 ||
    filters.recency !== "all";

  if (collapsed) {
    return (
      <aside className="hidden w-11 shrink-0 flex-col items-center gap-3 border-r border-line bg-base-900/60 py-3 lg:flex">
        <button
          onClick={() => setCollapsed(false)}
          className="btn !px-2"
          title="Expand filters"
        >
          <FilterIcon />
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`${
          mobileOpen ? "fixed" : "hidden"
        } inset-y-0 left-0 z-50 w-72 max-w-[85vw] shrink-0 flex-col border-r border-line bg-base-900/95 backdrop-blur-xl lg:static lg:z-0 lg:flex lg:w-64 lg:bg-base-900/60 lg:backdrop-blur-none ${
          mobileOpen ? "flex" : ""
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Filters
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(true)}
              className="hidden text-ink-faint transition-colors hover:text-ink lg:block"
              title="Collapse"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={onMobileClose}
              className="text-ink-faint transition-colors hover:text-ink lg:hidden"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {/* Active mode context */}
        <section>
          <SectionLabel>Active mode</SectionLabel>
          <div className="rounded-lg border border-line bg-base-850 p-2.5">
            <div className="text-sm font-medium text-ink">
              {GRAPH_MODES[mode].label}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
              {GRAPH_MODES[mode].description}
            </p>
          </div>
        </section>

        {/* Node types */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel className="mb-0">Note types</SectionLabel>
            <span className="font-mono text-[10px] text-ink-faint">
              {visibleCount}/{allNodes.length}
            </span>
          </div>
          <div className="space-y-1">
            {counts.map(({ type, count }) => {
              const active = filters.types.has(type);
              const anyActive = filters.types.size > 0;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-all duration-200 ${
                    active
                      ? "bg-white/[0.06]"
                      : "hover:bg-white/[0.03]"
                  } ${anyActive && !active ? "opacity-40" : ""}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: nodeColor(type) }}
                  />
                  <span className="text-sm capitalize text-ink">{type}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-faint">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Status */}
        <section>
          <SectionLabel>Status</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const active = filters.statuses.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`chip capitalize ${
                    active
                      ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                      : "border-line-soft text-ink-muted hover:text-ink"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>

        {/* Recency */}
        <section>
          <SectionLabel>Last updated</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {RECENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  onFiltersChange({ ...filters, recency: opt.value })
                }
                className={`rounded-md border px-2 py-1.5 text-xs transition-all duration-200 ${
                  filters.recency === opt.value
                    ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                    : "border-line-soft text-ink-muted hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {hasFilters && (
          <button
            onClick={reset}
            className="btn w-full justify-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-line px-4 py-3">
        <SectionLabel>Edge relations</SectionLabel>
        <ul className="space-y-1.5 text-[11px] text-ink-muted">
          <LegendRow color="#e7e7ef" label="depends_on" width={2.5} />
          <LegendRow color="#e7e7ef" label="part_of" width={1.5} />
          <LegendRow color="#4a5570" label="relates_to" width={1} />
          <LegendRow color="#ef4444" label="contradicts" width={1.5} dashed />
        </ul>
      </div>
    </aside>
    </>
  );
}

function LegendRow({
  color,
  label,
  width,
  dashed,
}: {
  color: string;
  label: string;
  width: number;
  dashed?: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <svg width="26" height="8" className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="26"
          y2="4"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dashed ? "3 2" : undefined}
        />
      </svg>
      <span className="font-mono">{label}</span>
    </li>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint ${className}`}
    >
      {children}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 5h18M6 12h12M10 19h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="m15 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
