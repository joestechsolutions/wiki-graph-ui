# Wiki Graph — Knowledge Cockpit

A 3D knowledge graph web UI that turns an Obsidian vault into an interactive, explorable second brain. Built on the [Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) with a [Fable 5](https://github.com/elon-choo/fablever) discipline layer.

![Wiki Graph](assets/screenshot.png)

## Live Demo

- **Wiki Graph:** [joestechsolutions.github.io/wiki-graph-ui/](https://joestechsolutions.github.io/wiki-graph-ui/)
- **Agent System Command Center:** [joestechsolutions.github.io/wiki-graph-ui/system](https://joestechsolutions.github.io/wiki-graph-ui/system)

## What It Does

### Wiki Graph (`/`)
- **3D force-directed graph** of your entire vault — nodes are notes, edges are typed relationships (`depends_on`, `part_of`, `relates_to`, `supersedes`)
- **Four exploration modes:** Overview (full graph), Neighborhood (2-degree around a node), Drafts (review workflow), Timeline (recency-arranged)
- **Click to inspect** — right panel shows summary, tags, relations, backlinks, markdown preview, and an "Open in Obsidian" deep link
- **Path tracing** — shift-click two nodes to highlight the shortest path between them
- **Live filtering** — by node type, status, recency, and full-text search
- **Mobile responsive** — slide-in panels, hamburger nav, touch-friendly canvas

### Agent System Command Center (`/system`)
- **3D topology of your entire agent stack** — orchestrator, coding agents, memory, services, Docker containers, models, cron jobs, skills, pipelines
- **Color by category** — orchestrator (teal), coding (teal), memory (periwinkle), services (gray), Docker (slate), LLMs (amber), cron (amber-orange), skills (periwinkle), pipelines (purple), discipline (red)
- **Size by importance** — critical nodes are larger
- **Click to inspect** — right panel shows service status, port numbers, cron schedule, run count, model provider, container status
- **Auto-generated** from live system state (Hermes config, cron jobs, systemctl, docker ps)

### LLM Wiki Operations (`wiki.sh`)
The Karpathy pattern: the LLM incrementally builds and maintains the wiki. Three operations keep the wiki compounding:

```bash
~/wiki/wiki.sh ingest <source>    # Read a source → write wiki pages → update index + log
~/wiki/wiki.sh query "<question>"  # Ask the wiki → get a cited answer → file answer back
~/wiki/wiki.sh lint                # Health-check: broken links, orphans, contradictions
~/wiki/wiki.sh sync                 # Regenerate graphData.json for the visualization
~/wiki/wiki.sh status               # Quick stats
```

### Fable 5 Discipline
All wiki operations run through fcc (Claude Code) with the [Fable 5 working style](https://github.com/elon-choo/fablever) installed — decisive, outcome-first, evidence-grounded, stop-when-done. The LLM doesn't over-build, doesn't guess, and grounds every claim in the source.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | Static export, TypeScript, fast builds |
| Graph Renderer | react-force-graph-3d / Three.js | GPU-accelerated force-directed layout |
| Styling | Tailwind CSS | Utility-first, dark theme, no CSS bloat |
| Data | Build-time JSON import | No runtime fetch, no backend, no API |
| Labels | three-spritetext | 3D sprite labels that scale with zoom |

**No backend. No auth. No database.** The vault is parsed to JSON at build time and baked into the static bundle. Deploy anywhere that serves HTML.

## Architecture

```
Obsidian Vault (~/wiki)
    │
    ├── wiki.sh ingest ── fcc reads source → writes wiki pages → updates index + log
    ├── wiki.sh query  ── fcc reads wiki → synthesizes answer → files answer back
    ├── wiki.sh lint   ── fcc health-checks wiki → writes audit report
    │
    ▼
sync-vault.py ── parses frontmatter + wikilinks ──▶ graphData.json (wiki nodes + edges)
system-sync.py ── pulls Hermes config, cron, services, Docker ──▶ systemData.json (agent topology)
    │
    ▼
Next.js build ── imports JSON at build time ──▶ static export (out/)
    │
    ├── /         → Wiki Graph (3D knowledge graph)
    └── /system   → Agent System Command Center (3D topology)
    │
    ▼
GitHub Pages / any static host
```

```
src/
  app/
    layout.tsx          — root layout, fonts, dark theme
    page.tsx            — wiki graph: state, filters, graph modes, selection
    system/page.tsx     — agent system: topology graph, category coloring
    globals.css         — Tailwind + theme tokens + touch handling
  components/
    Graph3D.tsx         — react-force-graph-3d wrapper (reusable, supports category coloring)
    LeftSidebar.tsx     — filters, mode info, legend (mobile: slide-in overlay)
    RightPanel.tsx      — wiki note details, relations, backlinks, Obsidian deep link
    SystemRightPanel.tsx — agent system details: ports, services, cron schedules, container status
    CommandBar.tsx      — search with ⌘K, mode switcher, wiki/system view toggle
    BottomTray.tsx      — sync status, node/edge counts (responsive trim)
  lib/
    types.ts            — GraphNode, GraphLink, NodeCategory interfaces
    graphData.ts        — loads + normalizes graphData.json
    systemData.ts       — loads + normalizes systemData.json
    filters.ts          — filter + search logic
    graphModes.ts       — mode definitions + force presets
    pathfinding.ts      — BFS shortest path between nodes
    markdown.ts         — minimal markdown renderer for preview
    theme.ts            — node colors, category colors, status styles
scripts/
    sync-vault.py       — vault parser → graphData.json (with security denylist)
    system-sync.py      — Hermes config/cron/services → systemData.json
~/wiki/
    wiki.sh             — LLM Wiki operations (ingest, query, lint, sync, status)
```

## Getting Started

### Prerequisites

- Node.js 20+
- An Obsidian vault with markdown notes (frontmatter + wikilinks)

### Install

```bash
git clone https://github.com/joestechsolutions/wiki-graph-ui.git
cd wiki-graph-ui
npm install
```

### Sync your vault

```bash
python3 scripts/sync-vault.py ~/your-vault > public/graphData.json
```

The sync script reads YAML frontmatter, extracts typed relations, wikilinks, and backlinks. It includes a **security denylist** that automatically skips notes containing phone numbers, emails, API keys, private keys, SSNs, or compensation figures.

### Run

```bash
npm run dev    # development (localhost:3000)

# Production build — set basePath to match your deploy URL
NEXT_BASE_PATH=/wiki-graph-ui npm run build   # → out/
npm run build                                  # → out/ (no basePath, for root deploy)
```

### Deploy to GitHub Pages

```bash
# Build the static export
npm run build

# Push out/ to gh-pages branch
npx gh-pages -d out
```

Or use the included GitHub Action (see `.github/workflows/deploy.yml`).

## Node Types & Colors

| Type | Color | Description |
|------|-------|-------------|
| Tool | `#00d4aa` (teal) | Software tools, platforms, services |
| Concept | `#7c8aff` (periwinkle) | Ideas, architectures, methodologies |
| Hub | `#ffaa3d` (amber) | Index pages, navigation hubs |
| System | `#6b7280` (gray) | System config, infrastructure |
| Journal | `#a78bfa` (purple) | Logs, changelogs, journals |
| Draft | `#f59e0b` (amber-orange) | Unreviewed agent output |

## Security

- **Denylist guard** in `sync-vault.py` — scans every note for sensitive patterns before publishing
- **Directory exclusions** — `.obsidian`, `.git`, `private/`, `personal/`, `secrets/` are never synced
- **Preview sanitization** — any accidental sensitive data in note previews is replaced with `[REDACTED]`
- **No runtime data fetch** — all data is baked at build time, no exposed API endpoints
- **Static-only** — no server, no auth surface, no attack surface

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Joe's Tech Solutions LLC](https://joestechsolutions.com) · [GitHub](https://github.com/joestechsolutions)