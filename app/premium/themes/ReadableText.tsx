import { createElement, type ReactNode } from "react";
import { formatTextBlocks } from "./text-format";
import styles from "./FullTextReader.module.css";

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) =>
    /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong>
      : /^`[^`\n]+`$/.test(part) ? <code key={i}>{part.slice(1, -1)}</code> : part);
}
export default function ReadableText({ source, raw }: { source: string; raw: boolean }) {
  return raw ? <pre data-testid="full-text-content" className={styles.raw}>{source}</pre>
    : <div data-testid="full-text-content" className={styles.prose}>{formatTextBlocks(source).map((block, i) => {
      if (block.kind === "heading") return createElement(`h${block.level}`, { key: i }, inline(block.text));
      if (block.kind === "code") return <pre key={i}><code>{block.text}</code></pre>;
      if (block.kind === "list") {
        const items = block.items?.map((item, j) => <li key={j} value={block.ordered ? block.numbers?.[j] : undefined}>{inline(item)}</li>);
        return block.ordered ? <ol key={i} start={block.numbers?.[0]}>{items}</ol> : <ul key={i}>{items}</ul>;
      }
      return <p key={i}>{inline(block.text)}</p>;
    })}</div>;
}
