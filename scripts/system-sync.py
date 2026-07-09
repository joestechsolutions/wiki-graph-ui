#!/usr/bin/env python3
"""Sync the Hermes agent system into a graph JSON for the command center.

Pulls from:
- ~/.hermes/config.yaml — providers, models, toolsets
- ~/.hermes/cron/jobs.json — scheduled jobs
- ~/.hermes/skills/ — skill directories
- systemctl --user — active services
- docker ps — running containers
- ~/free-claude-code/.env — fcc proxy config

Outputs: public/systemData.json
"""
import json, os, subprocess, re, glob, sys
from pathlib import Path
from datetime import datetime

HOME = Path.home()
OUT = sys.argv[2] if len(sys.argv) > 2 else str(HOME / "projects" / "wiki-graph-ui" / "public" / "systemData.json")

nodes = []
links = []
node_ids = set()

def add_node(node_id, title, ntype, summary="", **extra):
    if node_id in node_ids:
        return
    node_ids.add(node_id)
    n = {
        "id": node_id,
        "title": title,
        "type": ntype,
        "summary": summary,
        "tags": [],
        "path": extra.get("path", ""),
        "status": extra.get("status", "canonical"),
        "created_at": extra.get("created_at", ""),
        "updated_at": extra.get("updated_at", ""),
        "importance": extra.get("importance", 1),
        "recency": extra.get("recency", 0),
        "backlinks": extra.get("backlinks", 0),
        "frontmatter_relations": {},
        "wikilinks": extra.get("wikilinks", []),
        "preview": extra.get("preview", ""),
        "agent_generated": False,
        "reviewed_by": "human",
        "confidence": "high",
        "category": extra.get("category", ""),
        "meta": extra.get("meta", {}),
    }
    nodes.append(n)

def add_link(source, target, ltype="relates_to"):
    # ponytail: dedup by (source, target, type)
    for l in links:
        if l["source"] == source and l["target"] == target and l["type"] == ltype:
            return
    links.append({"source": source, "target": target, "type": ltype})

# --- Core orchestrator ---
add_node("lurkr", "Lurkr (Hermes)", "system",
    "Head orchestrator — receives requests via Telegram/API, delegates to agents",
    category="orchestrator", importance=5,
    meta={"port": 8642, "service": "hermes-gateway.service"})

# --- fcc (coding agent) ---
add_node("fcc", "FCC Proxy", "tool",
    "Free Claude Code proxy — translates Anthropic API to free/cheap models",
    category="coding", importance=5,
    meta={"port": 8082, "service": "free-claude-code.service"})
add_link("lurkr", "fcc", "depends_on")

# --- MemPalace ---
add_node("mempalace", "MemPalace", "tool",
    "Persistent memory — semantic search, knowledge graph, diary",
    category="memory", importance=5,
    meta={"type": "mcp_server"})
add_link("lurkr", "mempalace", "depends_on")

# --- GitNexus ---
add_node("gitnexus", "GitNexus", "tool",
    "Code knowledge graph — indexes codebases into queryable symbol graphs",
    category="code-intel", importance=3)
add_link("lurkr", "gitnexus", "relates_to")

# --- Agent-Skills ---
add_node("agent-skills", "Agent-Skills", "tool",
    "24 SDLC skills + 4 personas for Claude Code (Addy Osmani)",
    category="skills", importance=3)
add_link("fcc", "agent-skills", "depends_on")

# --- Superpowers ---
add_node("superpowers", "Superpowers", "tool",
    "13 workflow skills — TDD, debugging, plans, code review, git worktrees",
    category="skills", importance=3)
add_link("fcc", "superpowers", "relates_to")

# --- Fable Profile ---
add_node("fable-profile", "Fable Profile", "tool",
    "Claude Fable 5 working style transplant — decisive, outcome-first, evidence-grounded",
    category="discipline", importance=3)
add_link("fcc", "fable-profile", "depends_on")

# --- Services (systemd) ---
services = {
    "hermes-gateway": ("Hermes Gateway", "system", "Telegram + API gateway on port 8642"),
    "free-claude-code": ("FCC Proxy", None, None),  # already added above
    "open-design": ("Open Design", "system", "Design AI stack — daemon :7457, web :4000"),
}

try:
    result = subprocess.run(["systemctl", "--user", "list-units", "--type=service", "--state=active"],
                          capture_output=True, text=True, timeout=5)
    active_services = set()
    for line in result.stdout.split("\n"):
        for svc in services:
            if svc in line:
                active_services.add(svc)
except:
    active_services = set()

for svc_id, (name, ntype, summary) in services.items():
    if ntype is None:
        continue  # skip fcc, already added
    add_node(f"svc-{svc_id}", name, ntype or "system", summary or "",
        category="service", importance=3,
        meta={"service": f"{svc_id}.service", "status": "active" if svc_id in active_services else "inactive"})
    add_link("lurkr", f"svc-{svc_id}", "depends_on")

# --- Docker containers ---
docker_names = {
    "postiz": ("Postiz", "system", "Social media scheduling — 6 containers, port 4007"),
    "postiz-postgres": ("Postiz Postgres", "system", "Postgres 17 for Postiz"),
    "postiz-redis": ("Postiz Redis", "system", "Redis 7.2 for Postiz"),
    "temporal": ("Temporal", "system", "Temporal 1.28.1 for Postiz workflows"),
    "temporal-postgresql": ("Temporal Postgres", "system", "Postgres 16 for Temporal"),
    "open-webui": ("OpenWebUI", "tool", "Open WebUI on port 3000"),
    "voicebox": ("Voicebox", "tool", "Voice/audio processing container"),
}

try:
    result = subprocess.run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"],
                          capture_output=True, text=True, timeout=5)
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t")
        cname = parts[0].strip()
        cstatus = parts[1].strip() if len(parts) > 1 else ""
        if cname in docker_names:
            name, ntype, summary = docker_names[cname]
            add_node(f"docker-{cname}", name, ntype, summary,
                category="docker", importance=2,
                meta={"container": cname, "status": cstatus})
            if cname.startswith("postiz"):
                add_link("lurkr", f"docker-{cname}", "relates_to")
            elif cname == "open-webui":
                add_link("lurkr", f"docker-{cname}", "relates_to")
            elif cname == "voicebox":
                add_link("lurkr", f"docker-{cname}", "relates_to")
except:
    pass

# --- Ollama ---
add_node("ollama", "Ollama", "system",
    "Local LLM server — port 11434, models: granite4.1:8b + cloud models",
    category="llm", importance=4,
    meta={"port": 11434, "service": "ollama.service"})
add_link("lurkr", "ollama", "depends_on")

# --- Models (key ones) ---
models = [
    ("glm-5.2:cloud", "GLM 5.2 Cloud", "Ollama Cloud", "Primary model — Hermes default"),
    ("kimi-k2.7-code:cloud", "Kimi K2.7 Code", "Ollama Cloud", "Judge model for goal mode + coding"),
    ("deepseek-v4-flash:cloud", "DeepSeek V4 Flash", "Ollama Cloud", "Fallback model"),
    ("gemma4:cloud", "Gemma 4 Cloud", "Ollama Cloud", "Lightweight cron model"),
    ("stepfun-ai/step-3.5-flash", "Step 3.5 Flash", "NVIDIA NIM", "Interactive model via NVIDIA"),
    ("granite4.1:8b", "Granite 4.1 8B", "Ollama Local", "Offline/emergency model"),
]
for mid, mname, mprovider, msummary in models:
    add_node(f"model-{mid}", mname, "concept", msummary,
        category="model", importance=2,
        meta={"provider": mprovider, "model_id": mid})
    add_link("lurkr", f"model-{mid}", "relates_to")
    if "NVIDIA" in mprovider:
        add_link(f"model-{mid}", "fcc", "part_of")

# --- Cron jobs ---
cron_path = HOME / ".hermes" / "cron" / "jobs.json"
try:
    with open(cron_path) as f:
        cron_data = json.load(f)
    for job in cron_data.get("jobs", []):
        if not job.get("enabled", True):
            continue
        jid = job["id"][:8]
        jname = job.get("name", jid)
        jschedule = job.get("schedule_display", job.get("schedule", {}).get("display", ""))
        jcompleted = job.get("repeat", {}).get("completed", 0)
        jstatus = job.get("last_status", "unknown")
        add_node(f"cron-{jid}", f"⏰ {jname}", "system",
            f"Cron: {jschedule} | {jcompleted} runs | last: {jstatus}",
            category="cron", importance=2,
            meta={"schedule": jschedule, "completed": jcompleted, "status": jstatus})
        add_link("lurkr", f"cron-{jid}", "relates_to")
except:
    pass

# --- Skills (group into categories) ---
skills_dir = HOME / ".hermes" / "skills"
try:
    skill_dirs = sorted([d.name for d in skills_dir.iterdir() if d.is_dir()])
    # ponytail: group skills as one node per skill, linked to lurkr
    for sname in skill_dirs:
        add_node(f"skill-{sname}", sname, "concept",
            f"Hermes skill: {sname}",
            category="skill", importance=1)
        add_link("lurkr", f"skill-{sname}", "relates_to")
except:
    pass

# --- Pipelines ---
pipelines = [
    ("content-lane", "Content Lane Pipeline", "4-stage daily content pipeline"),
    ("client-research", "Client Research Pipeline", "5-stage research pipeline"),
]
for pid, pname, psummary in pipelines:
    add_node(f"pipeline-{pid}", pname, "system", psummary, category="pipeline", importance=3)
    add_link("lurkr", f"pipeline-{pid}", "depends_on")

# --- Wiki ---
add_node("wiki", "LLM Wiki", "tool",
    "Obsidian vault — Karpathy pattern, compiled knowledge layer",
    category="knowledge", importance=4,
    meta={"path": str(HOME / "wiki")})
add_link("lurkr", "wiki", "depends_on")

# --- Output ---
data = {
    "nodes": nodes,
    "links": links,
    "metadata": {
        "generated": datetime.now().isoformat(),
        "source": "system-sync.py",
        "node_count": len(nodes),
        "link_count": len(links),
    }
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f, indent=2)

print(f"System graph: {len(nodes)} nodes, {len(links)} links → {OUT}")