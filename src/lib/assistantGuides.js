// Which "Guide me" walkthroughs to offer under a Zarvia AI answer. Pure, so every rule is a test.
//
// The assistant answers from the help guides; this offers the step-by-step walkthrough that shows the person
// how to do the thing on the real screen. It matches in the browser, against the guides THIS person may run
// (their role and plan decide that, in guides/index.js flowsFor), so it costs nothing on a free AI plan and the
// model cannot invent a guide that does not exist.

// Request openers, so "i need to purchase" is matched as "purchase".
const OPENERS = /^(?:(?:i\s+)?(?:need|want|wanna|would\s+like)\s+to\s+|(?:how\s+(?:do|can|should|would)\s+i\s+|(?:can|could|should)\s+i\s+|help\s+me\s+(?:to\s+)?|tell\s+me\s+(?:how\s+to\s+)?|please\s+))+/;

const STOP = new Set([
  "the", "and", "for", "how", "can", "need", "want", "with", "from", "into", "please", "help", "does", "what", "where",
  "when", "this", "that", "there", "your", "our", "my", "its", "you", "are", "was", "will", "should", "would", "could",
  "some", "any", "all", "one", "them", "they", "have", "has", "got", "get", "way", "now", "here", "about", "like",
]);

// The words people use, mapped to the word the guides use.
const SAME = {
  buy: "purchase", bought: "purchase", buying: "purchase", purchasing: "purchase", procure: "purchase",
  supplier: "vendor", seller: "vendor",
  client: "customer", buyer: "customer",
  bill: "invoice", invoicing: "invoice",
  paid: "pay", paying: "pay", payment: "pay", settle: "pay",
  received: "receive", receipt: "receive", collect: "receive",
  product: "item", goods: "item",
  spent: "expense", spend: "expense", cost: "expense",
  sale: "sales", sell: "sales", selling: "sales", sold: "sales",
  quote: "quotation", estimate: "quotation",
  refund: "return", returned: "return",
  // "raise an invoice" is how accountants say "make one"
  raise: "make", generate: "make", prepare: "make", produce: "make",
};

// Verbs every second guide begins with. They count a little and never qualify a guide on their own, or
// "add a custmer" would offer every "Add ..." guide.
const VERBS = new Set(["create", "add", "new", "make", "enter", "record", "do", "see", "read", "set", "give", "move", "issue", "open", "follow", "choose", "keep", "understand"]);

// A guide whose title carries one of these is offered only when the person said it: "I need to purchase" is
// not a request to record a purchase RETURN.
const QUALIFIERS = new Set(["return", "write", "reconcile", "close"]);

// Guides that show a report or a screen rather than DO something. On a tie the doing one comes first: "I need to
// purchase" wants the purchase order, not the purchases report.
const READING = new Set(["read", "see", "analyse", "analyze", "understand", "tour", "keep", "choose"]);
const reading = (title) => READING.has(String(title).trim().toLowerCase().split(/\s+/)[0]);

const singular = (w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const SAME_KEYS = Object.keys(SAME);
const canon = (w) => {
  const s = SAME[w] || singular(w);
  if (SAME[s]) return SAME[s];
  // a slip in one of the people's words ("suplier" for "supplier") still reaches the guides' word
  const near = s.length >= 5 ? SAME_KEYS.find((k) => withinOne(s, k)) : null;
  return near ? SAME[near] : s;
};

function wordsOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(canon);
}

// One slip apart ("purcahse" for "purchase"), for words of five letters or more. The twin of the server's
// utils/helpCorpus.js withinOne.
export function withinOne(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

/** The words of a question worth matching, typos and openers dealt with. */
export function questionWords(question) {
  const bare = String(question || "").toLowerCase().trim().replace(OPENERS, "");
  return [...new Set(wordsOf(bare))];
}

const has = (set, word) => set.has(word) || [...set].some((w) => withinOne(word, w));

/**
 * Up to `max` guides for a question, best first. `describe(flow)` gives { title, text } in the person's language.
 * A guide needs a title word the person used (not just a verb), and must not be about something they did not ask.
 */
export function suggestGuides(question, flows, describe, { max = 2 } = {}) {
  const asked = questionWords(question);
  if (!asked.length || !Array.isArray(flows) || !flows.length) return [];
  const scored = [];
  for (const flow of flows) {
    const { title = "", text = "" } = describe(flow) || {};
    const titleWords = new Set(wordsOf(title));
    const textWords = new Set(wordsOf(text));
    if ([...titleWords].some((w) => QUALIFIERS.has(w) && !asked.includes(w))) continue;
    let score = 0;
    let qualified = false;
    for (const w of asked) {
      if (has(titleWords, w)) {
        score += VERBS.has(w) ? 2 : 3; // a verb in the TITLE beats a word only the description has
        if (!VERBS.has(w)) qualified = true;
      } else if (has(textWords, w)) {
        score += 1;
      }
    }
    if (qualified) scored.push({ flow, title, score, reading: reading(title) });
  }
  return scored
    .sort((a, b) => b.score - a.score || Number(a.reading) - Number(b.reading) || a.title.localeCompare(b.title))
    .slice(0, max)
    .map(({ flow, title }) => ({ id: flow.id, title }));
}
