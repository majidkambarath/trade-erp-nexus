import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Inbox, Loader2, X } from "lucide-react";
import ReactSelect from "react-select";
import { cn } from "../../lib/utils";
import { toastClasses } from "../../lib/status";
import { drCr, formatDate, getDateFormat, parseDate } from "../../utils/format";
import { DataTable, TableScroll } from "./DataTable";

export { DataTable, TableScroll };

// Small building blocks shared by the accounting, reporting, batch and e-invoicing screens.
// Everything here reads the existing design tokens (bg-card, border-border, brand-soft, status
// tones) so these screens look like the rest of the app in both themes.

// ---------- layout ----------

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* On a phone the actions get their own row and stretch, so a primary button is a
          full-width target rather than a 90px one in the corner. */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>*]:min-h-11 [&>*]:flex-1 sm:[&>*]:min-h-0 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-status-danger/25 bg-status-danger-soft p-4 text-sm text-status-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{error.message || String(error)}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

// ---------- status ----------

const TONES = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-status-info-soft text-status-info border-status-info/25",
  warning: "bg-status-warning-soft text-status-warning border-status-warning/25",
  success: "bg-status-success-soft text-status-success border-status-success/25",
  danger: "bg-status-danger-soft text-status-danger border-status-danger/25",
};

export function Pill({ tone = "neutral", children, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

// An amount with its side: "1,312.50 Dr" or "300.00 Cr". Zero shows no side.
export function Balance({ net, className }) {
  const { text, side } = drCr(net);
  return (
    <span className={cn("tabular-nums", className)}>
      {text}
      {side && <abbr title={side === "Dr" ? "Debit balance" : "Credit balance"} className="ms-1 text-[11px] font-semibold uppercase text-muted-foreground no-underline">{side}</abbr>}
    </span>
  );
}

// ---------- forms ----------

// h-11 (44px) on touch, h-10 on a pointer: the minimum comfortable target without
// loosening every form on a desktop screen.
export const inputClass =
  "h-11 lg:h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-status-danger";

// Label, control, hint and error, wired together with ids so screen readers announce them.
export function Field({ label, hint, error, required, className, children }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined,
        required: children.props.required ?? undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span aria-hidden="true" className="ms-0.5 text-status-danger">*</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errId} className="text-xs font-medium text-status-danger">{error}</p>}
    </div>
  );
}

export const TextInput = React.forwardRef(function TextInput({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...p} />;
});

// A date field that shows and accepts dates the way the person chose to read them (Settings >
// Preferences: 04/10/2026, 2026-10-04, 04 Oct 2026...), instead of the browser's own regional
// format. Type it, or open the calendar. `value` and the value in the change event are ISO
// "YYYY-MM-DD", exactly like a native date input, so it is a drop-in for <input type="date">.
export const DateInput = React.forwardRef(function DateInput(
  { value = "", onChange, onBlur, min, max, className, inputClassName, disabled, required, id, name, placeholder, ...aria },
  ref
) {
  const pattern = getDateFormat();
  const show = (iso) => (iso ? formatDate(iso, pattern) : "");
  const [text, setText] = useState(show(value));
  const [bad, setBad] = useState(false);
  const picker = useRef(null);
  // The ISO date this field has just reported from the person's own typing. Its echo (the parent
  // passing the same date back as `value`) must not rewrite the text being typed: in YYYY-MM-DD,
  // "2026-03-1" already reads as the 1st, and showing "2026-03-01" at once would turn the next
  // digit into "2026-03-017" - so the 10th to the 31st could not be typed. The text is tidied on leaving.
  const echo = useRef(null);
  // follow the value from outside (a quick range, a reset) and a changed format
  useEffect(() => {
    if (echo.current !== null && echo.current === value) { echo.current = null; setBad(false); return; }
    echo.current = null;
    setText(show(value));
    setBad(false);
  }, [value, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (iso) => onChange?.({ target: { id, name, type: "date", value: iso }, type: "change" });

  function change(e) {
    const typed = e.target.value;
    setText(typed);
    if (!typed.trim()) { setBad(false); if (value) { echo.current = ""; emit(""); } return; }
    const iso = parseDate(typed, pattern);
    // min / max guide the calendar only, as on a native date field: the form explains a date out of range
    if (iso) { setBad(false); if (iso !== value) { echo.current = iso; emit(iso); } } else setBad(true);
  }
  function leave(e) {
    echo.current = null;
    setText(show(value)); // an unfinished or impossible date is not kept; a good one is shown the way the format writes it
    setBad(false);
    onBlur?.(e);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={ref} id={id} name={name} type="text" inputMode="numeric" autoComplete="off" value={text} onChange={change} onBlur={leave}
        placeholder={placeholder ?? pattern} disabled={disabled} required={required} maxLength={16}
        {...aria} aria-invalid={bad || aria["aria-invalid"] || undefined}
        className={cn(inputClassName || inputClass, "pe-10")}
      />
      <input
        ref={picker} type="date" tabIndex={-1} aria-hidden="true" disabled={disabled} value={value || ""} min={min} max={max}
        onChange={(e) => e.target.value && emit(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      <button
        type="button" tabIndex={-1} disabled={disabled} aria-label="Open calendar"
        onClick={() => { try { picker.current?.showPicker?.(); } catch { /* not allowed here: type the date instead */ } }}
        className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 lg:end-1.5 lg:h-7 lg:w-7"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
});

export const Select = React.forwardRef(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, "pe-8", className)} {...p}>
      {children}
    </select>
  );
});

// A select you can type into. Use it wherever the list can be long (accounts, groups, customers,
// banks): type to filter by name or code, arrow keys to move, Enter to choose, Escape to close.
// It is a drop-in for the native Select: `value` is the chosen option's value and `onChange`
// receives that value as a string ("" when cleared).
//   options: [{ value, label, searchText?, depth?, hint? }]   depth indents a child under its parent
const searchStyles = (invalid, compact) => ({
  control: (base, s) => ({
    ...base,
    minHeight: compact ? 36 : 40,
    borderRadius: 8,
    borderColor: invalid ? "var(--status-danger)" : s.isFocused ? "var(--ring)" : "var(--input)",
    boxShadow: s.isFocused ? "0 0 0 2px color-mix(in srgb, var(--ring) 40%, transparent)" : "none",
    backgroundColor: "var(--background)",
    fontSize: 14,
    cursor: "text",
    ":hover": { borderColor: invalid ? "var(--status-danger)" : "var(--ring)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 12px" }),
  singleValue: (base) => ({ ...base, color: "var(--foreground)" }),
  input: (base) => ({ ...base, color: "var(--foreground)", margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: "var(--muted-foreground)" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "var(--muted-foreground)", padding: "0 10px" }),
  clearIndicator: (base) => ({ ...base, color: "var(--muted-foreground)", padding: "0 6px" }),
  menu: (base) => ({ ...base, zIndex: 70, borderRadius: 10, overflow: "hidden", backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated, 0 10px 30px rgba(0,0,0,.18))" }),
  menuPortal: (base) => ({ ...base, zIndex: 70 }),
  menuList: (base) => ({ ...base, padding: 4, maxHeight: 280 }),
  option: (base, s) => ({
    ...base,
    fontSize: 14,
    borderRadius: 6,
    cursor: "pointer",
    backgroundColor: s.isSelected ? "var(--primary)" : s.isFocused ? "var(--accent)" : "transparent",
    color: s.isSelected ? "var(--primary-foreground)" : "var(--foreground)",
    ":active": { backgroundColor: "var(--accent)" },
  }),
  noOptionsMessage: (base) => ({ ...base, color: "var(--muted-foreground)", fontSize: 14 }),
});

const norm = (v) => String(v ?? "").toLowerCase();
const matches = (option, input) => {
  const q = norm(input).trim();
  if (!q) return true;
  const hay = `${option.data.label} ${option.data.searchText || ""} ${option.data.hint || ""}`;
  return q.split(/\s+/).every((word) => norm(hay).includes(word));
};

export function SearchSelect({
  id, value, onChange, options, placeholder = "Choose…", clearable = false, disabled = false, loading = false,
  invalid, autoFocus = false, compact = false, noOptionsText = "Nothing matches", className, ...aria
}) {
  const selected = options.find((o) => String(o.value) === String(value ?? "")) || null;
  // Escape closes the list when it is open; only an Escape pressed with the list already closed
  // reaches the dialog around it. The list is flagged on the native event so the dialog can tell.
  const listOpen = useRef(false);
  return (
    <ReactSelect
      onMenuOpen={() => { listOpen.current = true; }}
      onMenuClose={() => { listOpen.current = false; }}
      onKeyDown={(e) => { if (e.key === "Escape" && listOpen.current && e.nativeEvent) e.nativeEvent.escapeHandledByList = true; }}
      inputId={id}
      className={className}
      classNamePrefix="search-select"
      styles={searchStyles(Boolean(invalid ?? aria["aria-invalid"]), compact)}
      options={options}
      value={selected}
      onChange={(opt) => onChange?.(opt ? String(opt.value) : "")}
      isClearable={clearable}
      isDisabled={disabled}
      isLoading={loading}
      autoFocus={autoFocus}
      placeholder={placeholder}
      noOptionsMessage={() => noOptionsText}
      filterOption={matches}
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      menuPosition="fixed"
      aria-label={aria["aria-label"]}
      aria-invalid={aria["aria-invalid"]}
      aria-describedby={aria["aria-describedby"]}
      aria-required={aria.required || undefined}
      formatOptionLabel={(o, { context }) => (
        <span className="flex min-w-0 items-baseline gap-2" style={context === "menu" && o.depth ? { paddingInlineStart: o.depth * 14 } : undefined}>
          <span className="truncate">{o.label}</span>
          {o.hint && <span className="shrink-0 text-xs opacity-70">{o.hint}</span>}
        </span>
      )}
    />
  );
}

export const Textarea = React.forwardRef(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={3} className={cn(inputClass, "h-auto py-2", className)} {...p} />;
});

// ---------- dialog ----------

// A modal dialog. Escape closes it; focus moves in on open and returns on close. Clicking the
// backdrop does NOT close it, so a half-typed form is never lost to a stray click.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, description, onClose, children, footer, size = "md" }) {
  const titleId = useId();
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    // a field that grabbed focus itself (a search select with autoFocus) keeps it
    if (!ref.current?.contains(document.activeElement)) {
      const first = ref.current?.querySelector("[data-autofocus]") || ref.current?.querySelector(FOCUSABLE);
      first?.focus();
    }
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      // a dropdown that was open has already handled this key: it closes, the dialog stays
      if (e.nativeEvent?.escapeHandledByList) return;
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab") return;
    // keep Tab inside the dialog
    const nodes = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const [a, z] = [nodes[0], nodes[nodes.length - 1]];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };

  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  // On a phone this is a bottom sheet: flush to the bottom edge, full width, square at the
  // foot and rounded at the head, with the page showing above it. From md up it is the
  // centred dialog it has always been.
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      onKeyDown={onKeyDown}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-elevated",
          "md:max-h-[min(90dvh,52rem)] md:rounded-2xl",
          width
        )}
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 pb-3 pt-4 md:px-6 md:py-4">
          {/* grab handle, phones only - the sheet's own affordance */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-border md:hidden"
          />
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:h-8 md:w-8">
            <X className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">{children}</div>
        {/* The footer is the sheet's action bar on a phone: buttons stretch and clear the
            home bar, so the primary action is always reachable with a thumb. */}
        {footer && (
          <footer className="pb-safe flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 md:px-6 md:py-3.5 [&>button]:min-h-11 [&>button]:flex-1 md:[&>button]:min-h-0 md:[&>button]:flex-none">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// ---------- data ----------

// Runs an async loader and tracks its state. `reload` re-runs it; a stale response from an
// earlier call never overwrites a newer one.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useRef(0);
  const load = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(loader)
      .then((data) => id === run.current && setState({ data, loading: false, error: null }))
      .catch((error) => id === run.current && setState((s) => ({ ...s, loading: false, error })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

// Toasts: a card with a coloured edge (lib/status). One at a time, auto-dismissed.
export function useToasts() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const notify = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? (
    <div
      role="status"
      className={cn(
        // clears the bottom bar (3.5rem + the device inset) below lg
        "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] end-3 start-3 z-[70] flex items-start gap-2",
        "lg:bottom-4 lg:start-auto lg:max-w-sm",
        toastClasses(toast.type)
      )}
    >
      {toast.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-hidden="true" />}
      <p className="text-sm">{toast.message}</p>
    </div>
  ) : null;
  return { notify, toastNode: node };
}

export const errorMessage = (err) => err?.message || "Something went wrong";

// A yes/no question that names the consequence. The confirm button says what it does.
// `typeToConfirm` (e.g. "delete") makes the confirm button wait until the user has typed that word.
// Use it for anything that removes a record, so a stray click or Enter cannot delete it.
export function ConfirmDialog({ title, text, confirmLabel = "Confirm", danger = false, busy = false, typeToConfirm = "", onConfirm, onClose }) {
  const [typed, setTyped] = useState("");
  const matches = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();
  const inputId = useId();
  const confirm = () => {
    if (matches && !busy) onConfirm();
  };
  return (
    <Modal
      size="sm" title={title} onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent md:h-10">Cancel</button>
          <button
            type="button" onClick={confirm} disabled={busy || !matches} data-autofocus={!typeToConfirm || undefined}
            className={cn("inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10", danger ? "bg-destructive" : "bg-primary")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{text}</p>
      {typeToConfirm && (
        <div className="mt-4 space-y-1.5">
          <label htmlFor={inputId} className="block text-sm">
            Type <span className="font-semibold text-foreground">{typeToConfirm}</span> to confirm
          </label>
          <input
            id={inputId}
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
    </Modal>
  );
}

export { formatDateTime } from "../../utils/format";
