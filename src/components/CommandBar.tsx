"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode } from "@/lib/types";
import { nodeColor, categoryColor } from "@/lib/theme";
import { GRAPH_MODES, MODE_ORDER, type GraphMode } from "@/lib/graphModes";
import { nodeMatchesSearch } from "@/lib/filters";

interface CommandBarProps {
  view?: "wiki" | "system";
  nodes: GraphNode[];
  mode?: GraphMode;
  onModeChange?: (m: GraphMode) => void;
  onJumpTo: (id: string) => void;
  search?: string;
  onSearchChange?: (q: string) => void;
  pathHint: string | null;
  onToggleSidebar?: () => void;
}

export default function CommandBar({
  view = "wiki",
  nodes,
  mode,
  onModeChange,
  onJumpTo,
  search = "",
  onSearchChange,
  pathHint,
  onToggleSidebar,
}: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    return nodes.filter((n) => nodeMatchesSearch(n, search)).slice(0, 8);
  }, [nodes, search]);

  useEffect(() => setActive(0), [search]);

  // Cmd/Ctrl-K focuses the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (n: GraphNode) => {
    onJumpTo(n.id);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <header className="relative z-30 flex h-14 items-center gap-3 border-b border-line bg-base-900/70 px-3 backdrop-blur-xl sm:px-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onToggleSidebar}
        className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
        title="Filters"
      >
        <HamburgerIcon />
      </button>
      <div className="flex items-center gap-2.5 pr-1 sm:pr-2">
        <div className="h-4 w-4 shrink-0 rounded-[5px] bg-gradient-to-br from-accent-teal to-accent-peri" />
        <span className="text-sm font-semibold tracking-tight text-ink">
          {view === "system" ? "Agent System" : "Wiki Graph"}
        </span>
        <span className="hidden font-mono text-[10px] text-ink-faint sm:inline">
          {view === "system" ? "system topology" : "knowledge cockpit"}
        </span>
      </div>

      {/* View switcher */}
      <nav className="hidden items-center gap-1 rounded-lg border border-line bg-base-850 p-1 sm:flex">
        <a
          href="/"
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
            view === "wiki"
              ? "bg-accent-teal/15 text-accent-teal"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Wiki Graph
        </a>
        <a
          href="/system/"
          className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
            view === "system"
              ? "bg-accent-teal/15 text-accent-teal"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Agent System
        </a>
      </nav>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-base-850 px-3 py-1.5 focus-within:border-accent-teal/50">
          <SearchIcon />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onInputKey}
            placeholder={view === "system" ? "Search system nodes…" : "Search notes, tags, content…"}
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="hidden rounded border border-line-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:inline">
            ⌘K
          </kbd>
        </div>

        {open && results.length > 0 && (
          <ul className="fade-in absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-line bg-base-850 shadow-2xl shadow-black/50">
            {results.map((n, i) => (
              <li key={n.id}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(n);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-white/[0.05]" : ""
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        view === "system"
                          ? n.category
                            ? categoryColor(n.category)
                            : "#9ca3af"
                          : nodeColor(n.type),
                    }}
                  />
                  <span className="truncate text-sm text-ink">{n.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">
                    {view === "system" ? n.category : n.type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mode switcher */}
      {mode && onModeChange && (
        <nav className="ml-auto flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg border border-line bg-base-850 p-1 sm:overflow-visible">
          {MODE_ORDER.map((m) => {
            const def = GRAPH_MODES[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                title={def.description}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ease-smooth ${
                  isActive
                    ? "bg-accent-teal/15 text-accent-teal"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {def.label}
              </button>
            );
          })}
        </nav>
      )}

      {pathHint && (
        <div className="hidden items-center gap-1.5 rounded-md border border-accent-teal/30 bg-accent-teal/10 px-2.5 py-1 font-mono text-[11px] text-accent-teal lg:flex">
          <PathIcon />
          {pathHint}
        </div>
      )}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-faint">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="19" r="2.5" fill="currentColor" />
      <circle cx="19" cy="5" r="2.5" fill="currentColor" />
      <path d="M7 17 17 7" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
    </svg>
  );
}
