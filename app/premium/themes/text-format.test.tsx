import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatTextBlocks } from "./text-format";
import ReadableText from "./ReadableText";

describe("text presentation preserves its source", () => {
  it("formats literal newlines, headings and lists without changing original", () => {
    const original = "## 記録\\n\\n- 根拠A\\n- 根拠B\\n\\n段落";
    const before = original;
    expect(formatTextBlocks(original)).toEqual([
      { kind: "heading", text: "記録", level: 4 },
      { kind: "list", text: "", ordered: false, items: ["根拠A", "根拠B"] },
      { kind: "paragraph", text: "段落" },
    ]);
    expect(original).toBe(before);
    const raw = renderToStaticMarkup(createElement(ReadableText, { source: original, raw: true }));
    expect(raw).toContain(original);
  });
  it("formats across a chunk boundary split between backslash and n", () => {
    const source = "a".repeat(1999) + "\\n## 後半";
    const chunks = [source.slice(0, 2000), source.slice(2000)];
    expect(formatTextBlocks(chunks.join(""))[1]).toEqual({ kind: "heading", text: "後半", level: 4 });
    expect(chunks.join("")).toBe(source);
  });
  it("escapes HTML and never creates active links or inline script", () => {
    const html = renderToStaticMarkup(createElement(ReadableText, { source: "# <script>alert(1)</script>\n<img src=x onerror=alert(2)>\n[jump](javascript:alert(3))", raw: false }));
    expect(html).not.toContain("<script>"); expect(html).not.toContain("<img"); expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;script&gt;");
  });
  it("handles real CRLF and ordered lists, including changing list type", () => {
    expect(formatTextBlocks("1. first\r\n2. second\r\n- third")).toEqual([
      {kind:"list",text:"",ordered:true,items:["first","second"],numbers:[1,2]}, {kind:"list",text:"",ordered:false,items:["third"]},
    ]);
  });
  it("renders fenced code as escaped text including an unfinished fence", () => {
    const html=renderToStaticMarkup(createElement(ReadableText,{source:"```\n<div>\n",raw:false}));
    expect(html).toContain("&lt;div&gt;"); expect(html).not.toContain("<div>\n");
  });
  it("limits content headings to the panel hierarchy and formats inline emphasis", () => {
    const html=renderToStaticMarkup(createElement(ReadableText,{source:"# First\n###### Last\n**重要** と `code`",raw:false}));
    expect(html).toContain("<h3>"); expect(html).toContain("<h6>");expect(html).toContain("<strong>重要</strong>");expect(html).toContain("<code>code</code>");
  });
});

it("preserves report numbering across blank lines and gaps", () => {
  const html=renderToStaticMarkup(createElement(ReadableText,{source:"3. third\n\n5. fifth\n7. seventh",raw:false}));
  expect(html).toContain('<ol start="3"><li value="3">third</li></ol>');
  expect(html).toContain('<ol start="5"><li value="5">fifth</li><li value="7">seventh</li></ol>');
});
it.each(["**","`","text\n**","text\n`"])("keeps unfinished inline delimiters as text: %s", source => {
  const html=renderToStaticMarkup(createElement(ReadableText,{source,raw:false}));
  expect(html).not.toContain("<strong>");expect(html).not.toContain("<code>");
  expect(html).toContain(source);
});
