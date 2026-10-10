import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CreatableSelect from "react-select/creatable";
import { Trash2 } from "lucide-react";
import { CURRENCY, formatNumber } from "../../utils/format";
import { cn } from "../../lib/utils";

import { DateInput } from "../accounting/kit";
import { WIDE, useMediaQuery } from "../accounting/DataTable";
import { rowIsService } from "../../lib/itemTypes";
import { lineHint } from "../../lib/reverseCharge";
// Line items as an ARIA grid (https://www.w3.org/WAI/ARIA/apg/patterns/grid/).
//
// Keyboard model:
//   Tab / Shift+Tab   enter and leave the grid as a single stop (roving tabindex: only the
//                     active cell is in the tab order)
//   Arrow keys        move between editable cells
//   Enter             move down; on the last row, add a row
//   Escape            cancel a pending row removal
// An editor that handles a key itself (react-select opening its menu) calls preventDefault,
// and the grid leaves that key alone. Text boxes keep Left/Right for the caret until the
// caret reaches the edge.

const EDITABLE = new Set(["item", "text", "number", "select", "date"]);
const navigable = (c) => EDITABLE.has(c.kind) || c.kind === "remove";

const compactSelect = {
  control: (base, s) => ({
    ...base,
    minHeight: 36,
    borderRadius: 8,
    borderColor: s.isFocused ? "var(--ring)" : "var(--input)",
    boxShadow: s.isFocused ? "0 0 0 2px var(--ring)" : "none",
    backgroundColor: "var(--card)",
    fontSize: 14,
  }),
  valueContainer: (base) => ({ ...base, padding: "0 8px" }),
  menu: (base) => ({ ...base, zIndex: 80, borderRadius: 10, overflow: "hidden" }),
  menuPortal: (base) => ({ ...base, zIndex: 80 }),
  option: (base, s) => ({
    ...base,
    fontSize: 14,
    backgroundColor: s.isSelected ? "var(--primary)" : s.isFocused ? "var(--accent)" : "var(--card)",
    color: s.isSelected ? "var(--primary-foreground)" : "var(--foreground)",
  }),
  singleValue: (base) => ({ ...base, color: "var(--foreground)" }),
  input: (base) => ({ ...base, color: "var(--foreground)" }),
  placeholder: (base) => ({ ...base, color: "var(--muted-foreground)" }),
};

const fieldInput =
  "h-11 md:h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

// Date inputs use the arrow keys for their own day / month / year parts, so the grid leaves
// them alone; Tab or Enter moves on. A native <select> keeps Up/Down for choosing a value.
const ownsArrows = (e) => e.target instanceof HTMLInputElement && e.target.type === "date";

const caretCanMove = (e, dir) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== "text") return true;
  if (el.selectionStart !== el.selectionEnd) return false;
  return dir === "left" ? el.selectionStart === 0 : el.selectionStart === el.value.length;
};

export default function LineItemsGrid({
  label,
  columns,
  rows,
  errors,
  itemOptions,
  onItemChange,
  onCellChange,
  onRemove,
  onAddRow,
  onCreateItem,
  focusRequest,
  selectOptions = {},
}) {
  const wide = useMediaQuery(WIDE);
  const navCols = useMemo(
    () => columns.map((c, i) => (navigable(c) ? i : -1)).filter((i) => i >= 0),
    [columns]
  );
  const firstNav = navCols[0] ?? 0;
  const [active, setActive] = useState({ row: 0, col: firstNav });
  const [armed, setArmed] = useState(null); // row awaiting the second click that removes it
  const [pending, setPending] = useState(null); // focus to apply after a row is added
  const cells = useRef(new Map());

  const focusCell = useCallback((r, c) => {
    const el = cells.current.get(`${r}:${c}`);
    if (!el) return;
    const target = el.querySelector("input, button, select, textarea") || el.querySelector("[tabindex]"); // the dash of a cell that does not apply to a service
    (target || el).focus();
  }, []);

  const clampRow = (r) => Math.max(0, Math.min(rows.length - 1, r));
  const colNearest = (c) => (navCols.includes(c) ? c : navCols.find((n) => n >= c) ?? navCols[navCols.length - 1]);
  const colStep = (c, dir) => {
    const i = navCols.indexOf(c);
    return navCols[Math.max(0, Math.min(navCols.length - 1, i + dir))];
  };

  const move = (r, c) => {
    const row = clampRow(r);
    setActive({ row, col: c });
    focusCell(row, c);
  };

  // Apply a focus that was requested before the row existed (after add-row, or validation).
  useEffect(() => {
    if (!pending) return;
    if (pending.row >= rows.length) return;
    setActive({ row: pending.row, col: pending.col });
    focusCell(pending.row, pending.col);
    setPending(null);
  }, [pending, rows.length, focusCell]);

  useEffect(() => {
    if (!focusRequest) return;
    const c = columns.findIndex((col) => col.key === focusRequest.colKey);
    const col = c >= 0 ? c : firstNav;
    setActive({ row: focusRequest.row, col });
    focusCell(focusRequest.row, col);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  useEffect(() => {
    if (armed !== null && armed !== active.row) setArmed(null);
  }, [active.row, armed]);

  const onKeyDown = (e) => {
    if (e.defaultPrevented) return;
    if (ownsArrows(e) && e.key.startsWith("Arrow")) return;
    const { row, col } = active;
    switch (e.key) {
      case "ArrowDown":
        if (e.target instanceof HTMLSelectElement && !e.altKey) return; // choose a value
        e.preventDefault();
        move(row + 1, colNearest(col));
        break;
      case "ArrowUp":
        if (e.target instanceof HTMLSelectElement && !e.altKey) return;
        e.preventDefault();
        move(row - 1, colNearest(col));
        break;
      case "ArrowRight":
        if (!caretCanMove(e, "right")) return;
        e.preventDefault();
        move(row, colStep(colNearest(col), 1));
        break;
      case "ArrowLeft":
        if (!caretCanMove(e, "left")) return;
        e.preventDefault();
        move(row, colStep(colNearest(col), -1));
        break;
      case "Enter":
        if (e.shiftKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (row >= rows.length - 1) {
          onAddRow();
          setPending({ row: rows.length, col: firstNav });
        } else {
          move(row + 1, colNearest(col));
        }
        break;
      case "Escape":
        if (armed !== null) {
          e.stopPropagation();
          setArmed(null);
        }
        break;
      default:
        break;
    }
  };

  const onFocusCapture = (e) => {
    const cell = e.target.closest?.("[data-cell]");
    if (!cell) return;
    const [r, c] = cell.dataset.cell.split(":").map(Number);
    setActive({ row: r, col: c });
  };

  const requestRemove = (r) => {
    if (rows.length <= 1) return;
    if (armed === r) {
      onRemove(r);
      setArmed(null);
    } else {
      setArmed(r);
    }
  };

  const renderEditor = (col, row, r, tabIndex) => {
    const value = row[col.key];
    const common = { tabIndex, "aria-label": `${col.label || col.key}, row ${r + 1}` };
    // a service line has no batch or expiry to record, and no quantity on hand (lib/itemTypes.js)
    if (rowIsService(row) && (col.key === "batchNumber" || col.key === "expiryDate")) {
      return <span className="block text-muted-foreground" tabIndex={tabIndex} aria-label={`${col.label || col.key}, row ${r + 1}: not applicable to a service`}>—</span>;
    }
    switch (col.kind) {
      case "item": {
        const current = itemOptions.find((o) => o.value === row.itemId) || null;
        return (
          <CreatableSelect
            {...common}
            inputId={`item-${r}`}
            options={itemOptions}
            value={current}
            onChange={(opt) => onItemChange(r, opt ? opt.value : "")}
            onCreateOption={(text) => onCreateItem(r, text)}
            formatCreateLabel={(text) => `Create "${text}"`}
            placeholder="Search item…"
            isClearable
            isSearchable
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            styles={compactSelect}
            classNamePrefix="rs"
            className="min-w-0"
          />
        );
      }
      case "text":
        return (
          <input
            {...common}
            type="text"
            value={value ?? ""}
            onChange={(e) => onCellChange(r, col.key, e.target.value)}
            className={fieldInput}
          />
        );
      case "number":
        return (
          <input
            {...common}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={value ?? ""}
            onChange={(e) => onCellChange(r, col.key, e.target.value)}
            className={cn(fieldInput, col.align === "end" && "text-end tabular-nums")}
          />
        );
      case "select": {
        const options = selectOptions[col.key] || [];
        return (
          <select
            {...common}
            value={value ?? ""}
            onChange={(e) => onCellChange(r, col.key, e.target.value)}
            className={cn(fieldInput, "pe-7")}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      }
      case "date":
        return (
          <DateInput
            {...common}
            value={value ?? ""}
            onChange={(e) => onCellChange(r, col.key, e.target.value)}
            inputClassName={fieldInput}
          />
        );
      case "money":
        // A reverse-charge line: the VAT column reads 0 (the supplier charges none) and says what is assessed instead
        if (col.key === "vatAmount" && row.reverseCharge) {
          return (
            <span className="block">
              <span className="block tabular-nums">{formatNumber(0)}</span>
              <span className="ms-auto block max-w-[11rem] whitespace-normal text-xs font-normal leading-tight text-muted-foreground">
                {lineHint(row.vatPercent ?? row.taxPercent, `${CURRENCY} ${formatNumber(Number(row.rcmVat) || 0)}`)}
              </span>
            </span>
          );
        }
        return <span className="block tabular-nums">{formatNumber(value || 0)}</span>;
      case "ro":
        // "In stock" for a service says what it is, rather than a blank that reads like an empty shelf
        if (col.key === "currentStock" && rowIsService(row)) return <span className="block truncate text-muted-foreground">Service</span>;
        return <span className="block truncate text-muted-foreground">{value || "—"}</span>;
      case "remove":
        return (
          <button
            {...common}
            type="button"
            disabled={rows.length <= 1}
            onClick={() => requestRemove(r)}
            aria-label={armed === r ? `Confirm removing row ${r + 1}` : `Remove row ${r + 1}`}
            className={cn(
              "grid h-9 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              armed === r
                ? "bg-status-danger-soft px-2 text-xs font-bold text-status-danger"
                : "w-9 text-muted-foreground hover:bg-accent hover:text-status-danger"
            )}
          >
            {armed === r ? "Confirm" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------- touch: a card per line
  //
  // The grid above is built for a keyboard: a roving tabindex, arrow keys between cells, Enter
  // to add a row. None of that exists on a phone, and eight columns of inputs behind a
  // sideways scroll is not a form anyone can fill in. Below md each line becomes a card with
  // labelled fields instead, reusing the same editors so there is one definition of each.
  if (!wide) {
    const editable = columns.filter((c) => EDITABLE.has(c.kind));
    const readouts = columns.filter((c) => c.kind === "money" || c.kind === "ro");
    const removeCol = columns.find((c) => c.kind === "remove");

    return (
      <div className="flex flex-col gap-3" aria-label={label} role="group">
        {rows.map((row, r) => (
          <div key={`card-${r}`} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Line {r + 1}
              </span>
              {removeCol && renderEditor(removeCol, row, r, 0)}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {editable.map((col) => (
                <label
                  key={col.key}
                  // the item picker and anything free-text need the full width; figures pair up
                  className={cn(
                    "flex min-w-0 flex-col gap-1",
                    (col.kind === "item" || col.kind === "text" || col.wide) && "col-span-2"
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">{col.label || col.key}</span>
                  {renderEditor(col, row, r, 0)}
                  {errors?.[r]?.[col.key] && (
                    <span className="text-xs font-medium text-status-danger">{errors[r][col.key]}</span>
                  )}
                </label>
              ))}
            </div>

            {readouts.length > 0 && (
              <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-2.5 text-sm">
                {readouts.map((col) => (
                  <div key={col.key} className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">{col.label || col.key}</dt>
                    <dd className="font-medium tabular-nums">{renderEditor(col, row, r, -1)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="erp-scroll overflow-x-auto rounded-xl border border-border bg-card">
      <table role="grid" aria-label={label} aria-rowcount={rows.length + 1} aria-colcount={columns.length} className="w-full min-w-max border-collapse text-sm" onKeyDown={onKeyDown} onFocus={onFocusCapture}>
        <thead className="bg-secondary text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr role="row" aria-rowindex={1}>
            {columns.map((c, i) => (
              <th
                key={c.key}
                role="columnheader"
                scope="col"
                aria-colindex={i + 1}
                className={cn("border-b border-border px-3 py-2.5", c.min, c.align === "end" ? "text-end" : "text-start")}
              >
                {c.label || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={`row-${r}`} role="row" aria-rowindex={r + 2} className="border-b border-border last:border-b-0 hover:bg-secondary/40">
              {columns.map((col, c) => {
                const navigableCell = navigable(col);
                const isActive = active.row === r && active.col === c;
                const err = errors?.[`${col.key}_${r}`];
                return (
                  <td
                    key={col.key}
                    role="gridcell"
                    aria-colindex={c + 1}
                    data-cell={navigableCell ? `${r}:${c}` : undefined}
                    ref={(el) => {
                      if (!navigableCell) return;
                      if (el) cells.current.set(`${r}:${c}`, el);
                      else cells.current.delete(`${r}:${c}`);
                    }}
                    aria-invalid={err ? true : undefined}
                    className={cn("px-2 py-1.5 align-middle", col.min, col.align === "end" && "text-end", col.strong && "font-bold text-foreground")}
                  >
                    {renderEditor(col, row, r, navigableCell && isActive ? 0 : -1)}
                    {err && (
                      <span className="mt-0.5 block text-xs text-status-danger" role="alert">
                        {err}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
