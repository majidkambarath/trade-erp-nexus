import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

// An editable table for entering lines (journal rows, note lines) from the keyboard.
//
//   Enter            next cell in the row; after the last cell, the first cell of the next row;
//                    after the last row, a new row
//   Up / Down        the same column, one row up or down (in text and amount cells)
//   Tab / Shift+Tab  the browser's normal order
//   Alt+N            add a row            Alt+Delete   remove the current row
//
// A cell is whatever `renderCell(row, index, column)` returns; the grid wraps it so it can be
// found again. Search selects keep their own keys: Enter chooses an option while the list is
// open, and only moves on when it is closed.
const EntryGrid = forwardRef(function EntryGrid(
  { columns, rows, renderCell, onAdd, onRemove, minRows = 2, addLabel = "Add row", rowErrors = {}, ariaLabel, footer },
  ref
) {
  const root = useRef(null);
  const keys = columns.map((c) => c.key);

  const focusCell = (row, key) => {
    const cell = root.current?.querySelector(`[data-cell="${row}:${key}"]`);
    if (!cell) return false;
    const target = cell.matches("input,textarea,select,button") ? cell : cell.querySelector("input:not([type=hidden]),textarea,select,button");
    if (target) {
      target.focus();
      if (target.select && target.tagName === "INPUT" && target.type !== "date") target.select();
    }
    return Boolean(target);
  };
  useImperativeHandle(ref, () => ({ focusCell }));

  const later = (fn) => setTimeout(fn, 0); // after React has drawn the change

  const onKeyDown = (e) => {
    if (e.defaultPrevented) return; // a search select that used the key (choosing an option)
    const cell = e.target.closest?.("[data-cell]");
    if (!cell) return;
    const [r, key] = cell.dataset.cell.split(":");
    const row = Number(r);
    const col = keys.indexOf(key);

    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      onAdd();
      later(() => focusCell(rows.length, keys[0]));
      return;
    }
    if (e.altKey && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      if (rows.length > minRows) {
        onRemove(row);
        later(() => focusCell(Math.min(row, rows.length - 2), key));
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !["TEXTAREA", "BUTTON"].includes(e.target.tagName)) {
      e.preventDefault();
      if (col < keys.length - 1) focusCell(row, keys[col + 1]);
      else if (row < rows.length - 1) focusCell(row + 1, keys[0]);
      else {
        onAdd();
        later(() => focusCell(row + 1, keys[0]));
      }
      return;
    }
    const isList = e.target.getAttribute?.("role") === "combobox" || e.target.tagName === "SELECT";
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.tagName === "INPUT" && !isList) {
      const next = row + (e.key === "ArrowDown" ? 1 : -1);
      if (next >= 0 && next < rows.length) {
        e.preventDefault();
        focusCell(next, key);
      }
    }
  };

  return (
    <div ref={root} onKeyDown={onKeyDown}>
      <div className="relative overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm" aria-label={ariaLabel}>
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2 text-start">Sl</th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-2 py-2", c.align === "end" ? "text-end" : "text-start", c.className)}>{c.label}</th>
              ))}
              <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <React.Fragment key={i}>
                <tr className={cn("border-t border-border align-top", rowErrors[i] && "bg-status-danger-soft/40")}>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} data-cell={`${i}:${c.key}`} className={cn("px-2 py-1.5", c.className)}>
                      {renderCell(row, i, c)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <button
                      type="button" tabIndex={-1} onClick={() => rows.length > minRows && onRemove(i)} disabled={rows.length <= minRows}
                      aria-label={`Remove row ${i + 1}`}
                      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-status-danger disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {rowErrors[i] && (
                  <tr><td /><td colSpan={columns.length + 1} className="px-2 pb-2 text-xs font-medium text-status-danger" role="alert">Row {i + 1}: {rowErrors[i]}</td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          {footer && <tfoot className="border-t-2 border-border bg-secondary/40 font-semibold">{footer}</tfoot>}
        </table>
      </div>
      <button
        type="button" onClick={() => { onAdd(); later(() => focusCell(rows.length, keys[0])); }}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
        <kbd className="rounded border border-border px-1.5 text-[11px]">Alt+N</kbd>
      </button>
    </div>
  );
});

export default EntryGrid;
