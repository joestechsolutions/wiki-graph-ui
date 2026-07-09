#!/usr/bin/env python3
"""
sync-vault.py — Parse Obsidian vault → graphData.json

Reads markdown notes with YAML frontmatter, extracts typed relations,
wikilinks, backlinks, and metadata. Outputs a single JSON file the
frontend can consume.

Usage: python3 sync-vault.py ~/wiki > graphData.json
"""
import sys, os, re, json, yaml, hashlib, pathlib
from datetime import datetime, date

# ── Security: denylist patterns ───────────────────────────────────────────
# If any of these patterns appear in a note's content, the note is SKIPPED
# and a warning is printed to stderr. This prevents accidental exposure of
# private data when syncing the vault to a public-facing UI.
DENYLIST_PATTERNS = [
    # Phone numbers (US format: xxx-xxx-xxxx or (xxx) xxx-xxxx)
    r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
    # Email addresses
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    # API keys / tokens (common formats)
    r'(?:api[_-]?key|token|secret|password|passwd|pwd|auth)["\']?\s*[:=]\s*["\']?[A-Za-z0-9+/=_-]{16,}',
    # AWS keys
    r'AKIA[0-9A-Z]{16}',
    # Private key blocks
    r'-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----',
    # Compensation / salary figures
    r'\$\d{2,3}K?(?:\s*[-/–]\s*\$?\d{2,3}K?)?(?:\s*(?:/yr|per year|annual|salary|comp))',
    # SSN
    r'\b\d{3}-\d{2}-\d{4}\b',
]

# Directories that should NEVER be synced
EXCLUDE_DIRS = {".obsidian", ".herenow", "node_modules", ".git", ".trash", "private", "personal", "secrets"}

# File patterns to exclude
EXCLUDE_FILE_PATTERNS = [
    r'\.private$',
    r'\.secret$',
    r'credentials',
    r'\.env$',
]

compiled_denylist = [re.compile(p, re.IGNORECASE) for p in DENYLIST_PATTERNS]
compiled_file_excludes = [re.compile(p, re.IGNORECASE) for p in EXCLUDE_FILE_PATTERNS]

def contains_sensitive_data(content: str, filepath: str) -> bool:
    """Check if content or filename contains patterns that should not be published."""
    # Check filename
    for pat in compiled_file_excludes:
        if pat.search(filepath):
            return True
    # Check content
    for pat in compiled_denylist:
        if pat.search(content):
            return True
    return False

def sanitize_preview(text: str) -> str:
    """Strip any accidentally matched sensitive patterns from preview text."""
    sanitized = text
    for pat in compiled_denylist:
        sanitized = pat.sub('[REDACTED]', sanitized)
    return sanitized

def parse_frontmatter(content):
    """Split frontmatter from body, return (fm_dict, body_str)."""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    try:
        fm = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        fm = {}
    body = parts[2].strip()
    return fm, body

def extract_wikilinks(body):
    """Extract [[wikilink]] targets, strip alias."""
    return list(set(re.findall(r'\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', body)))

def extract_summary(body, max_len=200):
    """First non-empty paragraph, stripped of markdown."""
    for line in body.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("|") and not line.startswith(">"):
            clean = re.sub(r'[#*`\[\]()]', '', line).strip()
            if clean:
                return clean[:max_len]
    return ""

def parse_date(d):
    if isinstance(d, date):
        return d.isoformat()
    if isinstance(d, datetime):
        return d.date().isoformat()
    return str(d) if d else ""

def days_since(date_str):
    if not date_str:
        return 9999
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        return (datetime.now().date() - d).days
    except ValueError:
        return 9999

def infer_type_from_path(filepath, fm_type):
    """Map frontmatter type + folder path to the product's node types."""
    path_lower = filepath.lower()
    if fm_type:
        t = fm_type.lower()
        if t in ("entity", "tool"): return "tool" if "/entities/" in path_lower else "concept"
        if t == "concept": return "concept"
        if t == "comparison": return "concept"
        if t == "query": return "concept"
        if t == "workspace": return "project"
        if t == "log": return "journal"
    if "/system/" in path_lower or path_lower.startswith("system/"): return "system"
    if "/agent-output/" in path_lower or path_lower.startswith("agent-output/"): return "draft"
    if "/memory/" in path_lower or path_lower.startswith("memory/"): return "journal"
    if "/graphs/" in path_lower or path_lower.startswith("graphs/"): return "hub"
    if "/workspaces/" in path_lower or path_lower.startswith("workspaces/"): return "project"
    if "/archive/" in path_lower or path_lower.startswith("archive/"): return "artifact"
    if "/knowledge/" in path_lower or path_lower.startswith("knowledge/"): return "concept"
    return "concept"

def main():
    vault_path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/wiki")
    
    nodes = []
    edges = []
    slug_to_id = {}
    
    # Collect all markdown files
    md_files = []
    exclude_dirs = EXCLUDE_DIRS
    for root, dirs, files in os.walk(vault_path):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            if f.endswith(".md"):
                md_files.append(os.path.join(root, f))
    
    # First pass: build nodes
    skipped = []
    for fpath in md_files:
        with open(fpath, "r") as fh:
            content = fh.read()

        rel_path = os.path.relpath(fpath, vault_path)

        # Security: skip files containing sensitive data
        if contains_sensitive_data(content, rel_path):
            skipped.append(rel_path)
            sys.stderr.write(f"  ⚠ SKIP (sensitive data): {rel_path}\n")
            continue

        fm, body = parse_frontmatter(content)
        
        rel_path = os.path.relpath(fpath, vault_path)
        slug = fm.get("slug", os.path.splitext(os.path.basename(fpath))[0])
        title = fm.get("title", slug.replace("-", " ").title())
        fm_type = fm.get("type", "")
        node_type = infer_type_from_path(rel_path, fm_type)
        
        # Importance: based on backlink count (computed in second pass, default 1)
        importance = 1
        if fm.get("confidence") == "high":
            importance = 2
        if node_type == "hub":
            importance = 3
        
        created = parse_date(fm.get("created"))
        updated = parse_date(fm.get("updated"))
        recency = days_since(updated or created)
        
        # Status
        status = fm.get("status", "canonical")
        if node_type == "draft":
            status = "draft"
        if node_type == "journal":
            status = "canonical"
        
        # Tags
        tags = fm.get("tags", [])
        if isinstance(tags, str):
            tags = [tags]
        
        # Relations from frontmatter
        fm_relations = fm.get("relations", {}) or {}
        
        # Wikilinks from body
        wikilinks = extract_wikilinks(body)
        
        node = {
            "id": slug,
            "title": title,
            "type": node_type,
            "summary": extract_summary(body) or fm.get("description", ""),
            "tags": tags,
            "path": rel_path,
            "status": status,
            "created_at": created,
            "updated_at": updated,
            "importance": importance,
            "recency": recency,
            "backlinks": 0,  # computed in pass 2
            "frontmatter_relations": fm_relations,
            "wikilinks": wikilinks,
            "preview": sanitize_preview(body[:500]),
            "agent_generated": fm.get("agent_generated", False),
            "reviewed_by": fm.get("reviewed_by", "human"),
            "confidence": fm.get("confidence", "medium"),
        }
        nodes.append(node)
        slug_to_id[slug] = slug
    
    # Second pass: build edges and count backlinks
    backlink_counts = {n["id"]: 0 for n in nodes}
    
    def add_edge(source, target, rel_type):
        if source == target:
            return
        if target not in slug_to_id:
            return  # broken link, skip
        edges.append({
            "source": source,
            "target": target,
            "type": rel_type,
        })
        backlink_counts[target] += 1
    
    for node in nodes:
        src = node["id"]
        # Typed relations from frontmatter
        rels = node["frontmatter_relations"]
        if isinstance(rels, dict):
            for rel_key, targets in rels.items():
                if not isinstance(targets, list):
                    targets = [targets] if targets else []
                for t in targets:
                    if isinstance(t, str):
                        add_edge(src, t, rel_key)
        # Wikilinks → related_to
        for link in node["wikilinks"]:
            add_edge(src, link, "related_to")
    
    # Update backlink counts
    for node in nodes:
        node["backlinks"] = backlink_counts[node["id"]]
        # Recompute importance with backlinks
        if node["type"] == "hub":
            node["importance"] = max(3, node["backlinks"] // 2 + 3)
        else:
            node["importance"] = max(1, min(5, 1 + node["backlinks"] // 2))
    
    # Deduplicate edges (same source+target, keep first)
    seen = set()
    unique_edges = []
    for e in edges:
        key = (e["source"], e["target"], e["type"])
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)
    
    output = {
        "nodes": nodes,
        "links": unique_edges,
        "metadata": {
            "vault_path": vault_path,
            "synced_at": datetime.now().isoformat(),
            "node_count": len(nodes),
            "edge_count": len(unique_edges),
            "skipped_count": len(skipped),
            "skipped_files": skipped,
        }
    }
    
    print(json.dumps(output, indent=2, default=str))

if __name__ == "__main__":
    main()