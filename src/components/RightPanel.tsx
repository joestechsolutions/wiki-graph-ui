"use client";

import { useMemo, useState } from "react";
import type { GraphNode } from "@/lib/types";
import { nodeColor, STATUS_STYLES } from "@/lib/theme";
import { renderMarkdown } from "@/lib/markdown";

interface RightPanelProps {
  node: GraphNode | null;
  nodeById: Map<string, GraphNode>;
  backlinkIds: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const OBSIDIAN_VAULT = "wiki";

export default function RightPanel({
  node,
  nodeById,
  backlinkIds,
  onNavigate,
  onClose,
  mobileOpen,
  onMobileClose,
}: RightPanelProps) {
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
  const [promoted, setPromoted] = useState(false);
  const color = nodeColor(node.type);
  const status = STATUS_STYLES[node.status];

  const relations = useMemo(() => {
    const r = node.frontmatter_relations ?? {};
    const groups: { label: string; ids: string[] }[] = [
      { label: "depends on", ids: r.depends_on ?? [] },
      { label: "part of", ids: r.part_of ?? [] },
      { label: "relates to", ids: r.relates_to ?? [] },
      { label: "supersedes", ids: r.supersedes ?? [] },
    ];
    return groups.filter((g) => g.ids.length > 0);
  }, [node]);

  const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(
    OBSIDIAN_VAULT,
  )}&file=${encodeURIComponent(node.path)}`;

  const previewHtml = useMemo(
    () => renderMarkdown(node.preview.slice(0, 500)),
    [node.preview],
  );

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
                {node.type}
              </span>
              <span className={`chip ${status.className}`}>{status.label}</span>
            </div>
            <h1 className="text-lg font-semibold leading-tight text-ink">
              {node.title}
            </h1>
            <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">
              {node.path}
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

        {/* provenance chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <MetaChip
            label={node.agent_generated ? "agent-generated" : "human-authored"}
            tone={node.agent_generated ? "peri" : "teal"}
          />
          <MetaChip label={`reviewed: ${node.reviewed_by}`} tone="neutral" />
          <MetaChip label={`confidence: ${node.confidence}`} tone="neutral" />
        </div>
      </div>

      {/* Scroll body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {node.summary && (
          <Section title="Summary">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {node.summary}
            </p>
          </Section>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Backlinks" value={node.backlinks} />
          <Stat label="Importance" value={`${node.importance}/5`} />
          <Stat
            label="Recency"
            value={node.recency >= 9999 ? "—" : `${node.recency}d`}
          />
        </div>

        {node.tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-ink-muted"
                >
                  #{t}
                </span>
              ))}
            </div>
          </Section>
        )}

        {relations.length > 0 && (
          <Section title="Relations">
            <div className="space-y-2.5">
              {relations.map((g) => (
                <div key={g.label}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                    {g.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {g.ids.map((id) => (
                      <RelationLink
                        key={id}
                        id={id}
                        target={nodeById.get(id)}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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

        <Section title="Preview">
          <div
            className="markdown space-y-2 text-[13px] leading-relaxed text-ink-muted"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Section>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-line px-5 py-3">
        <a
          href={obsidianUrl}
          className="btn w-full justify-center !py-2 !text-[13px]"
        >
          <ObsidianIcon />
          Open in Obsidian
        </a>

        {node.status === "draft" && (
          <button
            onClick={() => setPromoted(true)}
            disabled={promoted}
            className={`w-full rounded-md border px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
              promoted
                ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                : "border-accent-amber/40 bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/15"
            }`}
          >
            {promoted
              ? "✓ Would promote to canonical (preview)"
              : "Promote to Canonical"}
          </button>
        )}
        {node.status === "draft" && promoted && (
          <p className="text-center text-[10px] leading-snug text-ink-faint">
            Preview only — no write performed. Would set{" "}
            <span className="font-mono">status: canonical</span> in{" "}
            {node.path}.
          </p>
        )}
      </div>
    </aside>
    </>
  );
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
        style={{ backgroundColor: target ? nodeColor(target.type) : "#4a5570" }}
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-base-850 px-2 py-2 text-center">
      <div className="text-base font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-ink-faint">
        {label}
      </div>
    </div>
  );
}

function MetaChip({
  label,
  tone,
}: {
  label: string;
  tone: "teal" | "peri" | "neutral";
}) {
  const tones = {
    teal: "text-accent-teal bg-accent-teal/10",
    peri: "text-accent-peri bg-accent-peri/10",
    neutral: "text-ink-faint bg-white/[0.04]",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${tones[tone]}`}
    >
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

function ObsidianIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 4 8v8l8 6 8-6V8l-8-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
