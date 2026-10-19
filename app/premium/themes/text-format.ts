export type TextBlock = { kind: "paragraph" | "heading" | "list" | "code"; text: string; level?: number; ordered?: boolean; items?: string[]; numbers?: number[] };

/** Presentation only. The received source and its code-point offsets are never changed. */
export function formatTextBlocks(source: string): TextBlock[] {
  const lines = source.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n?/g, "\n").split("\n");
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [], list: string[] = [], ordered = false, numbers: number[] = [], code: string[] | null = null;
  function flushParagraph() { if (paragraph.length) { blocks.push({ kind: "paragraph", text: paragraph.join("\n") }); paragraph = []; } }
  function flushList() { if (list.length) { blocks.push({ kind: "list", text: "", items: list, ordered, ...(ordered ? { numbers } : {}) }); list = []; numbers = []; } }
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushList();
      if (code !== null) { blocks.push({ kind: "code", text: code.join("\n") }); code = null; } else code = [];
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const item = /^\s*(?:([-+*])|([0-9]+)[.)])\s+(.+)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); blocks.push({ kind: "heading", text: heading[2], level: Math.min(6, heading[1].length + 2) }); }
    else if (item) {
      flushParagraph(); const nextOrdered = Boolean(item[2]);
      if (list.length && nextOrdered !== ordered) flushList();
      ordered = nextOrdered; list.push(item[3]); if (ordered) numbers.push(Number(item[2]));
    } else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  if (code !== null) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}
