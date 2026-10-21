// An answer, turned into something readable. Pure.
//
// The product guide is written in numbered steps and lists, so that is what comes back, and a chat
// that prints it as one flat paragraph is harder to follow than the guide it came from.
//
// It returns DATA, never HTML. The panel maps these blocks to React elements, so there is no
// dangerouslySetInnerHTML anywhere near text that came from a model - which is the house rule, and
// the one that matters most when the text is generated rather than written.

const BOLD = /\*\*([^*]+)\*\*/g;

/** A line split into plain and bold runs. Anything we do not understand stays as text. */
export function spansOf(line) {
  const out = [];
  let at = 0;
  for (const m of String(line || "").matchAll(BOLD)) {
    if (m.index > at) out.push({ text: line.slice(at, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at), bold: false });
  return out.length ? out : [{ text: "", bold: false }];
}

const ORDERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;

/**
 * Blocks, in order: { type: "p", spans } | { type: "ol" | "ul", items: spans[] }.
 *
 * A list is recognised line by line rather than by a blank line between blocks, because a model
 * writing steps often runs them together - and steps that lose their numbering are the one thing
 * somebody following instructions cannot afford.
 */
export function formatAnswer(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", spans: spansOf(para.join(" ")) });
    para = [];
  };
  const pushItem = (type, content) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) last.items.push(spansOf(content));
    else blocks.push({ type, items: [spansOf(content)] });
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushPara();
      continue;
    }
    const ordered = line.match(ORDERED);
    if (ordered) {
      flushPara();
      pushItem("ol", ordered[2]);
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      flushPara();
      pushItem("ul", bullet[1]);
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/** The answer as one line, for the clipboard and for anywhere a block list will not fit. */
export const plainAnswer = (text) =>
  formatAnswer(text)
    .map((b) =>
      b.type === "p"
        ? b.spans.map((s) => s.text).join("")
        : b.items.map((it, i) => `${b.type === "ol" ? `${i + 1}.` : "-"} ${it.map((s) => s.text).join("")}`).join("\n")
    )
    .join("\n\n");
