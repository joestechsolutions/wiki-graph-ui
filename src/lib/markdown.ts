/**
 * Minimal, XSS-safe markdown renderer for note previews.
 *
 * Security: the raw text is HTML-escaped FIRST, so no markup from the source
 * can ever reach the DOM as live HTML. Only the small, fixed set of tags this
 * function emits below is produced — there is no passthrough of source HTML.
 * That keeps `dangerouslySetInnerHTML` safe without a sanitizer dependency.
 */
export function renderMarkdown(input: string): string {
  const escaped = escapeHtml(input);
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      out.push(`<ul>${listBuffer.join("")}</ul>`);
      listBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    // Blockquote
    if (/^&gt;\s?/.test(line)) {
      flushList();
      out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/, ""))}</blockquote>`);
      continue;
    }
    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = Math.min(h[1].length, 6);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    // List items
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      listBuffer.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    // Paragraph
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join("");
}

/** Inline transforms on already-escaped text. */
function inline(s: string): string {
  return (
    s
      // wikilinks [[slug]] -> styled span
      .replace(/\[\[([^\]]+)\]\]/g, (_, t) => `<span class="wikilink">${t}</span>`)
      // inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // italic (single * not adjacent to another *)
      .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
