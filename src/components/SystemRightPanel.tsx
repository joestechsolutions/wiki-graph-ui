"use client";

import { useMemo, useState } from "react";
import type { GraphNode } from "@/lib/types";
import { categoryColor, categoryNodeVal } from "@/lib/theme";

interface SystemRightPanelProps {
  node: GraphNode | null;
  nodeById: Map<string, GraphNode>;
  backlinkIds: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function SystemRightPanel({
  node,
  nodeById,
  backlinkIds,
  onNavigate,
  onClose,
  mobileOpen,
  onMobileClose,
}: SystemRightPanelProps) {
  if (!node) return null;
  return (
    <PanelBody
      key={node.id}
      node={node}
      nodeById={nodeById}
      backlinkIds={backlinkIds}
      onNavigate={onNavigate}
      onClose={onClose}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    />
  );
}

function PanelBody({
  node,
  nodeById,
  backlinkIds,
  onNavigate,
  onClose,
  mobileOpen,
  onMobileClose,
}: {
  node: GraphNode;
  nodeById: Map<string, GraphNode>;
  backlinkIds: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const color = categoryColor(node.category);
  const sizeHint = categoryNodeVal(node.importance).toFixed(1);
  const meta = useMemo(
    () => (node.meta ? Object.entries(node.meta) : []),
    [node.meta],
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`${
          mobileOpen ? "fixed" : "hidden"
        } inset-y-0 right-0 z-50 w-[340px] max-w-[85vw] shrink-0 flex-col border-l border-line bg-base-900/95 backdrop-blur-xl slide-in-right lg:static lg:z-0 lg:flex lg:w-[360px] lg:bg-base-900/70 ${
          mobileOpen ? "flex" : ""
        }`}
      >
        {/* Header */}
        <div className="relative border-b border-line px-5 pb-4 pt-4">
          <div
            className="absolute left-0 top-0 h-1 w-full opacity-80"
            style={{
              background: `linear-gradient(90deg, ${color}, transparent)`,
            }}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span
                  className="chip border-transparent"
                  style={{ backgroundColor: `${color}1f`, color }}
                >
                  {node.category ?? "unknown"}
                </span>
                <span className="chip border-ink-faint/40 text-ink-faint bg-white/5">
                  size {sizeHint}
                </span>
              </div>
              <h1 className="text-lg font-semibold leading-tight text-ink">
                {node.title}
              </h1>
              <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">
                {node.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-white/5 hover:text-ink"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaChip label={`importance: ${node.importance}/5`} tone="teal" />
            <MetaChip label={`status: ${node.status}`} tone="neutral" />
          </div>
        </div>

        {/* Scroll body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {node.summary && (
            <Section title="Summary">
              <p className="text-[13px] leading-relaxed text-ink-muted">{node.summary}</p>
            </Section>
          )}

          {meta.length > 0 && (
            <Section title="Meta">
              <dl className="space-y-2">
                {meta.map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-base-850 px-3 py-2">
                    <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {k}
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-[12px] text-ink">
                      {formatMetaValue(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {backlinkIds.length > 0 && (
            <Section title={`Connected (${backlinkIds.length})`}>
              <div className="flex flex-col gap-1">
                {backlinkIds.map((id) => (
                  <RelationLink
                    key={id}
                    id={id}
                    target={nodeById.get(id)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </aside>
    </>
  );
}

function formatMetaValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function RelationLink({
  id,
  target,
  onNavigate,
}: {
  id: string;
  target: GraphNode | undefined;
  onNavigate: (id: string) => void;
}) {
  const missing = !target;
  return (
    <button
      onClick={() => target && onNavigate(id)}
      disabled={missing}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        missing ? "cursor-default opacity-40" : "hover:bg-white/[0.04]"
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: target ? categoryColor(target.category) : "#4a5570",
        }}
      />
      <span className="truncate text-[13px] text-ink group-hover:text-white">
        {target ? target.title : id}
      </span>
      {!missing && (
        <span className="ml-auto shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5">
          <ArrowRight />
        </span>
      )}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetaChip({
  label,
  tone,
}: {
  label: string;
  tone: "teal" | "neutral";
}) {
  const tones = {
    teal: "text-accent-teal bg-accent-teal/10",
    neutral: "text-ink-faint bg-white/[0.04]",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${tones[tone]}`}>
      {label}
    </span>
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

function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
