# Wiki Graph UI — Build Task

## Context
You are building a Next.js app at `/home/lurkr/projects/wiki-graph-ui/`.

The sync layer already exists: `scripts/sync-vault.py` parses an Obsidian vault at `~/wiki` and outputs `public/graphData.json` (17 nodes, 116 edges, typed relations). Read that JSON to understand the data shape.

## What to build

A production-ready knowledge graph UI — a "human-agent operating system" for a second brain. Not a particle demo. A serious knowledge cockpit.

### Stack
- Next.js 14+ (App Router)
- React + TypeScript
- react-force-graph-3d (Three.js-based graph renderer — use `react-force-graph-3d` npm package)
- Tailwind CSS for the 2D overlay
- Read `public/graphData.json` as the data source (static import or fetch from /public)

### Data shape (from graphData.json)
```typescript
interface GraphNode {
  id: string;          // slug
  title: string;
  type: 'project' | 'area' | 'resource' | 'concept' | 'system' | 'tool' | 'person' | 'company' | 'journal' | 'hub' | 'draft' | 'task' | 'decision' | 'meeting' | 'artifact';
  summary: string;
  tags: string[];
  path: string;         // relative path in vault
  status: 'draft' | 'canonical' | 'superseded';
  created_at: string;
  updated_at: string;
  importance: number;   // 1-5, based on backlinks
  recency: number;      // days since last update
  backlinks: number;
  frontmatter_relations: {
    depends_on?: string[];
    part_of?: string[];
    relates_to?: string[];
    supersedes?: string[];
  };
  wikilinks: string[];
  preview: string;      // first 500 chars of body
  agent_generated: boolean;
  reviewed_by: 'human' | 'agent:reviewer' | 'unreviewed';
  confidence: 'high' | 'medium' | 'low';
}

interface GraphLink {
  source: string;       // node id
  target: string;       // node id
  type: 'related_to' | 'depends_on' | 'part_of' | 'used_by' | 'decided_by' | 'mentions' | 'contradicts' | 'created_from' | 'summarized_by';
}
```

### Layout (desktop-first)
- **Center:** 3D graph canvas (react-force-graph-3d)
- **Left sidebar:** filters, graph modes, note-type toggles, time filters (collapsible)
- **Right panel:** selected note details — title, type, status, summary, relations, backlinks, preview content, agent actions (visible when a node is selected, slides in)
- **Top command bar:** search input, quick commands, graph mode switching, jump-to-note
- **Bottom tray (optional):** agent activity / sync status / recent promotions

### Core graph behaviors
- Hover: highlight node + first-degree neighbors, dim unrelated
- Click: select node, fly camera to it smoothly, open right panel
- Selected node: show 1st + 2nd degree neighbors, dim rest
- Path tracing: shift+click two nodes → highlight shortest path between them
- Color nodes by type
- Size nodes by importance (backlinks)
- Halo/glow for recently modified (low recency) or draft status
- Edge color/style by relation type (e.g., depends_on = solid, related_to = thin, contradicts = red dashed)
- Labels: show on hover/focus only, or when zoomed in past threshold
- Smooth camera transitions (fly-to, not snap)

### Graph modes (top bar switch)
1. **Overview** — full graph, all types, balanced forces
2. **Neighborhood** — local graph around selected node, 2-degree
3. **Drafts** — only draft nodes + their connections, for review workflow
4. **Timeline** — journal/log nodes arranged by recency

Each mode adjusts: visible node types, force settings, edge emphasis, label density.

### Right panel (selected note)
- Title + type badge (colored)
- Status badge (draft/canonical/superseded)
- Summary text
- Tags
- Frontmatter relations (typed, clickable → navigate to that node)
- Backlinks count + list (clickable)
- Preview content (first 500 chars, markdown rendered)
- "Open in Obsidian" button (constructs `obsidian://open?vault=wiki&file=path`)
- If draft: "Promote to Canonical" button (visual only — shows what the action would do, no actual write)

### Design language
- Dark, elegant, calm — NOT neon cyberpunk, NOT crypto dashboard
- Background: deep charcoal/near-black (#0a0a0f to #111118)
- Accent: one restrained primary (teal #00d4aa for entities, periwinkle #7c8aff for concepts, amber #ffaa3d for hubs)
- Typography: clean sans-serif (Inter or system), monospace for paths/metadata
- Subtle borders, generous spacing, low visual noise
- Smooth transitions (200-400ms) on all state changes
- Node colors by type, edge colors by relation type
- Progressive disclosure: don't show everything at once
- Premium feel: like Linear, Notion, or a Bloomberg terminal — not a game

### Node type colors
```
tool:      #00d4aa  (teal)
concept:   #7c8aff  (periwinkle)
hub:       #ffaa3d  (amber)
system:    #6b7280  (gray)
journal:   #a78bfa  (purple)
draft:     #f59e0b  (amber-orange)
project:   #ef4444  (red)
artifact:  #9ca3af  (gray)
```

### Edge type styles
```
depends_on:  solid, 2px, node color
part_of:     solid, 1.5px, node color
relates_to:  thin, 1px, #4a5570
contradicts: dashed, 1.5px, #ef4444
supersedes:  solid, 2px, #ffaa3d
```

### Performance
- react-force-graph-3d handles the heavy lifting
- Don't re-render the whole graph on every state change
- Use React state efficiently — graph instance should be stable, only data/filter changes
- Labels via sprites or HTML overlay (not 3D text)

### File structure (keep it lean)
```
src/
  app/
    layout.tsx          — root layout, dark theme
    page.tsx            — main app, composes all panels
    globals.css         — Tailwind + theme tokens
  components/
    Graph3D.tsx         — react-force-graph-3d wrapper
    LeftSidebar.tsx     — filters + mode switcher
    RightPanel.tsx      — selected note details
    CommandBar.tsx      — search + quick commands
    BottomTray.tsx      — sync status (optional, keep minimal)
  lib/
    types.ts            — GraphNode, GraphLink interfaces
    graphData.ts        — loads + normalizes graphData.json
    filters.ts          — filter logic (by type, status, recency, search)
    graphModes.ts       — mode definitions + force settings
    pathfinding.ts      — BFS shortest path between two nodes
  data/
    (graphData.json lives in public/, imported at build time)
```

### IMPORTANT constraints
1. **Make it actually work.** Not a concept mockup. It should run `npm run dev` and render the 3D graph with real data.
2. **Use the real graphData.json** — don't generate fake data, the sync script already produced real data from the actual vault.
3. **react-force-graph-3d** is the graph renderer — install it, use it. Don't hand-roll a Three.js scene.
4. **TypeScript throughout** — typed interfaces for all data.
5. **Tailwind for styling** — clean utility classes, dark theme.
6. **Keep files lean** — don't over-abstract. Few components, clear responsibilities.
7. **No Supabase, no backend, no API routes** — this is a static frontend reading a JSON file. YAGNI.
8. **No auth, no user accounts** — single-user local tool.
9. **Don't add features not listed above** — ship the listed features, done well.
10. **The "Open in Obsidian" button** constructs an `obsidian://` URL — it doesn't need to work in the browser, just construct the right URL.

### After building
1. Run `npm run build` to verify it compiles
2. If there are errors, fix them
3. Report what was built, what works, what doesn't