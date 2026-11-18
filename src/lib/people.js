// Who did something, said in words a person can read. A record names its author by account id (24 hex characters),
// or by a word such as "system"; the server sends the name beside it (createdByName, byName). An id is never shown:
// an account since removed has no name, and a blank reads better than "6aca1d9b5caae294d2bad5cf".

export const isRecordId = (v) => /^[a-f0-9]{24}$/i.test(String(v ?? "").trim());

export function personLabel(name, raw) {
  const n = String(name ?? "").trim();
  if (n) return n;
  const r = String(raw ?? "").trim();
  if (!r || isRecordId(r)) return "";
  return r.charAt(0).toUpperCase() + r.slice(1);
}
