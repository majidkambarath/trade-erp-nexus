// A guide line may carry two kinds of fixed text, never translated and never reordered:
//   [[Add Customer]]   the exact words on a button, tab or field on the screen
//   {{Net 30}}         an example value the person may type
// Both are drawn as a small chip and isolated left-to-right (bdi + dir), so in an Arabic line the screen's
// own English name cannot be jumbled by the right-to-left run around it, and the person can match it, letter
// for letter, with what they see. The translation around them changes; they do not.
import React from "react";

const PART = /(\[\[[^\]]*\]\]|\{\{[^}]*\}\})/g;

export function parseRich(text) {
  return String(text ?? "").split(PART).filter((s) => s !== "").map((s) => {
    if (s.startsWith("[[")) return { kind: "name", text: s.slice(2, -2) };
    if (s.startsWith("{{")) return { kind: "example", text: s.slice(2, -2) };
    return { kind: "text", text: s };
  });
}

export default function RichText({ text }) {
  return parseRich(text).map((p, i) => {
    if (p.kind === "text") return <React.Fragment key={i}>{p.text}</React.Fragment>;
    return (
      <bdi
        key={i}
        dir="ltr"
        data-guide-fixed={p.kind}
        className={p.kind === "name"
          ? "mx-0.5 rounded border border-border bg-secondary px-1 py-0.5 text-[0.85em] font-medium text-foreground"
          : "mx-0.5 rounded bg-accent px-1 py-0.5 text-[0.85em] italic text-foreground"}
      >{p.text}</bdi>
    );
  });
}
